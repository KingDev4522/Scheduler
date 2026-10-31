"""CP-SAT weekly timetable for the official CIT dataset.

Encodes exactly the rules the official validator checks, so a FEASIBLE result
should yield zero hard violations (H1-H14 minus H13, which belongs to bookings).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from .data import Data, LAST_TEACHING


@dataclass
class WeeklySolution:
    status: str
    placements: dict[str, tuple[str, int, str]] = field(default_factory=dict)
    detail: str = ""
    objective: float = 0.0


def solve_weekly(
    data: Data,
    *,
    max_seconds: float = 120.0,
    workers: int = 8,
    extra_faculty_unavailable: set[tuple[str, str, int]] | None = None,
    extra_room_unavailable: set[tuple[str, str, int]] | None = None,
    extra_sessions: list[dict] | None = None,
    removed_session_ids: set[str] | None = None,
) -> WeeklySolution:
    extra_faculty_unavailable = extra_faculty_unavailable or set()
    extra_room_unavailable = extra_room_unavailable or set()
    extra_sessions = extra_sessions or []
    removed_session_ids = removed_session_ids or set()

    sessions = [s for s in data.sessions.values() if s["id"] not in removed_session_ids] + list(extra_sessions)
    # Extra sessions carry no availability; fold the disruption into lookups.
    fac_un = data.fac_unavailable | extra_faculty_unavailable
    room_un = data.room_unavailable | extra_room_unavailable

    def candidate_slots(s: dict) -> list[int]:
        starts = data.legal_starts(s["duration"], s["kind"])
        out: list[int] = []
        for day in data.days:
            for start in starts:
                fx = s.get("fixed_slot")
                if fx and (fx["day"] != day or fx["start_period"] != start):
                    continue
                if any((s["faculty_id"], day, p) in fac_un for p in data.block(start, s["duration"])):
                    continue
                out.append(data.slot(day, start))
        return out

    model = cp_model.CpModel()
    candidates: dict[str, list[int]] = {}
    for s in sessions:
        candidates[s["id"]] = candidate_slots(s)
        if not candidates[s["id"]]:
            return WeeklySolution("INFEASIBLE", detail=f"{s['id']} has no feasible slot")

    x: dict[tuple[str, int], cp_model.IntVar] = {}
    start: dict[str, cp_model.IntVar] = {}
    end: dict[str, cp_model.IntVar] = {}
    for s in sessions:
        sid = s["id"]
        xs = [model.NewBoolVar(f"x[{sid},{t}]") for t in candidates[sid]]
        for t, var in zip(candidates[sid], xs):
            x[(sid, t)] = var
        model.AddExactlyOne(xs)
        start[sid] = model.NewIntVarFromDomain(cp_model.Domain.FromValues(candidates[sid]), f"start[{sid}]")
        end[sid] = model.NewIntVar(0, LAST_TEACHING * len(data.days), f"end[{sid}]")
        model.Add(start[sid] == sum(t * x[(sid, t)] for t in candidates[sid]))

    # -- elective baskets: same slot for every option (H11) ---------------
    baskets: dict[str, list[dict]] = defaultdict(list)
    for s in sessions:
        if s.get("basket_slot"):
            baskets[s["basket_slot"]].append(s)
    basket_start: dict[str, cp_model.IntVar] = {}
    basket_duration: dict[str, int] = {}
    for bname, options in baskets.items():
        if len(options) < 2:
            continue
        common = set(candidates[options[0]["id"]])
        for o in options[1:]:
            common &= set(candidates[o["id"]])
        if not common:
            return WeeklySolution("INFEASIBLE", detail=f"basket {bname}: no common slot (H11)")
        anchor = options[0]["id"]
        for o in options:
            for t in candidates[o["id"]]:
                if t not in common:
                    model.Add(x[(o["id"], t)] == 0)
        for o in options[1:]:
            for t in sorted(common):
                model.Add(x[(o["id"], t)] == x[(anchor, t)])
        basket_duration[bname] = max(o["duration"] for o in options)
        basket_start[bname] = start[anchor]

    # -- rooms (H4) -------------------------------------------------------
    room_var: dict[tuple[str, str], cp_model.IntVar] = {}
    rooms_intervals: dict[str, list] = defaultdict(list)
    for s in sessions:
        sid = s["id"]
        elig = data.eligible_rooms(s)
        if not elig:
            return WeeklySolution("INFEASIBLE", detail=f"{sid} has no eligible room (H5/H6/H10)")
        for r in elig:
            var = model.NewBoolVar(f"room[{sid},{r}]")
            room_var[(sid, r)] = var
            rooms_intervals[r].append(
                model.NewOptionalIntervalVar(start[sid], s["duration"], end[sid], var, f"iv[{sid},{r}]")
            )
        model.AddExactlyOne(room_var[(sid, r)] for r in elig)
    for r, ivs in rooms_intervals.items():
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # -- faculty non-overlap (H2) ----------------------------------------
    by_faculty: dict[str, list[dict]] = defaultdict(list)
    for s in sessions:
        by_faculty[s["faculty_id"]].append(s)
    for fid, ss in by_faculty.items():
        ivs = [model.NewIntervalVar(start[s["id"]], s["duration"], end[s["id"]], f"fac[{s['id']}]") for s in ss]
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # -- group non-overlap (H3), basket options keyed as one occupant ----
    group_ids = {g for s in sessions for g in s["groups"]}
    for g in group_ids:
        ivs = []
        for s in sessions:
            if g in s["groups"] and not s.get("basket_slot"):
                ivs.append(model.NewIntervalVar(start[s["id"]], s["duration"], end[s["id"]], f"grp[{g},{s['id']}]"))
        for bname, options in baskets.items():
            if len(options) < 2:
                continue
            if not any(g in o["groups"] for o in options):
                continue
            dur = basket_duration[bname]
            ivs.append(model.NewIntervalVar(basket_start[bname], dur, model.NewIntVar(0, 45, f"bend[{bname},{g}]"), f"bgrp[{g},{bname}]"))
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # -- room unavailability (H8) ----------------------------------------
    for s in sessions:
        sid = s["id"]
        for r in data.eligible_rooms(s):
            for t in candidates[sid]:
                day, startp = data.day_of(t), data.period_of(t)
                if any((r, day, p) in room_un for p in data.block(startp, s["duration"])):
                    model.Add(x[(sid, t)] + room_var[(sid, r)] <= 1)

    # -- faculty daily hours (H12) ---------------------------------------
    for fid, ss in by_faculty.items():
        limit = data.faculty[fid].get("max_hours_per_day", 4)
        for day in data.days:
            terms = [x[(s["id"], t)] * s["duration"] for s in ss for t in candidates[s["id"]] if data.day_of(t) == day]
            if terms:
                model.Add(sum(terms) <= limit)

    # -- objective: provisional soft penalty ------------------------------
    terms: list = []
    for s in sessions:
        for t in candidates[s["id"]]:
            if data.period_of(t) == 9:
                terms.append(x[(s["id"], t)])  # S6
        for r in data.eligible_rooms(s):
            cap = data.rooms[r]["capacity"]
            if cap and s["size"] / cap < 0.4:
                terms.append(room_var[(s["id"], r)])  # S5
        for pref in data.faculty[s["faculty_id"]].get("preferences", []):
            if pref.get("type") != "avoid":
                continue
            days = pref.get("days", data.days)
            periods = pref.get("periods", [])
            for t in candidates[s["id"]]:
                if data.day_of(t) in days and any(p in periods for p in data.block(data.period_of(t), s["duration"])):
                    terms.append(2 * x[(s["id"], t)])  # S1
    if terms:
        model.Minimize(sum(terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_seconds
    solver.parameters.num_search_workers = workers
    solver.parameters.random_seed = 1
    status = solver.Solve(model)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placements = {}
        for s in sessions:
            sid = s["id"]
            slot = next(t for t in candidates[sid] if solver.Value(x[(sid, t)]) == 1)
            room = next(r for r in data.eligible_rooms(s) if solver.Value(room_var[(sid, r)]) == 1)
            placements[sid] = (data.day_of(slot), data.period_of(slot), room)
        return WeeklySolution("FEASIBLE", placements, objective=float(solver.ObjectiveValue()))
    if status == cp_model.INFEASIBLE:
        return WeeklySolution("INFEASIBLE", detail="no feasible weekly timetable")
    return WeeklySolution("UNKNOWN", detail="time limit reached without a solution")
