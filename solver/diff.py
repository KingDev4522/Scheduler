"""Exact before/after diff for a rescheduled timetable (Phase 3 §8, §12)."""

from __future__ import annotations

from .data import Data


def _affected_by_changes(
    data: Data,
    baseline: dict[str, tuple[str, int, str]],
    changes: list[dict],
) -> set[str]:
    affected: set[str] = set()
    for s in data.sessions.values():
        place = baseline.get(s["id"])
        if not place:
            continue
        day, start, room = place
        periods = set(data.block(start, s["duration"]))
        for change in changes:
            kind = change.get("type")
            if kind == "faculty_unavailable":
                if (
                    s["faculty_id"] == change["faculty_id"]
                    and day in change["days"]
                    and periods & set(change["periods"])
                ):
                    affected.add(s["id"])
            elif kind == "room_unavailable":
                if (
                    room == change["room_id"]
                    and day in change["days"]
                    and periods & set(change["periods"])
                ):
                    affected.add(s["id"])
            elif kind == "remove_session" and s["id"] == change["session_id"]:
                affected.add(s["id"])
    return affected


def build_diff(
    data: Data,
    baseline: dict[str, tuple[str, int, str]],
    after: dict[str, tuple[str, int, str]],
    changes: list[dict],
) -> dict:
    moved = []
    for sid in sorted(set(baseline) & set(after)):
        before = baseline[sid]
        now = after[sid]
        if before == now:
            continue
        moved.append(
            {
                "session_id": sid,
                "before": {"day": before[0], "start_period": before[1], "room_id": before[2]},
                "after": {"day": now[0], "start_period": now[1], "room_id": now[2]},
                "time_changed": before[:2] != now[:2],
                "room_only": before[:2] == now[:2],
            }
        )
    added = sorted(set(after) - set(baseline))
    removed = sorted(set(baseline) - set(after))
    directly_affected = sorted(_affected_by_changes(data, baseline, changes))

    moved_ids = {row["session_id"] for row in moved}
    forced = set(directly_affected) - set(removed)
    # Every directly affected session must move; added sessions are new, not moved.
    # moved == forced is therefore the minimum achievable under this strategy.
    return {
        "moved_count": len(moved),
        "time_changed": sum(1 for row in moved if row["time_changed"]),
        "room_only_changed": sum(1 for row in moved if row["room_only"]),
        "moved": moved,
        "added_sessions": added,
        "removed_sessions": removed,
        "directly_affected": directly_affected,
        "moved_minimal": moved_ids == forced,
    }
