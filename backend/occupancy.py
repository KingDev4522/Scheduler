"""Occupancy and conflict computation for bookings and session changes.

This is the read-only "what is already here?" layer used by the manual form,
the assistant and the admin room view. It never writes data; the deterministic
validator is still the gate before anything is applied.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from solver.data import Data
from solver.manual import suggest_session_alternatives, validate_manual

from .semester import derive_semester, weeks_for_dates

DAY_CODES = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
EXAM_PERIODS = {"AM": [2, 3, 4], "PM": [6, 7, 8]}
SEVERITY = ("free", "warning", "blocked")


def _parse_day(value: Any) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _block(start: int, duration: int) -> list[int]:
    return list(range(start, start + max(duration, 0)))


def _overlap(start_a: int, duration_a: int, start_b: int, duration_b: int) -> bool:
    if duration_a <= 0 or duration_b <= 0:
        return False
    return start_a <= start_b + duration_b - 1 and start_b <= start_a + duration_a - 1


def _course_title(data: Data, course_id: str) -> str:
    return str(data.courses.get(course_id, {}).get("title") or course_id)


def _faculty_name(data: Data, faculty_id: str) -> str:
    return str(data.faculty.get(faculty_id, {}).get("name") or faculty_id)


def _group_names(data: Data, groups: list[str]) -> str:
    return ", ".join(str(data.groups.get(group, {}).get("name") or group) for group in groups)


def _room_name(data: Data, room_id: str) -> str:
    return str(data.rooms.get(room_id, {}).get("name") or room_id)


def _entry(
    kind: str,
    title: str,
    detail: str,
    *,
    severity: str,
    periods: list[int] | None = None,
    owner: str | None = None,
    status: str | None = None,
    source_id: str | None = None,
) -> dict[str, Any]:
    return {
        "kind": kind,
        "title": title,
        "detail": detail,
        "severity": severity,
        "periods": periods or [],
        "owner": owner,
        "status": status,
        "source_id": source_id,
    }


def _severity(entries: list[dict[str, Any]]) -> str:
    if any(entry["severity"] == "blocked" for entry in entries):
        return "blocked"
    if any(entry["severity"] == "warning" for entry in entries):
        return "warning"
    return "free"


def _message(severity: str, entries: list[dict[str, Any]], room: dict | None) -> str:
    if severity == "free":
        if room:
            return f"Free · {room['name']} · {room['capacity']} seats · {room['type']}"
        return "Free at this slot."
    parts = []
    for entry in entries:
        if entry["severity"] == "free":
            continue
        prefix = "Blocked" if entry["severity"] == "blocked" else "Warning"
        parts.append(f"{prefix}: {entry['title']} — {entry['detail']}")
    return " · ".join(parts) if parts else "No conflicts."


def _maintenance_blocks(data: Data) -> list[dict[str, Any]]:
    return list((data.raw or {}).get("room_unavailability") or [])


def _occupancy_for_room(
    data: Data,
    placements: dict[str, tuple[str, int, str]],
    decisions: list[dict[str, Any]],
    submissions: list[dict[str, Any]],
    schedule: dict[str, Any] | None,
    *,
    week: int | None,
    weekday: str,
    room_id: str,
    from_period: int,
    to_period: int,
    attendance: int | None,
    room_types: list[str],
    needs: list[str],
    mandatory_groups: list[str],
) -> list[dict[str, Any]]:
    duration = max(1, to_period - from_period + 1)
    entries: list[dict[str, Any]] = []
    room = data.rooms.get(room_id)

    # Teaching sessions (repeat every teaching week).
    semester_now = derive_semester(data.raw)
    if week is not None and (semester_now is None or week != semester_now["exam_week"]):
        for session_id, (day, start, placed_room) in placements.items():
            if placed_room != room_id or day != weekday:
                continue
            session = data.sessions.get(session_id)
            if not session or not _overlap(start, session["duration"], from_period, duration):
                continue
            fixed = " · fixed slot" if session.get("fixed_slot") else ""
            entries.append(
                _entry(
                    "class",
                    f"{_course_title(data, session['course_id'])} ({session['course_id']})",
                    f"{_faculty_name(data, session['faculty_id'])} · {_group_names(data, session['groups'])}"
                    f" · P{start}–P{start + session['duration'] - 1}{fixed}",
                    severity="blocked",
                    periods=_block(start, session["duration"]),
                    owner=session["faculty_id"],
                    status="scheduled",
                    source_id=session_id,
                )
            )

    # Mandatory groups must be free even if the room itself is free.
    if mandatory_groups:
        for session_id, (day, start, placed_room) in placements.items():
            if day != weekday:
                continue
            session = data.sessions.get(session_id)
            if not session or not set(session["groups"]) & set(mandatory_groups):
                continue
            if not _overlap(start, session["duration"], from_period, duration):
                continue
            entries.append(
                _entry(
                    "group",
                    f"{_group_names(data, session['groups'])} has {_course_title(data, session['course_id'])}",
                    f"{_faculty_name(data, session['faculty_id'])} · {_room_name(data, placed_room)}"
                    f" · P{start}–P{start + session['duration'] - 1}",
                    severity="blocked",
                    periods=_block(start, session["duration"]),
                    source_id=session_id,
                )
            )

    semester = derive_semester(data.raw)
    fest_week = semester["fest_week"] if semester else None
    exam_week = semester["exam_week"] if semester else None

    # Official Spectra decisions (only in their own week).
    if week is not None and week == fest_week:
        for decision in decisions:
            if decision.get("room_id") != room_id or decision.get("day") != weekday:
                continue
            start = decision.get("start_period")
            end = decision.get("end_period")
            if not isinstance(start, int) or not isinstance(end, int):
                continue
            if not _overlap(start, end - start + 1, from_period, duration):
                continue
            request = data.requests.get(str(decision.get("request_id")), {})
            status = str(decision.get("status") or "approved")
            entries.append(
                _entry(
                    "event",
                    str(request.get("title") or decision.get("request_id") or "Official event"),
                    f"{request.get('requester', '—')} · {status.replace('_', ' ')} · P{start}–P{end}",
                    severity="blocked" if status == "approved" else "warning",
                    periods=_block(start, end - start + 1),
                    owner=request.get("requester"),
                    status=status,
                    source_id=str(decision.get("request_id") or ""),
                )
            )

    # Ad-hoc submissions. Dates/weeks are app-level; fall back to weekday.
    for submission in submissions:
        status = str(submission.get("status") or "pending")
        if status not in ("pending", "approved", "alternative_offered"):
            continue
        if submission.get("room_id") != room_id and submission.get("requested_room") != room_id:
            continue
        if submission.get("day") != weekday:
            continue
        weeks = submission.get("weeks") or []
        dates = submission.get("dates") or []
        if week is not None and weeks and week not in weeks:
            continue
        if week is not None and dates and not weeks:
            derived = weeks_for_dates(semester, [str(item) for item in dates])
            if derived and week not in derived:
                continue
        start = submission.get("start_period")
        end = submission.get("end_period")
        if not isinstance(start, int):
            continue
        duration_sub = (end - start + 1) if isinstance(end, int) else 1
        if not _overlap(start, duration_sub, from_period, duration):
            continue
        label = "approved" if status == "approved" else "pending" if status == "pending" else "alternative offered"
        entries.append(
            _entry(
                "submission",
                str(submission.get("title") or submission.get("id") or "Request"),
                f"{submission.get('requester', '—')} · {label} · P{start}–P{start + duration_sub - 1}",
                severity="blocked" if status == "approved" else "warning",
                periods=_block(start, duration_sub),
                owner=str(submission.get("requester") or ""),
                status=status,
                source_id=str(submission.get("id") or ""),
            )
        )

    # Exams (exam week only). Bookings are closed for the whole week.
    if week is not None and week == exam_week:
        if isinstance(schedule, dict):
            for exam in schedule.get("exams") or []:
                if exam.get("day") != weekday or room_id not in (exam.get("rooms") or []):
                    continue
                periods = EXAM_PERIODS.get(str(exam.get("session")), [])
                if not any(period in _block(from_period, duration) for period in periods):
                    continue
                definition = data.exams.get(str(exam.get("exam_id")), {})
                entries.append(
                    _entry(
                        "exam",
                        f"Midsem exam {exam.get('exam_id')}",
                        f"{', '.join(definition.get('course_ids', []))} · {exam.get('session')} session",
                        severity="blocked",
                        periods=periods,
                        status="exam",
                        source_id=str(exam.get("exam_id") or ""),
                    )
                )
        entries.append(
            _entry(
                "exam_week",
                "Midsem exam week",
                "Venue bookings are closed during the exam week.",
                severity="blocked",
                periods=_block(from_period, duration),
                status="exam",
            )
        )

    # Maintenance and permanent room blocks (repeat by weekday/period).
    for block in _maintenance_blocks(data):
        if block.get("room_id") != room_id or block.get("day") != weekday:
            continue
        periods = [int(period) for period in block.get("periods") or [] if isinstance(period, int)]
        if not set(periods) & set(_block(from_period, duration)):
            continue
        entries.append(
            _entry(
                "maintenance",
                "Room blocked",
                str(block.get("reason") or "Permanent room allocation / maintenance"),
                severity="blocked",
                periods=periods,
                status="unavailable",
            )
        )

    # Room fit rules (only when a concrete room is chosen).
    if room is not None:
        if attendance is not None and attendance > int(room["capacity"]):
            entries.append(
                _entry(
                    "capacity",
                    "Attendance exceeds room capacity",
                    f"{attendance} people vs {room['capacity']} seats",
                    severity="blocked",
                )
            )
        if room_types and room["type"] not in room_types:
            entries.append(
                _entry(
                    "type",
                    "Wrong room type",
                    f"{room['name']} is {room['type']}, requested {', '.join(room_types)}",
                    severity="blocked",
                )
            )
        if "event" not in (room.get("allowed_uses") or []):
            entries.append(
                _entry(
                    "use",
                    "Room cannot host events",
                    f"{room['name']} is limited to {', '.join(room.get('allowed_uses') or [])}",
                    severity="blocked",
                )
            )
        features = set(room.get("features") or []) | ({"accessible"} if room.get("accessible") else set())
        missing = sorted(set(needs) - features)
        if missing:
            entries.append(
                _entry(
                    "features",
                    "Missing facilities",
                    f"{room['name']} lacks {', '.join(missing)}",
                    severity="blocked",
                )
            )

    return entries


def build_availability(
    data: Data,
    placements: dict[str, tuple[str, int, str]] | None,
    decisions: list[dict[str, Any]] | None,
    submissions: list[dict[str, Any]] | None,
    schedule: dict[str, Any] | None,
    *,
    dates: list[str],
    from_period: int,
    to_period: int,
    room_id: str | None = None,
    room_types: list[str] | None = None,
    attendance: int | None = None,
    needs: list[str] | None = None,
    mandatory_groups: list[str] | None = None,
) -> dict[str, Any]:
    semester = derive_semester(data.raw)
    placements = placements or {}
    decisions = decisions or []
    submissions = submissions or []
    room_types = [value for value in (room_types or []) if value]
    needs = [value for value in (needs or []) if value]
    mandatory_groups = [value for value in (mandatory_groups or []) if value]
    checks: list[dict[str, Any]] = []

    for raw_date in dates:
        day = _parse_day(raw_date)
        if day is None:
            checks.append(
                {"date": raw_date, "severity": "blocked", "message": "Invalid date.", "entries": []}
            )
            continue
        weekday = DAY_CODES[day.weekday()]
        if weekday not in data.days:
            checks.append(
                {
                    "date": day.isoformat(),
                    "week": None,
                    "day": weekday,
                    "severity": "blocked",
                    "message": "Teaching weeks run Monday to Friday.",
                    "entries": [],
                }
            )
            continue
        weeks = weeks_for_dates(semester, [day.isoformat()])
        week = weeks[0] if weeks else None
        if semester and week is None:
            checks.append(
                {
                    "date": day.isoformat(),
                    "week": None,
                    "day": weekday,
                    "severity": "blocked",
                    "message": f"This date is outside the semester calendar (weeks 1–{semester['exam_week']}).",
                    "entries": [],
                }
            )
            continue

        candidate_ids = [room_id] if room_id else [
            rid for rid, room in data.rooms.items() if not room_types or room["type"] in room_types
        ]
        selected = None
        candidates: list[dict[str, Any]] = []
        for rid in candidate_ids:
            if rid not in data.rooms:
                entries = [_entry("room", "Unknown room", str(rid), severity="blocked")]
            else:
                entries = _occupancy_for_room(
                    data,
                    placements,
                    decisions,
                    submissions,
                    schedule,
                    week=week,
                    weekday=weekday,
                    room_id=rid,
                    from_period=from_period,
                    to_period=to_period,
                    attendance=attendance,
                    room_types=room_types,
                    needs=needs,
                    mandatory_groups=mandatory_groups,
                )
            severity = _severity(entries)
            room = data.rooms.get(rid)
            record = {
                "room_id": rid,
                "room_name": room["name"] if room else rid,
                "capacity": room["capacity"] if room else None,
                "type": room["type"] if room else None,
                "severity": severity,
                "message": _message(severity, entries, room),
                "entries": entries,
            }
            if room_id:
                selected = record
            else:
                candidates.append(record)

        if selected is not None:
            checks.append(
                {
                    "date": day.isoformat(),
                    "week": week,
                    "day": weekday,
                    **selected,
                }
            )
        else:
            candidates.sort(key=lambda item: (item["severity"] != "free", -(item["capacity"] or 0)))
            if any(item["severity"] == "free" for item in candidates):
                aggregate = "free"
            elif any(item["severity"] == "warning" for item in candidates):
                aggregate = "warning"
            else:
                aggregate = "blocked"
            checks.append(
                {
                    "date": day.isoformat(),
                    "week": week,
                    "day": weekday,
                    "severity": aggregate if candidates else "blocked",
                    "message": (
                        f"{sum(1 for item in candidates if item['severity'] == 'free')} of "
                        f"{len(candidates)} matching rooms are free."
                        if candidates
                        else "No rooms match the requested type."
                    ),
                    "candidates": candidates[:12],
                    "entries": [],
                }
            )
    return {"checks": checks}


def build_session_availability(
    data: Data,
    placements: dict[str, tuple[str, int, str]] | None,
    *,
    session_id: str,
    day: str,
    start: int,
    room_id: str,
) -> dict[str, Any]:
    placements = placements or {}
    session = data.sessions.get(session_id)
    if session is None:
        return {"ok": False, "blocked": [{"rule": "H1", "detail": "unknown session"}], "warnings": [], "alternatives": []}
    violations = validate_manual(data, placements, session_id, day, start, room_id)
    blocked = [
        {"rule": violation.split(":", 1)[0].strip(), "detail": violation} for violation in violations
    ]
    warnings: list[str] = []
    periods = _block(start, session["duration"])

    # Soft checks (mirror the validator's S1-S6 intent).
    for preference in data.faculty.get(session["faculty_id"], {}).get("preferences", []):
        if preference.get("type") != "avoid":
            continue
        days = preference.get("days") or data.days
        avoid_periods = set(preference.get("periods") or [])
        if day in days and set(periods) & avoid_periods:
            warnings.append(
                f"{_faculty_name(data, session['faculty_id'])} prefers to avoid {day} P{start}"
            )
    for group in session["groups"]:
        load = 0
        for other_id, (other_day, _other_start, _other_room) in placements.items():
            if other_id == session_id or other_day != day:
                continue
            other = data.sessions.get(other_id)
            if other and group in other.get("groups", []):
                load += other["duration"]
        if load + session["duration"] > 6:
            warnings.append(f"{_group_names(data, [group])} would have {load + session['duration']}h on {day} (soft limit 6h)")
    room = data.rooms.get(room_id)
    if room and room["capacity"] and session["size"] / room["capacity"] < 0.4:
        warnings.append(f"{room['name']} would be under 40% full")
    if 9 in periods:
        warnings.append("P9 (17:00) is a soft penalty slot (S6)")
    for other_id, (other_day, other_start, _room) in placements.items():
        if other_id == session_id or other_day != day:
            continue
        other = data.sessions.get(other_id)
        if (
            other
            and other["course_id"] == session["course_id"]
            and set(other["groups"]) & set(session["groups"])
            and other_start != start
        ):
            warnings.append(f"{_course_title(data, session['course_id'])} would run twice on {day}")

    alternatives = (
        suggest_session_alternatives(data, placements, session_id) if blocked else []
    )
    return {
        "ok": not blocked,
        "blocked": blocked,
        "warnings": list(dict.fromkeys(warnings)),
        "alternatives": alternatives,
        "current": placements.get(session_id),
    }
