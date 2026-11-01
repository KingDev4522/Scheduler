"""Negative hard-constraint tests against the unmodified official validator."""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from collections import defaultdict
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

    def test_validator_detects_capacity_overflow(self) -> None:
        schedule = copy.deepcopy(self.base)
        rooms = {r["id"]: r for r in self.dataset["rooms"]}
        for row in schedule["sessions"]:
            definition = self.definitions[row["session_id"]]
            for room in rooms.values():
                if room["type"] not in definition["room_types"]:
                    continue
                if room["capacity"] >= definition["size"]:
                    continue
                if definition.get("needs_accessible") and not room["accessible"]:
                    continue
                row["room_id"] = room["id"]
                self.assert_rule(schedule, "H5")
                return
        self.skipTest("no undersized same-type room available")

    def test_validator_detects_wrong_room_type(self) -> None:
        schedule = copy.deepcopy(self.base)
        rooms = {r["id"]: r for r in self.dataset["rooms"]}
        for row in schedule["sessions"]:
            definition = self.definitions[row["session_id"]]
            for room in rooms.values():
                if room["type"] in definition["room_types"]:
                    continue
                if room["capacity"] < definition["size"]:
                    continue
                if definition.get("needs_accessible") and not room["accessible"]:
                    continue
                row["room_id"] = room["id"]
                self.assert_rule(schedule, "H6")
                return
        self.skipTest("no wrong-type room with enough capacity")

    def test_validator_detects_bad_lab_start(self) -> None:
        schedule = copy.deepcopy(self.base)
        for row in schedule["sessions"]:
            definition = self.definitions[row["session_id"]]
            if definition["kind"] != "lab":
                continue
            row["start_period"] = 1
            self.assert_rule(schedule, "H9")
            return
        self.skipTest("no lab session in the dataset")

    def test_validator_detects_lunch_crossing(self) -> None:
        schedule = copy.deepcopy(self.base)
        for row in schedule["sessions"]:
            definition = self.definitions[row["session_id"]]
            if definition["duration"] < 2:
                continue
            row["start_period"] = 5
            self.assert_rule(schedule, "H9")
            return
        self.skipTest("no multi-period session in the dataset")

    def test_validator_detects_inaccessible_room(self) -> None:
        schedule = copy.deepcopy(self.base)
        rooms = {r["id"]: r for r in self.dataset["rooms"]}
        for row in schedule["sessions"]:
            definition = self.definitions[row["session_id"]]
            if not definition.get("needs_accessible"):
                continue
            for room in rooms.values():
                if room["accessible"] or room["type"] not in definition["room_types"]:
                    continue
                if room["capacity"] < definition["size"]:
                    continue
                row["room_id"] = room["id"]
                self.assert_rule(schedule, "H10")
                return
        self.skipTest("no accessible-needing session with an inaccessible same-type room")

    def test_validator_detects_basket_slot_split(self) -> None:
        schedule = copy.deepcopy(self.base)
        baskets: dict[str, list[str]] = defaultdict(list)
        for sid, definition in self.definitions.items():
            if definition.get("basket_slot"):
                baskets[definition["basket_slot"]].append(sid)
        rows = {row["session_id"]: row for row in schedule["sessions"]}
        for ids in baskets.values():
            if len(ids) < 2:
                continue
            anchor = rows[ids[0]]
            other = rows[ids[1]]
            other["day"] = "FRI" if anchor["day"] != "FRI" else "MON"
            other["start_period"] = 2 if anchor["start_period"] == 1 else 1
            self.assert_rule(schedule, "H11")
            return
        self.skipTest("no elective basket with multiple options")

    def test_validator_detects_faculty_daily_limit(self) -> None:
        schedule = copy.deepcopy(self.base)
        by_faculty: dict[str, list[str]] = defaultdict(list)
        for sid, definition in self.definitions.items():
            by_faculty[definition["faculty_id"]].append(sid)
        rows = {row["session_id"]: row for row in schedule["sessions"]}
        for ids in by_faculty.values():
            if sum(self.definitions[sid]["duration"] for sid in ids) <= 4:
                continue
            for sid in ids:
                rows[sid]["day"] = "MON"
            self.assert_rule(schedule, "H12")
            return
        self.skipTest("no faculty exceeding the daily limit")

    def test_validator_detects_unknown_booking_room(self) -> None:
        schedule = copy.deepcopy(self.base)
        approved = next(
            (b for b in schedule["fest_week"]["bookings"] if b.get("status") == "approved"),
            None,
        )
        if approved is None:
            self.skipTest("no approved booking in the schedule")
        approved["room_id"] = "NOT-A-REAL-ROOM"
        self.assert_rule(schedule, "H13")

    def test_validator_detects_moved_fixed_slot(self) -> None:
        fixed = [s for s in self.dataset["sessions"] if s.get("fixed_slot")]
        if not fixed:
            self.skipTest("dataset has no fixed-slot sessions (H14 not applicable)")
        schedule = copy.deepcopy(self.base)
        row = next(r for r in schedule["sessions"] if r["session_id"] == fixed[0]["id"])
        row["day"] = "FRI" if row["day"] != "FRI" else "MON"
        row["start_period"] = 1 if row["start_period"] != 1 else 2
        self.assert_rule(schedule, "H14")


@unittest.skipUnless(SCHEDULE.exists(), "run `python -m solver.run` first")
class SoftConstraintTests(unittest.TestCase):
    """Every soft rule must be detectable by the official validator."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.base = json.loads(SCHEDULE.read_text(encoding="utf-8"))
        cls.dataset = json.loads(DATA.read_text(encoding="utf-8"))
        cls.definitions = {s["id"]: s for s in cls.dataset["sessions"]}
        cls.base_soft = _run(cls.base)["soft_penalties"]

    def assert_soft(self, schedule: dict, rule: str) -> None:
        report = _run(schedule)
        self.assertGreater(report["soft_penalties"][rule], 0, report["soft_penalties"])

    def _rows(self, schedule: dict) -> dict[str, dict]:
        return {row["session_id"]: row for row in schedule["sessions"]}

    def test_validator_detects_avoided_slot(self) -> None:
        schedule = copy.deepcopy(self.base)
        rows = self._rows(schedule)
        lectures = [
            (sid, definition_avoid(d, self.dataset))
            for sid, d in self.definitions.items()
            if d["kind"] == "lecture" and d["duration"] == 1
        ]
        for sid, prefs in lectures:
            if not prefs:
                continue
            rows[sid]["day"] = prefs["days"][0]
            rows[sid]["start_period"] = prefs["periods"][0]
            self.assert_soft(schedule, "S1")
            return
        self.skipTest("no one-hour lecture with an avoid preference")

    def test_validator_detects_group_gap(self) -> None:
        schedule = copy.deepcopy(self.base)
        rows = self._rows(schedule)
        group = self.dataset["student_groups"][0]["id"]
        lectures = [
            sid
            for sid, d in self.definitions.items()
            if group in d["groups"] and d["kind"] == "lecture" and d["duration"] == 1
        ][:2]
        if len(lectures) < 2:
            self.skipTest("not enough one-hour lectures for the first group")
        rows[lectures[0]]["day"] = "MON"
        rows[lectures[0]]["start_period"] = 1
        rows[lectures[1]]["day"] = "MON"
        rows[lectures[1]]["start_period"] = 3
        self.assert_soft(schedule, "S2")

    def test_validator_detects_overloaded_day(self) -> None:
        schedule = copy.deepcopy(self.base)
        rows = self._rows(schedule)
        group = self.dataset["student_groups"][0]["id"]
        group_sessions = [
            sid
            for sid, d in self.definitions.items()
            if group in d["groups"] and d["kind"] == "lecture" and d["duration"] == 1
        ][:7]
        if len(group_sessions) < 7:
            self.skipTest("not enough one-hour lectures for this group")
        for period, sid in enumerate(group_sessions, start=1):
            rows[sid]["day"] = "MON"
            rows[sid]["start_period"] = period
        self.assert_soft(schedule, "S3")

    def test_validator_detects_repeated_course(self) -> None:
        schedule = copy.deepcopy(self.base)
        rows = self._rows(schedule)
        by_group_course: dict[tuple[str, str], list[str]] = defaultdict(list)
        for sid, d in self.definitions.items():
            if d["kind"] != "lecture":
                continue
            for group in d["groups"]:
                by_group_course[(group, d["course_id"])].append(sid)
        for ids in by_group_course.values():
            if len(ids) < 2:
                continue
            rows[ids[0]]["day"] = "MON"
            rows[ids[0]]["start_period"] = 1
            rows[ids[1]]["day"] = "MON"
            rows[ids[1]]["start_period"] = 2
            report = _run(schedule)
            self.assertGreater(report["soft_penalties"]["S4"], self.base_soft["S4"], report["soft_penalties"])
            return
        self.skipTest("no course repeats for a group")

    def test_validator_detects_low_capacity_fill(self) -> None:
        schedule = copy.deepcopy(self.base)
        rows = self._rows(schedule)
        rooms = {r["id"]: r for r in self.dataset["rooms"]}
        for sid, definition in self.definitions.items():
            for room in rooms.values():
                if room["type"] not in definition["room_types"]:
                    continue
                if not room["capacity"] or room["capacity"] < definition["size"]:
                    continue
                if definition["size"] / room["capacity"] >= 0.4:
                    continue
                if definition.get("needs_accessible") and not room["accessible"]:
                    continue
                rows[sid]["room_id"] = room["id"]
                self.assert_soft(schedule, "S5")
                return
        self.skipTest("no low-fill room pairing available")

    def test_validator_detects_p9_session(self) -> None:
        schedule = copy.deepcopy(self.base)
        rows = self._rows(schedule)
        for sid, definition in self.definitions.items():
            if definition["kind"] == "lab" or definition["duration"] != 1:
                continue
            rows[sid]["start_period"] = 9
            self.assert_soft(schedule, "S6")
            return
        self.skipTest("no one-hour lecture to move to P9")


def definition_avoid(definition: dict, dataset: dict) -> dict | None:
    faculty = next(f for f in dataset["faculty"] if f["id"] == definition["faculty_id"])
    for pref in faculty.get("preferences", []):
        if pref.get("type") == "avoid" and pref.get("periods"):
            return pref
    return None


if __name__ == "__main__":
    unittest.main()
