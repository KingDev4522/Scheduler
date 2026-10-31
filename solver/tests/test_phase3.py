"""Phase 3 acceptance tests.

Run from the repo root after `python -m solver.run`:
    python -m unittest discover -s solver/tests -v
"""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from solver.approvals import ApprovalError, finalize_decisions
from solver.bookings import decide_bookings
from solver.data import Data, load
from solver.manual import validate_manual
from solver.policy import CATEGORIES, Policy
from solver.weekly import solve_weekly

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "CrunchWeek_StarterPack" / "data" / "cit_public.json"
DISRUPTION = ROOT / "CrunchWeek_StarterPack" / "examples" / "sample_disruption.json"
VALIDATOR = ROOT / "CrunchWeek_StarterPack" / "validator.py"
EXPORTS = ROOT / "exports"
SCHEDULE = EXPORTS / "schedule.json"
AFTER = EXPORTS / "schedule_after.json"
DECISIONS = EXPORTS / "booking_decisions.json"
DIFF = EXPORTS / "schedule_diff.json"


def run_validator(schedule: Path, extra: list[str] | None = None) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as handle:
        report_path = Path(handle.name)
    cmd = [sys.executable, str(VALIDATOR), "--data", str(DATA_PATH), "--schedule", str(schedule),
           "--json", str(report_path), "--quiet", *(extra or [])]
    subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(report_path.read_text(encoding="utf-8"))


class Phase3Acceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        for path in (SCHEDULE, AFTER, DECISIONS, DIFF):
            if not path.exists():
                raise unittest.SkipTest("run `python -m solver.run` first")
        cls.data = load(DATA_PATH)
        cls.schedule = json.loads(SCHEDULE.read_text(encoding="utf-8"))
        cls.after = json.loads(AFTER.read_text(encoding="utf-8"))
        cls.meta = json.loads(DECISIONS.read_text(encoding="utf-8"))
        cls.diff = json.loads(DIFF.read_text(encoding="utf-8"))
        cls.placement = {
            s["session_id"]: (s["day"], s["start_period"], s["room_id"])
            for s in cls.schedule["sessions"]
        }

    # 1 / 2 / 6 — requests, cancellation, reasons
    def test_all_requests_decided(self) -> None:
        rows = self.schedule["fest_week"]["bookings"]
        self.assertEqual(len(rows), len(self.data.requests))
        self.assertEqual({r["request_id"] for r in rows}, set(self.data.requests))

    def test_cancelled_request_never_approved(self) -> None:
        rows = {r["request_id"]: r for r in self.schedule["fest_week"]["bookings"]}
        for request_id in self.data.cancelled:
            self.assertNotIn(rows[request_id]["status"], ("approved", "alternative_offered"))
            self.assertTrue(rows[request_id].get("reason"))

    def test_every_rejection_or_alternative_has_reason(self) -> None:
        for row in self.schedule["fest_week"]["bookings"]:
            if row["status"] in ("rejected", "alternative_offered"):
                self.assertTrue(row.get("reason", "").strip(), row["request_id"])

    # 3 / 4 — priority order and configurability
    def test_priority_order_has_six_categories(self) -> None:
        self.assertEqual(tuple(self.data.priority_order), CATEGORIES)

    def test_admin_can_change_priority_order(self) -> None:
        reversed_order = list(reversed(CATEGORIES))
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump({"version": "test-reversed", "priority_order": reversed_order}, handle)
            path = Path(handle.name)
        policy = Policy.from_dataset(self.data, path)
        self.assertEqual(list(policy.priority_order), reversed_order)
        self.assertEqual(policy.version, "test-reversed")
        # A club request now outranks an institute event.
        club = {"role": "club", "requested_category": "club_event", "submitted_at": "2027-01-02"}
        institute = {
            "role": "admin",
            "requested_category": "institute_event",
            "submitted_at": "2027-01-01",
        }
        self.assertTrue(policy.outranks(club, institute))
        decisions, _ = decide_bookings(self.data, self.placement, policy)
        self.assertEqual(len(decisions), len(self.data.requests))

    def test_invalid_priority_order_rejected(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump({"priority_order": ["club_event"]}, handle)
            path = Path(handle.name)
        with self.assertRaises(ValueError):
            Policy.from_dataset(self.data, path)

    # 5 / 7 — conflict blocking and validated alternatives
    def test_impossible_request_is_rejected(self) -> None:
        data = copy.deepcopy(self.data)
        req = copy.deepcopy(next(iter(data.requests.values())))
        req.update(
            id="BR-TEST",
            attendance=5000,
            title="Impossible capacity",
            requested_room=None,
            mandatory_for_groups=[],
        )
        data.requests[req["id"]] = req
        decisions, _ = decide_bookings(data, self.placement)
        row = next(d for d in decisions if d["request_id"] == "BR-TEST")
        self.assertEqual(row["status"], "rejected")
        self.assertTrue(row["reason"])

    def test_alternatives_are_validated(self) -> None:
        # The official validator checks every alternative under H13; if any were
        # invalid the report would be non-zero.
        report = run_validator(SCHEDULE)
        self.assertEqual(report["hard_violation_count"], 0)
        for row in self.schedule["fest_week"]["bookings"]:
            if row["status"] == "alternative_offered":
                self.assertIn("room_id", row)
                self.assertIn("day", row)

    # 8 / 9 — approvals, roles, self-approval
    def test_self_approval_blocked(self) -> None:
        data = copy.deepcopy(self.data)
        request_id = next(iter(data.requests))
        data.requests[request_id] = copy.deepcopy(data.requests[request_id])
        data.requests[request_id]["requester"] = "admin"
        decisions = [{"request_id": request_id, "status": "approved", "reason": "test"}]
        with self.assertRaises(ApprovalError):
            finalize_decisions(data, decisions, Policy.from_dataset(data), approver="admin")

    def test_only_admin_role_may_approve(self) -> None:
        decisions = [{"request_id": next(iter(self.data.requests)), "status": "approved", "reason": "test"}]
        with self.assertRaises(ApprovalError):
            finalize_decisions(
                self.data, decisions, Policy.from_dataset(self.data),
                approver="coord", approver_role="department_coordinator",
            )

    # 10 / 11 / 12 — disruption, minimal movement, diff
    def test_disruption_is_applied(self) -> None:
        after_ids = {s["session_id"] for s in self.after["sessions"]}
        self.assertIn("CS202-T2", after_ids)  # add_session from the sample file

    def test_movement_is_minimal(self) -> None:
        self.assertTrue(self.diff["moved_minimal"], self.diff)
        forced = set(self.diff["directly_affected"]) - set(self.diff["removed_sessions"])
        self.assertEqual({row["session_id"] for row in self.diff["moved"]}, forced)

    def test_diff_shows_before_and_after(self) -> None:
        self.assertGreater(len(self.diff["moved"]), 0)
        for row in self.diff["moved"]:
            self.assertEqual(set(row["before"]), {"day", "start_period", "room_id"})
            self.assertEqual(set(row["after"]), {"day", "start_period", "room_id"})
            self.assertNotEqual(row["before"], row["after"])

    # 13 / 14 — approval gate and infeasible preservation
    def test_approval_records_cover_every_approved_or_alternative(self) -> None:
        approved = {r["request_id"] for r in self.schedule["fest_week"]["bookings"]
                    if r["status"] in ("approved", "alternative_offered")}
        recorded = {r["request_id"] for r in self.meta["approvals"]}
        self.assertEqual(approved, recorded)
        for record in self.meta["approvals"]:
            self.assertEqual(record["decided_role"], "admin")
            self.assertNotEqual(record["decided_by"], "")

    def test_infeasible_disruption_publishes_nothing(self) -> None:
        data = Data(copy.deepcopy(self.data.raw))
        all_rooms = set(data.rooms)
        extra_room = {(r, day, p) for r in all_rooms for day in data.days for p in range(1, 10)}
        result = solve_weekly(data, max_seconds=5, extra_room_unavailable=extra_room)
        # The published schedule is preserved: no placements are returned, and a
        # timeout is explicitly not treated as a publishable answer.
        self.assertNotEqual(result.status, "FEASIBLE")
        self.assertEqual(result.placements, {})

    # 15 — manual scheduling cannot bypass hard constraints
    def test_manual_placement_rejects_conflicts(self) -> None:
        session_id = next(iter(self.placement))
        day, start, room = self.placement[session_id]
        # Its own placement is valid when it is the only copy of that session.
        self.assertEqual(validate_manual(self.data, self.placement, session_id, day, start, room), [])
        # Reusing another session's slot must be rejected.
        other = next(
            (sid for sid, place in self.placement.items()
             if sid != session_id and place == (day, start, room)),
            None,
        )
        if other:
            self.assertNotEqual(
                validate_manual(self.data, self.placement, session_id, day, start, room), []
            )
        # A lab outside P2/P6 is a hard violation.
        lab = next(s for s in self.data.sessions.values() if s["kind"] == "lab")
        bad = validate_manual(self.data, {}, lab["id"], "MON", 1, lab["room_types"] and
                              next(r for r in self.data.rooms if self.data.rooms[r]["type"] in lab["room_types"]))
        self.assertTrue(any("H9" in item for item in bad))

    # 16 — rescheduling passes the official validator
    def test_both_exports_pass_official_validator(self) -> None:
        self.assertEqual(run_validator(SCHEDULE)["hard_violation_count"], 0)
        report = run_validator(
            AFTER, ["--disruption", str(DISRUPTION), "--baseline", str(SCHEDULE)]
        )
        self.assertEqual(report["hard_violation_count"], 0)


if __name__ == "__main__":
    unittest.main()
