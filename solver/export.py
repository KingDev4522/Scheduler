"""Build official `schedule.json` documents."""

from __future__ import annotations

import json
import os
from pathlib import Path

from .data import Data

TEAM = "CIT Scheduler"
DATASET_ID = "cit-public-v1"


def build_schedule(
    data: Data,
    timetable: dict[str, tuple[str, int, str]],
    decisions: list[dict],
    exams: dict[str, tuple[str, str, list[str]]],
) -> dict:
    return {
        "team": os.getenv("TEAM_NAME", TEAM),
        "dataset_id": data.raw.get("dataset_id", DATASET_ID),
        "sessions": [
            {"session_id": sid, "day": day, "start_period": start, "room_id": room}
            for sid, (day, start, room) in sorted(timetable.items())
        ],
        "fest_week": {"bookings": decisions, "session_overrides": []},
        "exams": [
            {"exam_id": eid, "day": day, "session": session, "rooms": rooms}
            for eid, (day, session, rooms) in sorted(exams.items())
        ],
    }


def write_schedule(path: str | Path, schedule: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(schedule, indent=2), encoding="utf-8")


def apply_disruption(raw: dict, disruption: dict) -> tuple[dict, set, set, list[dict], set[str]]:
    """Return (disrupted_raw, extra_faculty_unavailable, extra_room_unavailable, added_sessions, removed_ids)."""
    import copy

    d = copy.deepcopy(raw)
    fac = {f["id"]: f for f in d["faculty"]}
    extra_fac: set[tuple[str, str, int]] = set()
    extra_room: set[tuple[str, str, int]] = set()
    added: list[dict] = []
    removed: set[str] = set()
    for change in disruption.get("changes", []):
        kind = change["type"]
        if kind == "faculty_unavailable":
            for day in change["days"]:
                fac[change["faculty_id"]]["unavailable"].append(
                    {"day": day, "periods": change["periods"], "reason": change.get("reason", "")}
                )
                for p in change["periods"]:
                    extra_fac.add((change["faculty_id"], day, p))
        elif kind == "room_unavailable":
            for day in change["days"]:
                d["room_unavailability"].append(
                    {"room_id": change["room_id"], "day": day, "periods": change["periods"], "reason": change.get("reason", "")}
                )
                for p in change["periods"]:
                    extra_room.add((change["room_id"], day, p))
        elif kind == "add_faculty":
            d["faculty"].append(change["faculty"])
            fac[change["faculty"]["id"]] = change["faculty"]
        elif kind == "add_session":
            d["sessions"].append(change["session"])
            added.append(change["session"])
        elif kind == "remove_session":
            d["sessions"] = [s for s in d["sessions"] if s["id"] != change["session_id"]]
            removed.add(change["session_id"])
        else:
            raise ValueError(f"Unknown change type: {kind}")
    return d, extra_fac, extra_room, added, removed
