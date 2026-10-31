"""CP-SAT weekly timetable for the official CIT dataset.

Encodes the rules the official validator checks (H1-H14 minus H13, which belongs
to bookings) and an objective covering all six soft constraints S1-S6. When a
`baseline` is supplied, movement is penalised heavily so a disruption re-solve
changes as few placements as possible.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from .data import Data, LAST_TEACHING

MOVE_WEIGHT = 10_000


@dataclass
class WeeklySolution:
    status: str
    placements: dict[str, tuple[str, int, str]] = field(default_factory=dict)
    detail: str = ""
    objective: float = 0.0
    moved: int = 0


def solve_weekly(
    data: Data,
    *,
    max_seconds: float = 120.0,
    workers: int = 8,
    extra_faculty_unavailable: set[tuple[str, str, int]] | None = None,
    extra_room_unavailable: set[tuple[str, str, int]] | None = None,
    baseline: dict[str, tuple[str, int, str]] | None = None,
) -> WeeklySolution:
    extra_faculty_unavailable = extra_faculty_unavailable or set()
    extra_room_unavailable = extra_room_unavailable or set()
    sessions = list(data.sessions.values())
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
        end[sid] = model.NewIntVar(0, 45, f"end[{sid}]")
        model.Add(start[sid] == sum(t * x[(sid, t)] for t in candidates[sid]))

    # -- baskets: every option shares one slot (H11) ----------------------
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
    eligible: dict[str, list[str]] = {}
    for s in sessions:
        sid = s["id"]
        eligible[sid] = data.eligible_rooms(s)
        if not eligible[sid]:
            return WeeklySolution("INFEASIBLE", detail=f"{sid} has no eligible room (H5/H6/H10)")
        for r in eligible[sid]:
            var = model.NewBoolVar(f"room[{sid},{r}]")
            room_var[(sid, r)] = var
            rooms_intervals[r].append(
                model.NewOptionalIntervalVar(start[sid], s["duration"], end[sid], var, f"iv[{sid},{r}]")
            )
        model.AddExactlyOne(room_var[(sid, r)] for r in eligible[sid])
    for ivs in rooms_intervals.values():
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # -- faculty non-overlap (H2) ----------------------------------------
    by_faculty: dict[str, list[dict]] = defaultdict(list)
    for s in sessions:
        by_faculty[s["faculty_id"]].append(s)
    for ss in by_faculty.values():
        ivs = [model.NewIntervalVar(start[s["id"]], s["duration"], end[s["id"]], f"fac[{s['id']}]") for s in ss]
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # -- group non-overlap (H3), basket options keyed as one occupant ----
    group_ids = sorted({g for s in sessions for g in s["groups"]})
    for g in group_ids:
        ivs = []
        for s in sessions:
            if g in s["groups"] and not s.get("basket_slot"):
                ivs.append(model.NewIntervalVar(start[s["id"]], s["duration"], end[s["id"]], f"grp[{g},{s['id']}]"))
        for bname, options in baskets.items():
            if len(options) < 2 or not any(g in o["groups"] for o in options):
                continue
            ivs.append(model.NewIntervalVar(
                basket_start[bname], basket_duration[bname],
                model.NewIntVar(0, 45, f"bend[{bname},{g}]"), f"bgrp[{g},{bname}]",
            ))
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # -- room unavailability (H8) ----------------------------------------
    for s in sessions:
        sid = s["id"]
        for r in eligible[sid]:
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

    # -- objective terms --------------------------------------------------
    terms: list = []

    # S2: idle gaps per group per day, S3: >6 hours/day
    for g in group_ids:
        for day in data.days:
            busy: dict[int, cp_model.IntVar] = {}
            for p in data.block(1, LAST_TEACHING):
                covering = [
                    x[(s["id"], t)]
                    for s in sessions
                    if g in s["groups"]
                    for t in candidates[s["id"]]
                    if data.day_of(t) == day and p in data.block(data.period_of(t), s["duration"])
                ]
                b = model.NewBoolVar(f"busy[{g},{day},{p}]")
                if covering:
                    model.AddMaxEquality(b, covering)
                else:
                    model.Add(b == 0)
                busy[p] = b
            for p in range(2, LAST_TEACHING):
                pre = model.NewBoolVar(f"pre[{g},{day},{p}]")
                suf = model.NewBoolVar(f"suf[{g},{day},{p}]")
                model.AddMaxEquality(pre, [busy[q] for q in range(1, p)])
                model.AddMaxEquality(suf, [busy[q] for q in range(p + 1, LAST_TEACHING + 1)])
                gap = model.NewBoolVar(f"gap[{g},{day},{p}]")
                model.AddBoolAnd([pre, suf, busy[p].Not()]).OnlyEnforceIf(gap)
                model.AddBoolOr([pre.Not(), suf.Not(), busy[p]]).OnlyEnforceIf(gap.Not())
                terms.append(gap)
            hours = sum(
                x[(s["id"], t)] * s["duration"]
                for s in sessions
                if g in s["groups"]
                for t in candidates[s["id"]]
                if data.day_of(t) == day
            )
            if isinstance(hours, int):
                continue
            over = model.NewIntVar(0, 45, f"over[{g},{day}]")
            model.AddMaxEquality(over, [hours - 6, 0])
            terms.append(over * 3)

    # S4: same course twice a day for a group (lectures, non-basket)
    for g in group_ids:
        for day in data.days:
            by_course: dict[str, list] = defaultdict(list)
            for s in sessions:
                if g in s["groups"] and s["kind"] == "lecture" and not s.get("basket_slot"):
                    for t in candidates[s["id"]]:
                        if data.day_of(t) == day:
                            by_course[s["course_id"]].append(x[(s["id"], t)])
            for course, xs in by_course.items():
                if len(xs) < 2:
                    continue
                extra = model.NewIntVar(0, len(xs), f"repeat[{g},{day},{course}]")
                model.AddMaxEquality(extra, [sum(xs) - 1, 0])
                terms.append(extra * 3)

    # S4 (basket lectures): the validator counts every basket session per
    # (course, day) once, independently of groups. Model that term too.
    for day in data.days:
        basket_course: dict[str, list] = defaultdict(list)
        for s in sessions:
            if s.get("basket_slot"):
                for t in candidates[s["id"]]:
                    if data.day_of(t) == day:
                        basket_course[s["course_id"]].append(x[(s["id"], t)])
        for course, xs in basket_course.items():
            if len(xs) < 2:
                continue
            extra = model.NewIntVar(0, len(xs), f"brepeat[{day},{course}]")
            model.AddMaxEquality(extra, [sum(xs) - 1, 0])
            terms.append(extra * 3)

    # S1 (avoid), S5 (low fill), S6 (P9)
    for s in sessions:
        for t in candidates[s["id"]]:
            if data.period_of(t) == 9:
                terms.append(x[(s["id"], t)])
        for r in eligible[s["id"]]:
            cap = data.rooms[r]["capacity"]
            if cap and s["size"] / cap < 0.4:
                terms.append(room_var[(s["id"], r)])
        for pref in data.faculty[s["faculty_id"]].get("preferences", []):
            if pref.get("type") != "avoid":
                continue
            days = pref.get("days", data.days)
            periods = pref.get("periods", [])
            for t in candidates[s["id"]]:
                if data.day_of(t) in days and any(p in periods for p in data.block(data.period_of(t), s["duration"])):
                    terms.append(2 * x[(s["id"], t)])

    # Minimal movement vs a baseline (disruption re-solve)
    same_vars: list = []
    if baseline:
        for s in sessions:
            sid = s["id"]
            base = baseline.get(sid)
            if not base:
                continue
            day, bstart, broom = base
            base_slot = data.slot(day, bstart)
            if base_slot not in candidates[sid] or broom not in eligible[sid]:
                continue
            same = model.NewBoolVar(f"same[{sid}]")
            model.AddBoolAnd([x[(sid, base_slot)], room_var[(sid, broom)]]).OnlyEnforceIf(same)
            model.AddBoolOr([x[(sid, base_slot)].Not(), room_var[(sid, broom)].Not()]).OnlyEnforceIf(same.Not())
            same_vars.append(same)
            model.AddHint(x[(sid, base_slot)], 1)
            model.AddHint(room_var[(sid, broom)], 1)
        terms.append(MOVE_WEIGHT * (len(same_vars) - sum(same_vars)))

    if terms:
        model.Minimize(sum(terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_seconds
    solver.parameters.num_search_workers = workers
    solver.parameters.random_seed = 1
    status = solver.Solve(model)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placements = {}
        moved = 0
        for s in sessions:
            sid = s["id"]
            slot = next(t for t in candidates[sid] if solver.Value(x[(sid, t)]) == 1)
            room = next(r for r in eligible[sid] if solver.Value(room_var[(sid, r)]) == 1)
            placements[sid] = (data.day_of(slot), data.period_of(slot), room)
            if baseline and sid in baseline and baseline[sid] != placements[sid]:
                moved += 1
        return WeeklySolution("FEASIBLE", placements, objective=float(solver.ObjectiveValue()), moved=moved)
    if status == cp_model.INFEASIBLE:
        return WeeklySolution("INFEASIBLE", detail="no feasible weekly timetable")
    return WeeklySolution("UNKNOWN", detail="time limit reached without a solution")
