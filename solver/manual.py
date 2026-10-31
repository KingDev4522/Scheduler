"""Manual placement validation (Phase 3 §10).

A manual assignment is a proposal, not a bypass: it must satisfy every hard rule
before it can be applied. This module is independent of the CP-SAT model.
"""

from __future__ import annotations

from .data import Data, LAST_TEACHING


def _overlap(day_a: str, per_a: list[int], day_b: str, per_b: list[int]) -> bool:
    return day_a == day_b and bool(set(per_a) & set(per_b))


def validate_manual(
    data: Data,
    timetable: dict[str, tuple[str, int, str]],
    session_id: str,
    day: str,
    start: int,
    room_id: str,
) -> list[str]:
    s = data.sessions.get(session_id)
    if s is None:
        return ["H1: unknown session"]
    if day not in data.day_index:
        return [f"H1: invalid day {day}"]
    periods = data.block(start, s["duration"])
    v: list[str] = []

    if periods[-1] > LAST_TEACHING:
        v.append(f"H9: {session_id} runs outside P1-P9 at P{start}")
        return v
    if periods[0] <= data.lunch_after < periods[-1]:
        v.append(f"H9: {session_id} crosses lunch")
    if s["kind"] == "lab" and start not in data.lab_starts:
        v.append(f"H9: lab {session_id} must start at P2 or P6")
    fx = s.get("fixed_slot")
    if fx and (fx["day"] != day or fx["start_period"] != start):
        v.append(f"H14: {session_id} is fixed at {fx['day']} P{fx['start_period']}")

    room = data.rooms.get(room_id)
    if room is None:
        return v + [f"H1: unknown room {room_id}"]
    if room["type"] not in s["room_types"]:
        v.append(f"H6: {room_id} is {room['type']}, needs {s['room_types']}")
    if room["capacity"] < s["size"]:
        v.append(f"H5: {room_id} seats {room['capacity']}, needs {s['size']}")
    if s.get("needs_accessible") and not room["accessible"]:
        v.append(f"H10: {room_id} is not accessible")

    for p in periods:
        if (s["faculty_id"], day, p) in data.fac_unavailable:
            v.append(f"H7: {s['faculty_id']} unavailable {day} P{p}")
        if (room_id, day, p) in data.room_unavailable:
            v.append(f"H8: {room_id} unavailable {day} P{p}")

    faculty_hours = s["duration"]
    for other_id, (o_day, o_start, o_room) in timetable.items():
        if other_id == session_id:
            continue
        other = data.sessions.get(other_id)
        if other is None:
            continue
        o_periods = data.block(o_start, other["duration"])
        if not _overlap(day, periods, o_day, o_periods):
            continue
        if o_room == room_id:
            v.append(f"H4: {room_id} already used by {other_id} at {o_day} P{o_start}")
        if other["faculty_id"] == s["faculty_id"]:
            v.append(f"H2: {s['faculty_id']} already teaches {other_id} at {o_day} P{o_start}")
        same_basket = s.get("basket_slot") and other.get("basket_slot") == s.get("basket_slot")
        if not same_basket and set(other["groups"]) & set(s["groups"]):
            v.append(f"H3: group clash with {other_id} at {o_day} P{o_start}")
        if other["faculty_id"] == s["faculty_id"] and o_day == day:
            faculty_hours += other["duration"]

    limit = data.faculty[s["faculty_id"]].get("max_hours_per_day", 4)
    if faculty_hours > limit:
        v.append(f"H12: {s['faculty_id']} would teach {faculty_hours}h on {day} (max {limit})")

    if s.get("basket_slot"):
        for other_id, (o_day, o_start, _o_room) in timetable.items():
            if other_id == session_id or not data.sessions.get(other_id, {}).get("basket_slot"):
                continue
            if data.sessions[other_id]["basket_slot"] == s["basket_slot"]:
                if (o_day, o_start) != (day, start):
                    v.append(f"H11: basket {s['basket_slot']} must share one slot ({other_id})")

    return v


def apply_manual(
    data: Data,
    timetable: dict[str, tuple[str, int, str]],
    session_id: str,
    day: str,
    start: int,
    room_id: str,
) -> tuple[bool, dict[str, tuple[str, int, str]], list[str]]:
    violations = validate_manual(data, timetable, session_id, day, start, room_id)
    if violations:
        return False, dict(timetable), violations
    updated = dict(timetable)
    updated[session_id] = (day, start, room_id)
    return True, updated, []
