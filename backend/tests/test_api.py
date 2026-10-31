"""Backend API tests.

Run from the repo root:
    python -m pytest -q backend/tests
"""

from __future__ import annotations

import json
import os
import unittest
from pathlib import Path

TEST_DB = Path(__file__).resolve().parent / "test_state.sqlite3"
os.environ["DATABASE_PATH"] = str(TEST_DB)

from fastapi.testclient import TestClient  # noqa: E402

from backend.app import app  # noqa: E402
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
        dataset = self.client.get("/api/dataset").json()
        self.assertEqual(dataset["counts"]["rooms"], 27)
        self.assertEqual(dataset["counts"]["sessions"], 189)
        self.assertEqual(len(dataset["entities"]["rooms"]), 27)
        self.assertEqual(len(dataset["entities"]["sessions"]), 189)

    def test_generate_result(self) -> None:
        self.assertEqual(self.generated["sessions"], 189)
        self.assertEqual(self.generated["exams"], 41)
        self.assertEqual(self.generated["summary"]["hard_violation_count"], 0)
        self.assertLessEqual(self.generated["summary"]["soft_total"], 6)
        self.assertIsNotNone(self.generated["booking_score"])

    def test_schedule_shape(self) -> None:
        self.assertEqual(len(self.schedule["schedule"]["sessions"]), 189)
        self.assertEqual(len(self.schedule["schedule"]["exams"]), 41)
        self.assertEqual(len(self.schedule["schedule"]["fest_week"]["bookings"]), 25)
        self.assertEqual(len(self.schedule["decisions"]), 25)

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
        before = self.client.get("/api/exports/schedule_after.json")
        self.assertEqual(before.status_code, 404)
        approved = self.client.post("/api/proposal/approve", headers=ADMIN)
        self.assertEqual(approved.status_code, 200)
        after = self.client.get("/api/exports/schedule_after.json")
        self.assertEqual(after.status_code, 200)

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
