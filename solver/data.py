"""Official dataset loader and helpers for the Phase 2 CP-SAT engine.

Reads `CrunchWeek_StarterPack/data/cit_public.json`. Field names and rules come
from the starter README and validator.py; nothing is inferred.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

LAST_TEACHING = 9
MAX_PERIOD = 13
CAT_WEIGHT = {"institute_event": 5, "guest_lecture": 4, "department_event": 3, "club_event": 2}


class Data:
    def __init__(self, raw: dict[str, Any]) -> None:
        self.raw = raw
        cal = raw["calendar"]
        self.days: list[str] = cal["days"]
        self.day_index = {d: i for i, d in enumerate(self.days)}
        self.lunch_after: int = cal["lunch"]["after_period"]
        self.lab_starts: set[int] = set(cal["lab_start_periods"])
        self.exam_days: list[str] = cal["exam_week"]["days"]
        self.exam_sessions: list[str] = [s["id"] for s in cal["exam_week"]["sessions"]]
        self.rooms: dict[str, dict] = {r["id"]: r for r in raw["rooms"]}
        self.faculty: dict[str, dict] = {f["id"]: f for f in raw["faculty"]}
        self.groups: dict[str, dict] = {g["id"]: g for g in raw["student_groups"]}
        self.courses: dict[str, dict] = {c["id"]: c for c in raw["courses"]}
        self.sessions: dict[str, dict] = {s["id"]: s for s in raw["sessions"]}
        self.exams: dict[str, dict] = {e["id"]: e for e in raw["exams"]}
        self.requests: dict[str, dict] = {b["id"]: b for b in raw["booking_requests"]}
        self.cancelled: set[str] = {c["request_id"] for c in raw.get("cancellations", [])}
        self.priority_order: list[str] = raw["priority_order"]
        self.role_cap: dict[str, str] = raw["role_category_cap"]
        self.fac_unavailable: set[tuple[str, str, int]] = set()
        for f in raw["faculty"]:
            for u in f.get("unavailable", []):
                for p in u["periods"]:
                    self.fac_unavailable.add((f["id"], u["day"], p))
        self.room_unavailable: set[tuple[str, str, int]] = set()
        for u in raw.get("room_unavailability", []):
            for p in u["periods"]:
                self.room_unavailable.add((u["room_id"], u["day"], p))

    # -- time -------------------------------------------------------------
    def slot(self, day: str, start: int) -> int:
        return self.day_index[day] * LAST_TEACHING + (start - 1)

    def day_of(self, slot: int) -> str:
        return self.days[slot // LAST_TEACHING]

    def period_of(self, slot: int) -> int:
        return slot % LAST_TEACHING + 1

    def block(self, start: int, duration: int) -> list[int]:
        return list(range(start, start + duration))

    def legal_starts(self, duration: int, kind: str) -> list[int]:
        out: list[int] = []
        for start in range(1, LAST_TEACHING + 1):
            per = self.block(start, duration)
            if per[-1] > LAST_TEACHING:
                continue
            if per[0] <= self.lunch_after < per[-1]:
                continue
            if kind == "lab" and start not in self.lab_starts:
                continue
            out.append(start)
        return out

    def candidate_slots(self, s: dict) -> list[int]:
        """Global slots a session may use (H9 + H7 + fixed_slot)."""
        starts = self.legal_starts(s["duration"], s["kind"])
        out: list[int] = []
        for day in self.days:
            for start in starts:
                if s.get("fixed_slot") and (
                    s["fixed_slot"]["day"] != day or s["fixed_slot"]["start_period"] != start
                ):
                    continue
                if any((s["faculty_id"], day, p) in self.fac_unavailable for p in self.block(start, s["duration"])):
                    continue
                out.append(self.slot(day, start))
        return out

    def eligible_rooms(self, s: dict) -> list[str]:
        """Rooms matching type + capacity + accessibility (what the validator checks)."""
        out = []
        for r in self.rooms.values():
            if r["type"] not in s["room_types"]:
                continue
            if r["capacity"] < s["size"]:
                continue
            if s.get("needs_accessible") and not r["accessible"]:
                continue
            out.append(r["id"])
        return out

    def exam_rooms(self) -> list[str]:
        return [r["id"] for r in self.rooms.values() if "exam" in r["allowed_uses"]]

    def exam_half_capacity(self, room_id: str) -> int:
        return self.rooms[room_id]["capacity"] // 2

    def effective_category(self, req: dict) -> str:
        cap = self.role_cap.get(req["role"], "club_event")
        order = self.priority_order
        a = order.index(req["requested_category"]) if req["requested_category"] in order else len(order) - 1
        return order[max(a, order.index(cap))]

    def outranks(self, r1: dict, r2: dict) -> bool:
        order = self.priority_order
        c1, c2 = order.index(self.effective_category(r1)), order.index(self.effective_category(r2))
        if c1 != c2:
            return c1 < c2
        return r1["submitted_at"] < r2["submitted_at"]


def load(path: str | Path) -> Data:
    return Data(json.loads(Path(path).read_text(encoding="utf-8")))
