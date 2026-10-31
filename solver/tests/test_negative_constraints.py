"""Negative hard-constraint tests against the unmodified official validator."""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "CrunchWeek_StarterPack" / "data" / "cit_public.json"
VALIDATOR = ROOT / "CrunchWeek_StarterPack" / "validator.py"
SCHEDULE = ROOT / "exports" / "schedule.json"


def _run(schedule: dict) -> dict:
    with tempfile.TemporaryDirectory() as directory:
        schedule_path = Path(directory) / "schedule.json"
        report_path = Path(directory) / "report.json"
        schedule_path.write_text(json.dumps(schedule), encoding="utf-8")
        subprocess.run(
            [
                sys.executable,
                str(VALIDATOR),
                "--data",
                str(DATA),
                "--schedule",
                str(schedule_path),
                "--json",
                str(report_path),
                "--quiet",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        return json.loads(report_path.read_text(encoding="utf-8"))


@unittest.skipUnless(SCHEDULE.exists(), "run `python -m solver.run` first")
class NegativeConstraintTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.base = json.loads(SCHEDULE.read_text(encoding="utf-8"))
        cls.dataset = json.loads(DATA.read_text(encoding="utf-8"))
        cls.definitions = {s["id"]: s for s in cls.dataset["sessions"]}

    def assert_rule(self, schedule: dict, rule: str) -> None:
        report = _run(schedule)
        self.assertGreaterEqual(report["hard_violation_count"], 1, report)
        self.assertIn(rule, report["hard_by_rule"], report["hard_by_rule"])

    def test_validator_detects_duplicate_session(self) -> None:
        schedule = copy.deepcopy(self.base)
        schedule["sessions"].append(copy.deepcopy(schedule["sessions"][0]))
        self.assert_rule(schedule, "H1")

    def test_validator_detects_faculty_double_booking(self) -> None:
        schedule = copy.deepcopy(self.base)
        by_faculty: dict[str, list[str]] = {}
        for row in schedule["sessions"]:
            definition = self.definitions[row["session_id"]]
            by_faculty.setdefault(definition["faculty_id"], []).append(row["session_id"])
        faculty_id, session_ids = next(
            (key, value) for key, value in by_faculty.items() if len(value) >= 2
        )
        target = next(row for row in schedule["sessions"] if row["session_id"] == session_ids[0])
        for row in schedule["sessions"]:
            if row["session_id"] == session_ids[1]:
                row["day"] = target["day"]
                row["start_period"] = target["start_period"]
        self.assert_rule(schedule, "H2")

    def test_validator_detects_group_double_booking(self) -> None:
        schedule = copy.deepcopy(self.base)
        by_group: dict[str, list[str]] = {}
        for row in schedule["sessions"]:
            for group in self.definitions[row["session_id"]]["groups"]:
                by_group.setdefault(group, []).append(row["session_id"])
        _group, session_ids = next(
            (key, value) for key, value in by_group.items() if len(set(value)) >= 2
        )
        target = next(row for row in schedule["sessions"] if row["session_id"] == session_ids[0])
        for row in schedule["sessions"]:
            if row["session_id"] == session_ids[1]:
                row["day"] = target["day"]
                row["start_period"] = target["start_period"]
        self.assert_rule(schedule, "H3")

    def test_validator_detects_room_double_booking(self) -> None:
        schedule = copy.deepcopy(self.base)
        first, second = schedule["sessions"][0], schedule["sessions"][1]
        second["day"] = first["day"]
        second["start_period"] = first["start_period"]
        second["room_id"] = first["room_id"]
        self.assert_rule(schedule, "H4")

    def test_validator_detects_unavailable_faculty(self) -> None:
        schedule = copy.deepcopy(self.base)
        row = next(
            row
            for row in schedule["sessions"]
            if self.definitions[row["session_id"]]["faculty_id"] == "F01"
        )
        row["day"] = "WED"
        row["start_period"] = 6
        self.assert_rule(schedule, "H7")

    def test_validator_detects_unavailable_room(self) -> None:
        schedule = copy.deepcopy(self.base)
        row = next(row for row in schedule["sessions"] if row["room_id"] == "LH-4")
        row["day"] = "THU"
        row["start_period"] = 1
        self.assert_rule(schedule, "H8")


if __name__ == "__main__":
    unittest.main()
