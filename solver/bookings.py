"""Deterministic Spectra-week booking decisions.

Priority order and role caps come from the dataset; ties break on earlier
`submitted_at` (validator.py `outranks`). Approved bookings are only made when
the room, time and mandatory groups are all free against the solved timetable,
so no `session_overrides` are required.
"""

from __future__ import annotations

from collections import defaultdict

from .data import Data
from .policy import Policy


def _free(occupied: dict[tuple[str, str, int], list[str]], room: str, day: str, start: int, dur: int) -> bool:
    return not any(occupied.get((room, day, p)) for p in range(start, start + dur))


def decide_bookings(
    data: Data,
    timetable: dict[str, tuple[str, int, str]],
    policy: Policy | None = None,
) -> tuple[list[dict], dict]:
    policy = policy or Policy.from_dataset(data)
    room_busy: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    group_busy: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    for sid, (day, start, room) in timetable.items():
        s = data.sessions.get(sid)
        if not s:
            continue
        for p in data.block(start, s["duration"]):
            room_busy[(room, day, p)].append(sid)
            # Any class occupies its groups, labs included (validator keys every
            # session; only basket options collapse to one key, which does not
            # matter for a boolean "is the group busy" check).
            for g in s["groups"]:
                group_busy[(g, day, p)].append(sid)

    def room_ok(req: dict, r: dict) -> bool:
        if "event" not in r["allowed_uses"]:
            return False
        if r["type"] not in req["room_types"]:
            return False
        if r["capacity"] < req["attendance"]:
            return False
        feats = set(r["features"]) | ({"accessible"} if r["accessible"] else set())
        if set(req.get("needs", [])) - feats:
            return False
        return True

    def try_place(req: dict, in_window: bool) -> tuple[str, int, int, str] | None:
        windows = req["windows"] if in_window else [
            {"day": d, "from_period": 1, "to_period": 13} for d in data.days
        ]
        for window in windows:
            day = window["day"]
            if day not in data.day_index:
                continue
            last_start = min(window["to_period"], 13) - req["duration_periods"] + 1
            for start in range(window["from_period"], last_start + 1):
                periods = data.block(start, req["duration_periods"])
                if not periods or periods[0] < 1:
                    continue
                for r in sorted(data.rooms.values(), key=lambda room: room["capacity"]):
                    if not room_ok(req, r):
                        continue
                    if any((r["id"], day, p) in data.room_unavailable for p in periods):
                        continue
                    if not _free(room_busy, r["id"], day, start, req["duration_periods"]):
                        continue
                    if any(group_busy.get((g, day, p)) for g in req.get("mandatory_for_groups", []) for p in periods):
                        continue
                    return (r["id"], day, start, periods[-1])
        return None

    requests = [r for r in data.requests.values()]
    requests.sort(
        key=lambda r: (
            policy.priority_order.index(policy.effective_category(r)),
            r["submitted_at"],
        )
    )

    decisions: list[dict] = []
    stats = {"approved": 0, "rejected": 0, "alternative": 0}
    for req in requests:
        if req["id"] in data.cancelled:
            decisions.append({"request_id": req["id"], "status": "rejected", "reason": "Request was cancelled"})
            stats["rejected"] += 1
            continue
        found = try_place(req, in_window=True)
        if found:
            room, day, start, end = found
            for p in range(start, end + 1):
                room_busy[(room, day, p)].append(req["id"])
                for g in req.get("mandatory_for_groups", []):
                    group_busy[(g, day, p)].append(req["id"])
            decisions.append({
                "request_id": req["id"],
                "status": "approved",
                "day": day,
                "start_period": start,
                "end_period": end,
                "room_id": room,
                "reason": f"{policy.effective_category(req)} placed in {room} within the requested window",
            })
            stats["approved"] += 1
            continue
        alternative = try_place(req, in_window=False)
        if alternative:
            room, day, start, end = alternative
            for p in range(start, end + 1):
                room_busy[(room, day, p)].append(req["id"])
                for g in req.get("mandatory_for_groups", []):
                    group_busy[(g, day, p)].append(req["id"])
            decisions.append({
                "request_id": req["id"],
                "status": "alternative_offered",
                "day": day,
                "start_period": start,
                "end_period": end,
                "room_id": room,
                "reason": "No slot inside the requested windows; a feasible slot outside them was offered",
            })
            stats["alternative"] += 1
            continue
        decisions.append({
            "request_id": req["id"],
            "status": "rejected",
            "reason": "No room matching type, capacity, needs and availability within the requested windows",
        })
        stats["rejected"] += 1

    return decisions, stats
