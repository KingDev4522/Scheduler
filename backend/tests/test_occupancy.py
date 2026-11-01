"""Occupancy/conflict engine tests (live red/orange/green feedback)."""

from __future__ import annotations

import json
import unittest
from datetime import date, timedelta
from pathlib import Path

from backend.occupancy import build_availability, build_session_availability
from backend.semester import derive_semester
from solver.data import Data
from solver.manual import suggest_session_alternatives

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "CrunchWeek_StarterPack" / "data" / "cit_public.json"
SCHEDULE = ROOT / "exports" / "schedule.json"


class OccupancyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.raw = json.loads(DATA.read_text(encoding="utf-8"))
        cls.data = Data(cls.raw)
        cls.semester = derive_semester(cls.raw)
        cls.placements = {}
        if SCHEDULE.exists():
            schedule = json.loads(SCHEDULE.read_text(encoding="utf-8"))
            cls.placements = {
                row["session_id"]: (row["day"], row["start_period"], row["room_id"])
                for row in schedule["sessions"]
            }

    def date_in_week(self, number: int, day: str) -> str:
        week = next(item for item in self.semester["weeks"] if item["number"] == number)
        monday = date.fromisoformat(week["monday"])
        offset = ["MON", "TUE", "WED", "THU", "FRI"].index(day)
        return (monday + timedelta(days=offset)).isoformat()

    def run_availability(self, dates, from_period, to_period, room_id, **kwargs):
        return build_availability(
            self.data,
            kwargs.pop("placements", self.placements),
            kwargs.pop("decisions", []),
            kwargs.pop("submissions", []),
            kwargs.pop("schedule", None),
            dates=dates,
            from_period=from_period,
            to_period=to_period,
            room_id=room_id,
            room_types=kwargs.pop("room_types", []),
            attendance=kwargs.pop("attendance", None),
            needs=kwargs.pop("needs", []),
            mandatory_groups=kwargs.pop("mandatory_groups", []),
        )["checks"][0]

    def test_teaching_class_blocks_the_room(self) -> None:
        session_id, (day, start, room) = next(iter(self.placements.items()))
        session = self.data.sessions[session_id]
        check = self.run_availability(
            [self.date_in_week(1, day)],
            start,
            start + session["duration"] - 1,
            room,
        )
        self.assertEqual(check["severity"], "blocked")
        self.assertTrue(any(entry["kind"] == "class" for entry in check["entries"]))

    def test_official_event_only_counts_in_the_fest_week(self) -> None:
        decisions = [
            {
                "request_id": "BR-01",
                "status": "approved",
                "day": "MON",
                "start_period": 10,
                "end_period": 11,
                "room_id": "AUD",
            }
        ]
        teaching_week = self.run_availability(
            [self.date_in_week(1, "MON")], 10, 11, "AUD", decisions=decisions, placements={}
        )
        fest_week = self.run_availability(
            [self.date_in_week(7, "MON")], 10, 11, "AUD", decisions=decisions, placements={}
        )
        self.assertEqual(teaching_week["severity"], "free")
        self.assertEqual(fest_week["severity"], "blocked")
        self.assertTrue(any(entry["kind"] == "event" for entry in fest_week["entries"]))

    def test_pending_request_is_an_orange_warning(self) -> None:
        submissions = [
            {
                "id": "ADH-1",
                "title": "Club meet",
                "requester": "mehul",
                "status": "pending",
                "room_id": "AUD",
                "day": "MON",
                "start_period": 10,
                "end_period": 11,
                "dates": [self.date_in_week(7, "MON")],
                "weeks": [7],
            }
        ]
        check = self.run_availability(
            [self.date_in_week(7, "MON")],
            10,
            11,
            "AUD",
            submissions=submissions,
            placements={},
        )
        self.assertEqual(check["severity"], "warning")
        self.assertTrue(any(entry["kind"] == "submission" for entry in check["entries"]))

    def test_permanent_room_block_is_hard(self) -> None:
        check = self.run_availability(
            [self.date_in_week(1, "THU")], 1, 2, "LH-4", placements={}
        )
        self.assertEqual(check["severity"], "blocked")
        maintenance = [entry for entry in check["entries"] if entry["kind"] == "maintenance"]
        self.assertTrue(maintenance)
        self.assertIn("Ceiling repair", maintenance[0]["detail"])

    def test_exam_week_blocks_bookings(self) -> None:
        check = self.run_availability(
            [self.date_in_week(8, "MON")], 10, 11, "AUD", placements={}
        )
        self.assertEqual(check["severity"], "blocked")
        self.assertTrue(any(entry["kind"] == "exam_week" for entry in check["entries"]))

    def test_capacity_overflow_is_blocked(self) -> None:
        check = self.run_availability(
            [self.date_in_week(1, "MON")],
            10,
            11,
            "SH-1",
            placements={},
            attendance=10_000,
        )
        self.assertEqual(check["severity"], "blocked")
        self.assertTrue(any(entry["kind"] == "capacity" for entry in check["entries"]))

    def test_session_change_into_an_occupied_room_is_blocked(self) -> None:
        (session_a, (_, _, room_a)), (_, (day_b, start_b, room_b)) = [
            (sid, placement)
            for sid, placement in self.placements.items()
            if placement[2] != next(iter(self.placements.values()))[2]
        ][:2]
        result = build_session_availability(
            self.data,
            self.placements,
            session_id=session_a,
            day=day_b,
            start=start_b,
            room_id=room_b,
        )
        self.assertFalse(result["ok"])
        self.assertTrue(result["blocked"])

    def test_feasible_session_alternative_is_green(self) -> None:
        session_id = next(iter(self.placements))
        alternatives = suggest_session_alternatives(self.data, self.placements, session_id, limit=1)
        if not alternatives:
            self.skipTest("no feasible alternative for the first session")
        alternative = alternatives[0]
        result = build_session_availability(
            self.data,
            self.placements,
            session_id=session_id,
            day=alternative["day"],
            start=alternative["start_period"],
            room_id=alternative["room_id"],
        )
        self.assertTrue(result["ok"], result["blocked"])


if __name__ == "__main__":
    unittest.main()
