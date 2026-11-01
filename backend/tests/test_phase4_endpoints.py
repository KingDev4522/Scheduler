"""Phase 4 endpoint tests: token auth, faculty availability, change requests, cancellation."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("DATABASE_PATH", str(Path(tempfile.gettempdir()) / "cit_scheduler_phase4_state.sqlite3"))
os.environ.setdefault("ALLOW_DEMO_HEADER", "1")

from fastapi.testclient import TestClient

from backend import store
from backend.app import STATE, app
from backend.assistant import ParsedDraft


def _login(client: TestClient, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": "1234"}
    )
    assert response.status_code == 200, response.text
    return {"authorization": f"Bearer {response.json()['token']}"}


def test_cors_preflight_is_not_blocked_by_auth() -> None:
    with TestClient(app) as client:
        for origin in (
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
        ):
            response = client.options(
                "/api/dataset",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "authorization",
                },
            )
            assert response.status_code == 200, response.text
            assert response.headers["access-control-allow-origin"] == origin


def test_faculty_availability_is_scoped_and_validated() -> None:
    with TestClient(app) as client:
        faculty = _login(client, "ananya")
        response = client.get("/api/faculty/availability", headers=faculty)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["faculty_id"] == "F01"
        assert isinstance(body["unavailable"], list)

        bad = client.put(
            "/api/faculty/availability",
            headers=faculty,
            json={"unavailable": [{"day": "WED", "periods": [99]}]},
        )
        assert bad.status_code == 422

        denied = client.put(
            "/api/faculty/availability",
            headers=_login(client, "mehul"),
            json={"unavailable": []},
        )
        assert denied.status_code == 403


def test_change_request_lifecycle_and_self_approval_guard() -> None:
    with TestClient(app) as client:
        faculty = _login(client, "ananya")
        admin = _login(client, "debjeet")
        # Ananya owns CS101-A-L1 (F01); target its current slot so the move is legal.
        current = (STATE.get("placements") or {}).get("CS101-A-L1")
        day, start, room = current if current else ("TUE", 6, None)
        draft = ParsedDraft(
            draft={
                "kind": "move_session",
                "session_id": "CS101-A-L1",
                "course_id": "CS101",
                "groups": [],
                "day": day,
                "start_period": start,
                "room_id": room,
            },
            follow_up=[],
            model="test",
        )
        with patch("backend.app.parse_change_request", return_value=draft):
            created = client.post(
                "/api/change-requests",
                headers=faculty,
                json={"text": "Move CS201 to Tuesday P6"},
            )
            assert created.status_code == 200, created.text
            request_id = created.json()["id"]

            listed = client.get("/api/change-requests", headers=faculty)
            assert any(item["id"] == request_id for item in listed.json()["items"])

            decided = client.post(
                f"/api/change-requests/{request_id}/decide",
                headers=admin,
                json={"decision": "approved", "reason": "Slot is free"},
            )
            assert decided.status_code == 200, decided.text
            assert decided.json()["status"] == "approved"

            own = client.post(
                "/api/change-requests",
                headers=admin,
                json={"text": "Move CS201 to Tuesday P6"},
            )
            self_decision = client.post(
                f"/api/change-requests/{own.json()['id']}/decide",
                headers=admin,
                json={"decision": "approved", "reason": "self"},
            )
            assert self_decision.status_code == 403


def test_club_can_cancel_own_booking_request() -> None:
    with TestClient(app) as client:
        store.save_submission(
            {
                "id": "ADH-CANCEL-TEST",
                "title": "Cancel me",
                "requester": "mehul",
                "role": "club",
                "submitted_at": "2026-10-31T00:00:00+00:00",
                "windows": [{"day": "MON", "from_period": 1, "to_period": 1}],
                "attendance": 10,
                "duration_periods": 1,
                "room_types": ["classroom"],
                "needs": [],
                "requested_room": None,
                "mandatory_for_groups": [],
                "requested_category": "club_event",
                "raw_text": "test",
            }
        )
        club = _login(client, "mehul")
        response = client.post(
            "/api/bookings/ADH-CANCEL-TEST/cancel",
            headers=club,
            json={"reason": "Plan changed"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "cancelled"

        other = _login(client, "ananya")
        forbidden = client.post(
            "/api/bookings/ADH-CANCEL-TEST/cancel",
            headers=other,
            json={"reason": "not mine"},
        )
        assert forbidden.status_code == 403
