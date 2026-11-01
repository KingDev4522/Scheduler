"""CP-SAT examination scheduler for the official dataset.

Exam week is calendar.exam_week.days x sessions (AM/PM). Rooms seat half their
capacity; an exam may use several rooms; no group sits two exams at once.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from .data import Data


@dataclass
class ExamSolution:
    status: str
    placements: dict[str, tuple[str, str, list[str]]] = field(default_factory=dict)
    detail: str = ""


def solve_exams(data: Data, *, max_seconds: float = 60.0, workers: int = 8) -> ExamSolution:
    exams = list(data.exams.values())
    exam_rooms = data.exam_rooms()
    slots = [(d, s) for d in data.exam_days for s in data.exam_sessions]
    exam_periods = {"AM": [2, 3, 4], "PM": [6, 7, 8]}
    allowed_by_slot: dict[tuple[str, str], list[str]] = {}
    for day, session in slots:
        periods = exam_periods.get(session, [])
        allowed_by_slot[(day, session)] = [
            room
            for room in exam_rooms
            if not any((room, day, period) in data.room_unavailable for period in periods)
        ]

    model = cp_model.CpModel()
    x = {}
    for e in exams:
        for slot in slots:
            x[(e["id"], slot)] = model.NewBoolVar(f"x[{e['id']},{slot}]")
        model.AddExactlyOne(x[(e["id"], slot)] for slot in slots)

    y = {}
    for e in exams:
        for slot in slots:
            allowed = allowed_by_slot[slot]
            for r in allowed:
                y[(e["id"], slot, r)] = model.NewBoolVar(f"y[{e['id']},{slot},{r}]")
                model.AddImplication(y[(e["id"], slot, r)], x[(e["id"], slot)])
            model.Add(sum(y[(e["id"], slot, r)] for r in allowed) >= x[(e["id"], slot)])
            seats = sum(data.exam_half_capacity(r) * y[(e["id"], slot, r)] for r in allowed)
            model.Add(seats >= e["size"] * x[(e["id"], slot)])

    # A room hosts at most one exam per slot.
    for slot in slots:
        for r in allowed_by_slot[slot]:
            model.Add(sum(y[(e["id"], slot, r)] for e in exams) <= 1)

    # A group sits at most one exam per slot; at most one per day is soft.
    by_group: dict[str, list[dict]] = defaultdict(list)
    for e in exams:
        for g in e["groups"]:
            by_group[g].append(e)
    for g, es in by_group.items():
        for slot in slots:
            model.Add(sum(x[(e["id"], slot)] for e in es) <= 1)

    # Objective: finish early, and avoid two exams for a group on one day.
    last_day = model.NewIntVar(0, len(data.exam_days), "last_day")
    for e in exams:
        for slot in slots:
            model.Add(last_day >= data.exam_days.index(slot[0]) * x[(e["id"], slot)])
    penalty = [last_day * 1]
    for g, es in by_group.items():
        for day in data.exam_days:
            day_slots = [s for s in slots if s[0] == day]
            count = sum(x[(e["id"], slot)] for e in es for slot in day_slots)
            over = model.NewIntVar(0, len(es), f"over[{g},{day}]")
            model.AddMaxEquality(over, [count - 1, 0])
            penalty.append(over * 5)
    model.Minimize(sum(penalty))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_seconds
    solver.parameters.num_search_workers = workers
    solver.parameters.random_seed = 1
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return ExamSolution("INFEASIBLE" if status == cp_model.INFEASIBLE else "UNKNOWN")

    placements = {}
    for e in exams:
        slot = next(s for s in slots if solver.Value(x[(e["id"], s)]) == 1)
        rooms = [
            r
            for r in allowed_by_slot[slot]
            if solver.Value(y[(e["id"], slot, r)]) == 1
        ]
        placements[e["id"]] = (slot[0], slot[1], rooms)
    return ExamSolution("FEASIBLE", placements)
