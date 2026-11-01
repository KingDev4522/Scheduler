"""Phase 3 engine entry point.

Solves the official dataset, decides all Spectra requests under a configurable
priority policy, approves them with role/self-approval checks, exports the
schedule and booking metadata, applies the official disruption, produces an
exact diff, and validates both exports with the unmodified official validator.

Usage (from the repo root):
    python -m solver.run
    python -m solver.run --policy my-policy.json --approver admin
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from .approvals import ApprovalError, finalize_decisions
from .bookings import decide_bookings
from .data import Data, load
from .diff import build_diff
from .exams import solve_exams
from .export import apply_disruption, build_schedule, write_schedule
from .policy import Policy
from .weekly import solve_weekly

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = ROOT / "CrunchWeek_StarterPack" / "data" / "cit_public.json"
DEFAULT_DISRUPTION = ROOT / "CrunchWeek_StarterPack" / "examples" / "sample_disruption.json"
VALIDATOR = ROOT / "CrunchWeek_StarterPack" / "validator.py"
EXPORTS = ROOT / "exports"


def _validate(data_path: Path, schedule_path: Path, extra: list[str]) -> dict:
    json_out = EXPORTS / f"{schedule_path.stem}.report.json"
    cmd = [
        sys.executable, str(VALIDATOR),
        "--data", str(data_path),
        "--schedule", str(schedule_path),
        "--json", str(json_out),
        "--quiet",
        *extra,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    sys.stdout.write(result.stdout)
    if result.stderr:
        sys.stderr.write(result.stderr)
    return json.loads(json_out.read_text(encoding="utf-8"))


def _decide(data: Data, timetable, policy: Policy, approver: str, label: str):
    decisions, stats = decide_bookings(data, timetable, policy)
    export_rows, records = finalize_decisions(data, decisions, policy, approver=approver)
    metadata = {
        "policy_version": policy.version,
        "priority_order": list(policy.priority_order),
        "approver": approver,
        "stats": stats,
        "approvals": records,
        "decisions": decisions,
    }
    print(f"bookings ({label}): {stats}")
    return export_rows, metadata


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(DEFAULT_DATA))
    ap.add_argument("--disruption", default=str(DEFAULT_DISRUPTION))
    ap.add_argument("--policy", default=None, help="JSON with a priority_order permutation")
    ap.add_argument("--approver", default="admin")
    ap.add_argument("--seconds", type=float, default=120.0)
    args = ap.parse_args()

    data_path = Path(args.data)
    data = load(data_path)
    policy = Policy.from_dataset(data, args.policy)
    print(f"policy: {policy.version} {list(policy.priority_order)}")

    EXPORTS.mkdir(exist_ok=True)
    for name in (
        "schedule.json",
        "schedule_after.json",
        "schedule.report.json",
        "schedule_after.report.json",
        "schedule_diff.json",
        "booking_decisions.json",
        "booking_decisions_after.json",
    ):
        (EXPORTS / name).unlink(missing_ok=True)
        (ROOT / "public" / "exports" / name).unlink(missing_ok=True)

    weekly = solve_weekly(data, max_seconds=args.seconds)
    print(f"weekly: {weekly.status} {weekly.detail}")
    if weekly.status != "FEASIBLE":
        return 1
    exams = solve_exams(data)
    print(f"exams:  {exams.status}")
    if exams.status != "FEASIBLE":
        return 1

    try:
        export_rows, booking_meta = _decide(data, weekly.placements, policy, args.approver, "base")
    except ApprovalError as error:
        print(f"FAIL: {error}")
        return 1
    (EXPORTS / "booking_decisions.json").write_text(json.dumps(booking_meta, indent=2), encoding="utf-8")

    schedule = build_schedule(data, weekly.placements, export_rows, exams.placements)
    schedule_path = EXPORTS / "schedule.json"
    write_schedule(schedule_path, schedule)
    print(f"wrote {schedule_path}")

    report = _validate(data_path, schedule_path, [])
    hard = report["hard_violation_count"]
    print(f"schedule.json hard violations: {hard} {report['hard_by_rule']}")
    print(f"soft: {report['soft_total']} {report['soft_penalties']}  bookings: {report.get('bookings')}")

    # -- disruption / rescheduling -----------------------------------------
    disruption = json.loads(Path(args.disruption).read_text(encoding="utf-8"))
    disrupted_raw, extra_fac, extra_room, _added, _removed = apply_disruption(data.raw, disruption)
    disrupted = Data(disrupted_raw)
    after_weekly = solve_weekly(
        disrupted,
        max_seconds=args.seconds,
        extra_faculty_unavailable=extra_fac,
        extra_room_unavailable=extra_room,
        baseline=weekly.placements,
    )
    print(f"weekly (after): {after_weekly.status} moved={after_weekly.moved} {after_weekly.detail}")

    after_hard = 0
    if after_weekly.status == "FEASIBLE":
        try:
            after_rows, after_meta = _decide(
                disrupted, after_weekly.placements, policy, args.approver, "after"
            )
        except ApprovalError as error:
            print(f"FAIL: {error}")
            return 1
        (EXPORTS / "booking_decisions_after.json").write_text(
            json.dumps(after_meta, indent=2), encoding="utf-8"
        )
        after_exams = solve_exams(disrupted)
        after_schedule = build_schedule(disrupted, after_weekly.placements, after_rows, after_exams.placements)
        after_path = EXPORTS / "schedule_after.json"
        write_schedule(after_path, after_schedule)
        print(f"wrote {after_path}")

        diff = build_diff(data, weekly.placements, after_weekly.placements, disruption["changes"])
        (EXPORTS / "schedule_diff.json").write_text(json.dumps(diff, indent=2), encoding="utf-8")
        print(
            f"diff: {diff['moved_count']} moved ({diff['time_changed']} time, "
            f"{diff['room_only_changed']} room-only), directly affected "
            f"{len(diff['directly_affected'])}, minimal={diff['moved_minimal']}"
        )

        after_report = _validate(
            data_path,
            after_path,
            ["--disruption", str(args.disruption), "--baseline", str(schedule_path)],
        )
        after_hard = after_report["hard_violation_count"]
        print(f"schedule_after.json hard violations: {after_hard} {after_report['hard_by_rule']}")
        print(f"stability: {after_report.get('stability')}")
    else:
        after_hard = 1

    # -- publish artifacts for the web app ---------------------------------
    published = ROOT / "public" / "exports"
    published.mkdir(parents=True, exist_ok=True)
    for name in (
        "schedule.json", "schedule_after.json",
        "schedule.report.json", "schedule_after.report.json",
        "booking_decisions.json", "booking_decisions_after.json",
        "schedule_diff.json",
    ):
        src = EXPORTS / name
        if src.exists():
            shutil.copy2(src, published / name)

    if hard or after_hard:
        print(f"FAIL: {hard} hard violations in schedule.json, {after_hard} in schedule_after.json")
        return 1
    print("PASS: both exports have 0 hard violations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
