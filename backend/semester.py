"""Derived semester calendar (app-level only).

The official dataset has no dates: sessions and booking windows use weekday +
period, and the only real timestamps are the booking-request `submitted_at`
values and the Spectra cancellation. This module derives a display calendar
(week numbers → dates) from those timestamps so the UI can show *which* week a
booking is for. It never changes the dataset schema, the solver or the validator.
"""

from __future__ import annotations

import os
import re
from datetime import date, datetime, timedelta
from typing import Any

DEFAULT_FEST_WEEK = 7
# Term start (Week 1 Monday). The dataset has no dates, so this is a display
# setting; override with the SEMESTER_START_DATE env var.
DEFAULT_TERM_START = "2026-11-02"
DAYS = ("MON", "TUE", "WED", "THU", "FRI")
ASSUMPTION = (
    "Week numbers use the configured term start (Week 1 = Mon 2 Nov 2026). "
    "Set SEMESTER_START_DATE to change it; the dataset ships no dates."
)


def _parse_day(value: Any) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        pass
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _monday_of(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _fest_week(raw: dict[str, Any]) -> int:
    label = (raw.get("calendar") or {}).get("fest_week")
    if isinstance(label, str):
        match = re.search(r"week\s*(\d+)", label, re.IGNORECASE)
        if match:
            return int(match.group(1))
    return DEFAULT_FEST_WEEK


def _anchor_monday(raw: dict[str, Any]) -> date | None:
    """Monday of the week that contains the Spectra cancellation."""
    for cancellation in raw.get("cancellations") or []:
        day = _parse_day(cancellation.get("cancelled_at"))
        if day is not None:
            return _monday_of(day)
    stamps = sorted(
        filter(None, (_parse_day(req.get("submitted_at")) for req in raw.get("booking_requests") or []))
    )
    if stamps:
        # Requests arrive roughly a fortnight before the fest week.
        return _monday_of(stamps[-1]) + timedelta(weeks=2)
    return None


def _term_start(raw: dict[str, Any], fest_week: int) -> date | None:
    """Configured Week-1 Monday, else the dataset-derived Spectra anchor."""
    configured = (os.getenv("SEMESTER_START_DATE") or DEFAULT_TERM_START).strip()
    parsed = _parse_day(configured)
    if parsed is not None:
        return _monday_of(parsed)
    anchor = _anchor_monday(raw)
    if anchor is None:
        return None
    return anchor - timedelta(weeks=fest_week - 1)


def derive_semester(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return the display calendar, or None when no term start can be determined."""
    if not raw:
        raw = {}
    fest_week = _fest_week(raw)
    start = _term_start(raw, fest_week)
    if start is None:
        return None

    anchor = start + timedelta(weeks=fest_week - 1)
    exam_week = fest_week + 1
    weeks = []
    for number in range(1, exam_week + 1):
        monday = start + timedelta(weeks=number - 1)
        friday = monday + timedelta(days=4)
        phase = "spectra" if number == fest_week else "exams" if number == exam_week else "teaching"
        weeks.append(
            {
                "number": number,
                "monday": monday.isoformat(),
                "friday": friday.isoformat(),
                "phase": phase,
            }
        )

    return {
        "fest_week": fest_week,
        "exam_week": exam_week,
        "anchor_date": anchor.isoformat(),
        "semester_start": start.isoformat(),
        "semester_end": weeks[-1]["friday"] if weeks else None,
        "weeks": weeks,
        "assumption": ASSUMPTION,
    }


def weeks_for_dates(semester: dict[str, Any] | None, dates: list[str]) -> list[int]:
    if not semester:
        return []
    out: list[int] = []
    for value in dates:
        day = _parse_day(value)
        if day is None:
            continue
        for week in semester.get("weeks", []):
            monday = _parse_day(week["monday"])
            if monday is None:
                continue
            if monday <= day <= monday + timedelta(days=6):
                if week["number"] not in out:
                    out.append(week["number"])
                break
    return sorted(out)
