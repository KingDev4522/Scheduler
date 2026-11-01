"""Backend API tests.

Run from the repo root:
    python -m pytest -q backend/tests
"""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

TEST_DB = Path(tempfile.gettempdir()) / "cit_scheduler_test_state.sqlite3"
os.environ["DATABASE_PATH"] = str(TEST_DB)
os.environ["ALLOW_DEMO_HEADER"] = "1"
os.environ.setdefault("SEMESTER_START_DATE", "2026-11-02")

from fastapi.testclient import TestClient  # noqa: E402

from backend.app import STATE, app  # noqa: E402
from backend import store  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DISRUPTION = ROOT / "CrunchWeek_StarterPack" / "examples" / "sample_disruption.json"
ADMIN = {"x-demo-user": "debjeet"}


class BackendApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        TEST_DB.unlink(missing_ok=True)
        cls.client = TestClient(app)
        cls.client.__enter__()
        response = cls.client.post("/api/generate?seconds=30", headers=ADMIN)
        assert response.status_code == 200, response.text
        cls.generated = response.json()
        cls.schedule = cls.client.get("/api/schedule", headers=ADMIN).json()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.__exit__(None, None, None)
        TEST_DB.unlink(missing_ok=True)

    def test_health_and_dataset(self) -> None:
        health = self.client.get("/api/health").json()
        self.assertTrue(health["ok"])
        dataset = self.client.get("/api/dataset", headers=ADMIN).json()
        self.assertEqual(dataset["counts"]["rooms"], 27)
        self.assertEqual(dataset["counts"]["sessions"], 189)
        self.assertEqual(len(dataset["entities"]["rooms"]), 27)
        self.assertEqual(len(dataset["entities"]["sessions"]), 189)
        semester = dataset["semester"]
        self.assertEqual(semester["fest_week"], 7)
        self.assertEqual(semester["exam_week"], 8)
        self.assertEqual(semester["semester_start"], "2026-11-02")
        self.assertEqual(len(semester["weeks"]), 8)

    def test_generate_result(self) -> None:
        self.assertEqual(self.generated["sessions"], 189)
        self.assertEqual(self.generated["exams"], 41)
        self.assertEqual(self.generated["summary"]["hard_violation_count"], 0)
        # The 30s test solve proves correctness; soft optimum is wall-clock
        # dependent and is measured by the canonical `python -m solver.run`.
        self.assertIsNotNone(self.generated["booking_score"])

    def test_schedule_shape(self) -> None:
        self.assertEqual(len(self.schedule["schedule"]["sessions"]), 189)
        self.assertEqual(len(self.schedule["schedule"]["exams"]), 41)
        self.assertEqual(len(self.schedule["schedule"]["fest_week"]["bookings"]), 25)
        self.assertEqual(len(self.schedule["decisions"]), 25)

    def test_booking_dates_stay_app_level(self) -> None:
        payload = {
            "title": "Club meet",
            "attendance": 30,
            "duration_periods": 2,
            "windows": [
                {"day": "TUE", "from_period": 6, "to_period": 7},
                {"day": "WED", "from_period": 6, "to_period": 7},
                {"day": "THU", "from_period": 2, "to_period": 3},
                {"day": "MON", "from_period": 1, "to_period": 2},
            ],
            "dates": ["2026-12-15", "2026-12-17"],
            "room_types": ["seminar_hall"],
            "needs": [],
            "requested_room": None,
            "mandatory_for_groups": [],
        }
        validation = self.client.post("/api/bookings/validate", headers=ADMIN, json=payload).json()
        self.assertTrue(validation["alternatives"], validation)
        choice = validation["alternatives"][0]
        response = self.client.post(
            "/api/bookings/submit",
            headers=ADMIN,
            json={
                **payload,
                "requested_room": choice["room_id"],
                "day": choice["day"],
                "start_period": choice["start_period"],
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        request = response.json()["request"]
        self.assertEqual(request["dates"], ["2026-12-15", "2026-12-17"])
        self.assertEqual(request["weeks"], [7])
        # The chosen date + week are app-level: the official request schema must not gain them.
        dataset = self.client.get("/api/dataset", headers=ADMIN).json()
        self.assertTrue(
            all("dates" not in item for item in dataset["entities"]["booking_requests"])
        )

    def test_room_blocks_are_admin_only_and_reject_conflicts(self) -> None:
        placements = STATE.get("placements") or {}
        self.assertTrue(placements, "generate must leave placements in STATE")
        _session_id, (day, start, room) = next(iter(placements.items()))
        body = {
            "room_id": room,
            "day": day,
            "periods": [start],
            "reason": "test block",
        }
        denied = self.client.post(
            "/api/room-blocks", headers={"x-demo-user": "mehul"}, json=body
        )
        self.assertEqual(denied.status_code, 403)
        conflict = self.client.post("/api/room-blocks", headers=ADMIN, json=body)
        self.assertEqual(conflict.status_code, 422)
        self.assertIn("conflicts", conflict.json()["detail"])

    def test_non_admin_generate_forbidden(self) -> None:
        response = self.client.post("/api/generate", headers={"x-demo-user": "mehul"})
        self.assertEqual(response.status_code, 403)

    def test_unknown_user_rejected(self) -> None:
        response = self.client.get("/api/dataset", headers={"x-demo-user": "nobody"})
        self.assertEqual(response.status_code, 401)

    def test_invalid_import_rejected(self) -> None:
        response = self.client.post(
            "/api/import",
            headers=ADMIN,
            files={"file": ("bad.json", b"{ not json", "application/json")},
        )
        self.assertEqual(response.status_code, 422)

    def test_manual_placement_cannot_bypass_constraints(self) -> None:
        sessions = self.schedule["schedule"]["sessions"]
        first = sessions[0]
        second = next(session for session in sessions if session["room_id"] != first["room_id"])
        response = self.client.post(
            "/api/manual",
            headers=ADMIN,
            json={
                "session_id": first["session_id"],
                "day": second["day"],
                "start_period": second["start_period"],
                "room_id": second["room_id"],
            },
        )
        self.assertEqual(response.status_code, 422)
        self.assertTrue(response.json()["detail"]["violations"])
        own = self.client.post(
            "/api/manual",
            headers=ADMIN,
            json={
                "session_id": first["session_id"],
                "day": first["day"],
                "start_period": first["start_period"],
                "room_id": first["room_id"],
            },
        )
        self.assertEqual(own.status_code, 200)
        self.assertFalse(own.json()["applied"])

    def test_disruption_requires_admin_approval(self) -> None:
        with DISRUPTION.open("rb") as handle:
            response = self.client.post(
                "/api/disruption",
                headers=ADMIN,
                files={"file": (DISRUPTION.name, handle.read(), "application/json")},
            )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["proposal_status"], "pending")
        self.assertEqual(body["summary"]["hard_violation_count"], 0)
        before = self.client.get("/api/exports/schedule_after.json", headers=ADMIN)
        self.assertEqual(before.status_code, 409)
        approved = self.client.post("/api/proposal/approve", headers=ADMIN)
        self.assertEqual(approved.status_code, 200)
        after = self.client.get("/api/exports/schedule_after.json", headers=ADMIN)
        self.assertEqual(after.status_code, 200)

    def test_auth_login_and_token(self) -> None:
        login = self.client.post(
            "/api/auth/login", json={"username": "ananya", "password": "1234"}
        )
        self.assertEqual(login.status_code, 200, login.text)
        body = login.json()
        self.assertEqual(body["user"]["role"], "faculty")
        me = self.client.get(
            "/api/auth/me", headers={"authorization": f"Bearer {body['token']}"}
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["user"]["username"], "ananya")

    def test_auth_rejects_missing_and_bad_credentials(self) -> None:
        self.assertEqual(self.client.get("/api/dataset").status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/auth/login", json={"username": "debjeet", "password": "wrong"}
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.get(
                "/api/dataset", headers={"authorization": "Bearer not-a-token"}
            ).status_code,
            401,
        )

    def test_policy_change_is_validated(self) -> None:
        bad = self.client.put(
            "/api/policy",
            headers=ADMIN,
            json={"priority_order": ["club_event"]},
        )
        self.assertEqual(bad.status_code, 422)
        good = self.client.put(
            "/api/policy",
            headers=ADMIN,
            json={
                "priority_order": [
                    "exam",
                    "regular_session",
                    "institute_event",
                    "guest_lecture",
                    "department_event",
                    "club_event",
                ]
            },
        )
        self.assertEqual(good.status_code, 200)
        self.assertEqual(good.json()["version"], "admin-custom")
        # Restore the dataset policy and regenerate so later tests see a schedule.
        restored = self.client.put(
            "/api/policy",
            headers=ADMIN,
            json={
                "priority_order": [
                    "exam",
                    "regular_session",
                    "institute_event",
                    "guest_lecture",
                    "department_event",
                    "club_event",
                ],
                "version": "dataset-default",
            },
        )
        self.assertEqual(restored.status_code, 200)
        regenerated = self.client.post("/api/generate?seconds=30", headers=ADMIN)
        self.assertEqual(regenerated.status_code, 200)

    def test_sqlite_persistence(self) -> None:
        raw, source = store.load_dataset()
        self.assertIsNotNone(raw)
        self.assertEqual(len(raw["sessions"]), 189)
        state = store.load_state()
        self.assertIsNotNone(state.get("schedule"))
        self.assertEqual(len(state["schedule"]["sessions"]), 189)


if __name__ == "__main__":
    unittest.main()
