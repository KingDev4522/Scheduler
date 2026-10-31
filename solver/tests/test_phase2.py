"""Phase 2 acceptance tests.

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

from solver.data import LAST_TEACHING, Data, load
from solver.weekly import solve_weekly

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "CrunchWeek_StarterPack" / "data" / "cit_public.json"
DISRUPTION = ROOT / "CrunchWeek_StarterPack" / "examples" / "sample_disruption.json"
VALIDATOR = ROOT / "CrunchWeek_StarterPack" / "validator.py"
SCHEDULE = ROOT / "exports" / "schedule.json"
AFTER = ROOT / "exports" / "schedule_after.json"


def run_validator(schedule: Path, extra: list[str] | None = None) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as handle:
        report_path = Path(handle.name)
    cmd = [sys.executable, str(VALIDATOR), "--data", str(DATA_PATH), "--schedule", str(schedule),
           "--json", str(report_path), "--quiet", *(extra or [])]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode not in (0,):
        return {"hard_violation_count": -1, "error": result.stderr}
    return json.loads(report_path.read_text(encoding="utf-8"))


class Phase2Acceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not SCHEDULE.exists() or not AFTER.exists():
            raise unittest.SkipTest("run `python -m solver.run` first")
        cls.data = load(DATA_PATH)
        cls.schedule = json.loads(SCHEDULE.read_text(encoding="utf-8"))
        cls.after = json.loads(AFTER.read_text(encoding="utf-8"))
        cls.placement = {
            s["session_id"]: (s["day"], s["start_period"], s["room_id"])
            for s in cls.schedule["sessions"]
        }

    # -- required deliverables -------------------------------------------
    def test_all_sessions_scheduled_exactly_once(self) -> None:
        self.assertEqual(len(self.schedule["sessions"]), len(self.data.sessions))
        self.assertEqual(set(self.placement), set(self.data.sessions))

    def test_schedule_passes_official_validator(self) -> None:
        report = run_validator(SCHEDULE)
        self.assertEqual(report["hard_violation_count"], 0, report.get("hard_violations"))

    def test_schedule_after_passes_official_validator(self) -> None:
        report = run_validator(
            AFTER,
            ["--disruption", str(DISRUPTION), "--baseline", str(SCHEDULE)],
        )
        self.assertEqual(report["hard_violation_count"], 0, report.get("hard_violations"))

    def test_all_exams_scheduled(self) -> None:
        self.assertEqual(len(self.schedule["exams"]), len(self.data.exams))
        self.assertEqual({e["exam_id"] for e in self.schedule["exams"]}, set(self.data.exams))

    # -- hard constraints spot checks ------------------------------------
    def test_basket_options_share_one_slot(self) -> None:
        groups: dict[str, set[tuple[str, int]]] = {}
        for sid, (day, start, _room) in self.placement.items():
            basket = self.data.sessions[sid].get("basket_slot")
            if basket:
                groups.setdefault(basket, set()).add((day, start))
        for basket, slots in groups.items():
            self.assertEqual(len(slots), 1, f"basket {basket} spread over {slots}")

    def test_labs_start_at_p2_or_p6_and_no_lunch_crossing(self) -> None:
        for sid, (day, start, _room) in self.placement.items():
            s = self.data.sessions[sid]
            periods = list(range(start, start + s["duration"]))
            self.assertLessEqual(periods[-1], LAST_TEACHING, sid)
            self.assertFalse(periods[0] <= 5 < periods[-1], f"{sid} crosses lunch")
            if s["kind"] == "lab":
                self.assertIn(start, {2, 6}, f"{sid} lab starts P{start}")

    def test_fixed_slots_respected(self) -> None:
        for sid, (day, start, _room) in self.placement.items():
            fx = self.data.sessions[sid].get("fixed_slot")
            if fx:
                self.assertEqual((day, start), (fx["day"], fx["start_period"]), sid)

    def test_room_type_capacity_accessibility(self) -> None:
        for sid, (_day, _start, room_id) in self.placement.items():
            s = self.data.sessions[sid]
            room = self.data.rooms[room_id]
            self.assertIn(room["type"], s["room_types"], sid)
            self.assertGreaterEqual(room["capacity"], s["size"], sid)
            if s.get("needs_accessible"):
                self.assertTrue(room["accessible"], sid)

    def test_faculty_daily_hours(self) -> None:
        load_by_day: dict[tuple[str, str], int] = {}
        for sid, (day, _start, _room) in self.placement.items():
            s = self.data.sessions[sid]
            key = (s["faculty_id"], day)
            load_by_day[key] = load_by_day.get(key, 0) + s["duration"]
        for (faculty, day), hours in load_by_day.items():
            limit = self.data.faculty[faculty]["max_hours_per_day"]
            self.assertLessEqual(hours, limit, f"{faculty} {day}: {hours}h > {limit}h")

    def test_exam_rooms_and_capacity(self) -> None:
        for exam in self.schedule["exams"]:
            spec = self.data.exams[exam["exam_id"]]
            seats = sum(self.data.rooms[r]["capacity"] // 2 for r in exam["rooms"])
            self.assertGreaterEqual(seats, spec["size"], exam["exam_id"])
            for r in exam["rooms"]:
                self.assertIn("exam", self.data.rooms[r]["allowed_uses"])

    # -- fail-safe --------------------------------------------------------
    def test_infeasible_instance_returns_infeasible(self) -> None:
        raw = copy.deepcopy(self.data.raw)
        raw["rooms"] = []
        broken = Data(raw)
        result = solve_weekly(broken, max_seconds=5)
        self.assertEqual(result.status, "INFEASIBLE")
        self.assertEqual(result.placements, {})


if __name__ == "__main__":
    unittest.main()
