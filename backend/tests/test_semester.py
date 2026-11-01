"""Derived semester calendar tests (app-level, no dataset change)."""

from __future__ import annotations

import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.semester import derive_semester, weeks_for_dates

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "CrunchWeek_StarterPack" / "data" / "cit_public.json"


class SemesterDerivationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.raw = json.loads(DATA.read_text(encoding="utf-8"))

    def derive(self, raw=None):
        # The configured term start (default 2026-11-02) wins; no ambient env leaks in.
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SEMESTER_START_DATE", None)
            return derive_semester(self.raw if raw is None else raw)

    def test_default_term_start_is_november(self) -> None:
        semester = self.derive()
        self.assertIsNotNone(semester)
        self.assertEqual(semester["semester_start"], "2026-11-02")

    def test_week_numbers(self) -> None:
        semester = self.derive()
        self.assertEqual(semester["fest_week"], 7)
        self.assertEqual(semester["exam_week"], 8)
        self.assertEqual(semester["anchor_date"], "2026-12-14")

    def test_weeks_have_dates_and_phases(self) -> None:
        weeks = self.derive()["weeks"]
        self.assertEqual(len(weeks), 8)
        self.assertEqual([w["number"] for w in weeks], list(range(1, 9)))
        self.assertEqual(weeks[0]["monday"], "2026-11-02")
        self.assertEqual(weeks[0]["friday"], "2026-11-06")
        self.assertEqual(weeks[6]["phase"], "spectra")
        self.assertEqual(weeks[6]["monday"], "2026-12-14")
        self.assertEqual(weeks[7]["phase"], "exams")
        self.assertEqual(weeks[7]["monday"], "2026-12-21")

    def test_date_to_week(self) -> None:
        semester = self.derive()
        self.assertEqual(weeks_for_dates(semester, ["2026-11-03"]), [1])
        self.assertEqual(weeks_for_dates(semester, ["2026-12-15"]), [7])
        self.assertEqual(weeks_for_dates(semester, ["2026-12-22"]), [8])
        self.assertEqual(weeks_for_dates(semester, ["2027-05-01"]), [])

    def test_env_override(self) -> None:
        with patch.dict(os.environ, {"SEMESTER_START_DATE": "2027-01-04"}):
            semester = derive_semester(self.raw)
        self.assertEqual(semester["semester_start"], "2027-01-04")

    def test_dataset_fallback_when_config_invalid(self) -> None:
        with patch.dict(os.environ, {"SEMESTER_START_DATE": "not-a-date"}):
            semester = derive_semester(self.raw)
        # Falls back to the Spectra-week timestamp (cancellation 2027-02-03).
        self.assertEqual(semester["semester_start"], "2026-12-21")
        self.assertEqual(semester["anchor_date"], "2027-02-01")

    def test_no_timestamps_and_invalid_config_returns_none(self) -> None:
        with patch.dict(os.environ, {"SEMESTER_START_DATE": "not-a-date"}):
            self.assertIsNone(derive_semester({"calendar": {"fest_week": "Week 7"}}))


if __name__ == "__main__":
    unittest.main()
