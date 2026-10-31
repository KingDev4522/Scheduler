"""Deterministic validation for manual / assistant booking requests.

The Gemini draft is untrusted input; this module decides whether a proposed
booking is physically possible. It never calls an LLM.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from .data import Data


@dataclass
class BookingProposal:
    title: str
    requester: str
    role: str
    attendance: int
    duration_periods: int
    windows: list[dict[str, Any]] = field(default_factory=list)
    room_types: list[str] = field(default_factory=list)
    needs: list[str] = field(default_factory=list)
    requested_room: str | None = None
    mandatory_for_groups: list[str] = field(default_factory=list)
    raw_text: str = ""
    requested_category: str | None = None
    day: str | None = None
    start_period: int | None = None

    def category(self, data: Data) -> str:
        cap = data.role_cap.get(self.role, "club_event")
        order = data.priority_order
        requested = self.requested_category or cap
        index = order.index(requested) if requested in order else len(order) - 1
        return order[max(index, order.index(cap))]

    def as_official(self, data: Data, request_id: str, submitted_at: str) -> dict[str, Any]:
        return {
            "id": request_id,
            "submitted_at": submitted_at,
            "requester": self.requester,
            "role": self.role,
            "department": None,
            "requested_category": self.category(data),
            "title": self.title,
            "attendance": self.attendance,
            "duration_periods": self.duration_periods,
            "windows": self.windows,
            "room_types": self.room_types,
            "needs": self.needs,
            "requested_room": self.requested_room,
            "mandatory_for_groups": self.mandatory_for_groups,
            "series_id": None,
            "raw_text": self.raw_text or self.title,
        }


def _occupancy(
    data: Data, timetable: dict[str, tuple[str, int, str]]
) -> tuple[dict[tuple[str, str, int], list[str]], dict[tuple[str, str, int], list[str]]]:
    room_busy: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    group_busy: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    for session_id, (day, start, room) in timetable.items():
        session = data.sessions.get(session_id)
        if not session:
            continue
        for period in data.block(start, session["duration"]):
            room_busy[(room, day, period)].append(session_id)
            for group in session["groups"]:
                group_busy[(group, day, period)].append(session_id)
    return room_busy, group_busy


def _room_ok(data: Data, proposal: BookingProposal, room: dict, duration: int) -> list[str]:
    violations: list[str] = []
    if "event" not in room["allowed_uses"]:
        violations.append(f"ROOM_USE: {room['id']} cannot host events")
    if room["type"] not in proposal.room_types:
        violations.append(f"ROOM_TYPE: {room['id']} ({room['type']}) is not one of {proposal.room_types}")
    if room["capacity"] < proposal.attendance:
        violations.append(f"CAPACITY: {room['id']} seats {room['capacity']}, needs {proposal.attendance}")
    features = set(room.get("features", [])) | ({"accessible"} if room["accessible"] else set())
    missing = set(proposal.needs) - features
    if missing:
        violations.append(f"FEATURES: {room['id']} lacks {sorted(missing)}")
    return violations


def validate_booking(
    data: Data,
    timetable: dict[str, tuple[str, int, str]],
    proposal: BookingProposal,
    approved_bookings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    violations: list[str] = []

    if proposal.attendance <= 0:
        violations.append("ATTENDANCE: must be positive")
    if not (1 <= proposal.duration_periods <= 13):
        violations.append("DURATION: must be 1..13 periods")
    if not proposal.windows:
        violations.append("WINDOW: at least one day/time window is required")
    if not proposal.room_types:
        violations.append("ROOM_TYPES: at least one room type is required")

    room_busy, group_busy = _occupancy(data, timetable)
    for booking in approved_bookings or []:
        room = booking.get("room_id")
        day = booking.get("day")
        start = booking.get("start_period")
        end = booking.get("end_period")
        if not (room and day and isinstance(start, int) and isinstance(end, int)):
            continue
        for period in range(start, end + 1):
            room_busy[(room, day, period)].append(str(booking.get("request_id", "booking")))

    def check(room_id: str, day: str, start: int) -> list[str]:
        issues: list[str] = []
        periods = data.block(start, proposal.duration_periods)
        if not periods or periods[0] < 1 or periods[-1] > 13:
            return [f"TIME: P{start} with duration {proposal.duration_periods} is outside P1-P13"]
        inside = any(
            window["day"] == day
            and window["from_period"] <= start
            and periods[-1] <= window["to_period"]
            for window in proposal.windows
        )
        if not inside:
            issues.append("WINDOW: the slot is outside every requested window")
        room = data.rooms.get(room_id)
        if room is None:
            return issues + [f"ROOM: unknown room {room_id}"]
        issues += _room_ok(data, proposal, room, proposal.duration_periods)
        for period in periods:
            if (room_id, day, period) in data.room_unavailable:
                issues.append(f"OUTAGE: {room_id} unavailable {day} P{period}")
            if room_busy.get((room_id, day, period)):
                issues.append(f"ROOM_CLASH: {room_id} used {day} P{period}")
            for group in proposal.mandatory_for_groups:
                if group_busy.get((group, day, period)):
                    issues.append(f"GROUP_CLASH: {group} has class {day} P{period}")
        return issues

    target_room = proposal.requested_room
    if target_room and proposal.day and isinstance(proposal.start_period, int):
        issues = check(target_room, proposal.day, proposal.start_period)
        return {"ok": not issues, "violations": issues, "alternatives": []}

    alternatives: list[dict[str, Any]] = []
    seen: set[tuple[str, str, int]] = set()
    rooms = sorted(
        data.rooms.values(),
        key=lambda item: (item["id"] != proposal.requested_room, item["capacity"]),
    )
    for window in proposal.windows:
        day = window["day"]
        if day not in data.day_index:
            continue
        last = min(window["to_period"], 13) - proposal.duration_periods + 1
        for start in range(window["from_period"], last + 1):
            for room in rooms:
                if _room_ok(data, proposal, room, proposal.duration_periods):
                    continue
                key = (room["id"], day, start)
                if key in seen:
                    continue
                issues = check(room["id"], day, start)
                if issues:
                    continue
                seen.add(key)
                alternatives.append(
                    {
                        "room_id": room["id"],
                        "day": day,
                        "start_period": start,
                        "end_period": start + proposal.duration_periods - 1,
                        "capacity": room["capacity"],
                        "type": room["type"],
                    }
                )
                if len(alternatives) >= 8:
                    break
            if len(alternatives) >= 8:
                break
        if len(alternatives) >= 8:
            break

    if not alternatives:
        violations.append("NO_SLOT: no eligible room and time satisfies the constraints")
    return {"ok": False, "violations": violations, "alternatives": alternatives}
