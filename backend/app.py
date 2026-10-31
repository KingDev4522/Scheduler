"""FastAPI backend for the CIT Scheduler.

Wraps the existing CP-SAT engine in `solver/` and exposes the judge workflow:
import dataset → generate → validate → disruption → diff → exports → reset.

Run:
    python -m pip install -r backend/requirements.txt
    uvicorn backend.app:app --reload --port 8000
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from solver.approvals import ApprovalError, finalize_decisions
from solver.bookings import decide_bookings
from solver.data import Data
from solver.diff import build_diff
from solver.exams import solve_exams
from solver.export import apply_disruption, build_schedule, write_schedule
from solver.manual import validate_manual
from solver.policy import CATEGORIES, Policy
from solver.weekly import solve_weekly

from . import store

ROOT = Path(__file__).resolve().parent.parent
STARTER = ROOT / "CrunchWeek_StarterPack"
DEFAULT_DATA = STARTER / "data" / "cit_public.json"
VALIDATOR = STARTER / "validator.py"
API_EXPORTS = ROOT / "exports" / "api"
API_EXPORTS.mkdir(parents=True, exist_ok=True)

EXPECTED_COUNTS = {
    "rooms": 27,
    "faculty": 40,
    "student_groups": 14,
    "courses": 62,
    "sessions": 189,
    "booking_requests": 25,
    "exams": 41,
}

# Demo identity -> role. The real PS requires four roles; auth is demo-grade here.
DEMO_USERS = {
    "debjeet": "admin",
    "mehul": "club",
    "indranil": "department_coordinator",
    "ananya": "faculty",
}

app = FastAPI(title="CIT Scheduler API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE: dict[str, Any] = {
    "raw": None,
    "data": None,
    "data_path": None,
    "schedule": None,
    "placements": None,
    "report": None,
    "decisions": None,
    "approvals": None,
    "after": None,
    "after_report": None,
    "diff": None,
    "generated_at": None,
    "source": "bundled",
    "policy": None,
    "policy_order": None,
    "policy_version": None,
    "proposal_status": None,
}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _actor(user: str, role: str | None = None) -> tuple[str, str]:
    resolved = DEMO_USERS.get(user)
    if resolved is None:
        raise HTTPException(status_code=401, detail=f"unknown demo user {user!r}")
    if role is not None and role != resolved:
        raise HTTPException(status_code=403, detail="role does not match the demo user")
    return user, resolved


def _require_admin(user: str) -> str:
    name, role = _actor(user)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return name


def _check_dataset(raw: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(raw, dict):
        return ["dataset root must be an object"]
    for key in ("dataset_id", "calendar", "priority_order", "role_category_cap"):
        if key not in raw:
            errors.append(f"missing top-level field {key}")
    for key in EXPECTED_COUNTS:
        if not isinstance(raw.get(key), list):
            errors.append(f"{key} must be an array")
    if errors:
        return errors
    for key, expected in EXPECTED_COUNTS.items():
        actual = len(raw[key])
        if actual != expected:
            errors.append(f"{key}: expected {expected}, got {actual}")
    room_ids = {r.get("id") for r in raw["rooms"]}
    faculty_ids = {f.get("id") for f in raw["faculty"]}
    group_ids = {g.get("id") for g in raw["student_groups"]}
    course_ids = {c.get("id") for c in raw["courses"]}
    for index, session in enumerate(raw["sessions"]):
        if session.get("course_id") not in course_ids:
            errors.append(f"sessions[{index}]: unknown course {session.get('course_id')!r}")
        if session.get("faculty_id") not in faculty_ids:
            errors.append(f"sessions[{index}]: unknown faculty {session.get('faculty_id')!r}")
        for group in session.get("groups", []):
            if group not in group_ids:
                errors.append(f"sessions[{index}]: unknown group {group!r}")
        for room_type in session.get("room_types", []):
            if not any(r.get("type") == room_type for r in raw["rooms"]):
                errors.append(f"sessions[{index}]: no room of type {room_type!r}")
    for index, room in enumerate(raw["rooms"]):
        if room.get("id") not in room_ids:
            errors.append(f"rooms[{index}]: missing id")
    return errors


def _load_raw(raw: dict, source: str, *, persist: bool = True) -> None:
    errors = _check_dataset(raw)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors[:20]})
    try:
        data = Data(raw)
    except Exception as error:  # pragma: no cover - defensive
        raise HTTPException(status_code=422, detail=f"dataset could not be loaded: {error}") from error
    data_path = API_EXPORTS / "dataset.json"
    data_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    policy = Policy.from_dataset(data)
    if persist:
        store.save_dataset(raw, source)
        store.clear_generation()
    STATE.update(
        raw=raw,
        data=data,
        data_path=data_path,
        schedule=None,
        placements=None,
        report=None,
        decisions=None,
        approvals=None,
        after=None,
        after_report=None,
        diff=None,
        generated_at=None,
        source=source,
        policy=policy,
        policy_order=list(policy.priority_order),
        policy_version=policy.version,
        proposal_status=None,
    )
    if persist:
        store.save_state(STATE)


def _validate(data_path: Path, schedule_path: Path, extra: list[str] | None = None) -> dict:
    report_path = API_EXPORTS / f"{schedule_path.stem}.report.json"
    cmd = [
        sys.executable,
        str(VALIDATOR),
        "--data",
        str(data_path),
        "--schedule",
        str(schedule_path),
        "--json",
        str(report_path),
        "--quiet",
        *(extra or []),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode not in (0, 1):  # validator exits 0 even with violations
        raise HTTPException(status_code=500, detail=f"validator failed: {result.stderr[-800:]}")
    return json.loads(report_path.read_text(encoding="utf-8"))


def _summary(report: dict) -> dict:
    return {
        "hard_violation_count": report["hard_violation_count"],
        "hard_by_rule": report["hard_by_rule"],
        "soft_total": report["soft_total"],
        "soft_penalties": report["soft_penalties"],
        "bookings": report.get("bookings"),
        "exam_soft_penalty": report.get("exam_soft_penalty"),
        "stability": report.get("stability"),
    }


def _generate(seconds: float = 90.0) -> dict:
    if STATE["data"] is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    data: Data = STATE["data"]
    policy: Policy = STATE["policy"] or Policy.from_dataset(data)

    weekly = solve_weekly(data, max_seconds=seconds)
    if weekly.status != "FEASIBLE":
        raise HTTPException(
            status_code=422,
            detail={"status": weekly.status, "message": weekly.detail},
        )
    exams = solve_exams(data, max_seconds=min(seconds, 60))
    if exams.status != "FEASIBLE":
        raise HTTPException(status_code=422, detail={"status": exams.status, "message": "exams"})

    decisions, stats = decide_bookings(data, weekly.placements, policy)
    try:
        export_rows, records = finalize_decisions(data, decisions, policy, approver="debjeet")
    except ApprovalError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error

    schedule = build_schedule(data, weekly.placements, export_rows, exams.placements)
    schedule_path = API_EXPORTS / "schedule.json"
    write_schedule(schedule_path, schedule)
    report = _validate(STATE["data_path"], schedule_path)

    STATE.update(
        schedule=schedule,
        placements=weekly.placements,
        report=report,
        decisions=decisions,
        approvals=records,
        generated_at=datetime.now(timezone.utc).isoformat(),
        after=None,
        after_report=None,
        diff=None,
        proposal_status=None,
    )
    store.save_state(STATE)
    return {
        "status": "FEASIBLE",
        "generated_at": STATE["generated_at"],
        "sessions": len(weekly.placements),
        "exams": len(exams.placements),
        "bookings": stats,
        "booking_score": (report.get("bookings") or {}).get("booking_score"),
        "summary": _summary(report),
        "policy_version": policy.version,
    }


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------


@app.on_event("startup")
def _startup() -> None:
    store.init_db()
    raw, source = store.load_dataset()
    if raw is None:
        if DEFAULT_DATA.exists():
            _load_raw(json.loads(DEFAULT_DATA.read_text(encoding="utf-8")), "bundled")
        return
    _load_raw(raw, source or "stored", persist=False)
    saved = store.load_state()
    if saved:
        STATE.update(saved)
        order = saved.get("policy_order")
        if order:
            STATE["policy"] = Policy(
                tuple(order),
                dict(STATE["data"].role_cap),
                saved.get("policy_version") or "stored",
            )


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "dataset_id": (STATE["raw"] or {}).get("dataset_id"),
        "source": STATE["source"],
        "generated": STATE["schedule"] is not None,
        "generated_at": STATE["generated_at"],
        "hard_violations": (STATE["report"] or {}).get("hard_violation_count"),
    }


@app.get("/api/dataset")
def dataset() -> dict:
    raw = STATE["raw"]
    if raw is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    return {
        "dataset_id": raw.get("dataset_id"),
        "institute": raw.get("institute"),
        "source": STATE["source"],
        "counts": {key: len(raw[key]) for key in EXPECTED_COUNTS},
        "priority_order": raw.get("priority_order"),
        "role_category_cap": raw.get("role_category_cap"),
        "policy": {
            "priority_order": STATE["policy_order"],
            "version": STATE["policy_version"],
            "role_category_cap": raw.get("role_category_cap"),
        },
        "generated": STATE["schedule"] is not None,
        "generated_at": STATE["generated_at"],
        "proposal_status": STATE["proposal_status"],
        "entities": {
            "rooms": raw["rooms"],
            "faculty": raw["faculty"],
            "student_groups": raw["student_groups"],
            "courses": raw["courses"],
            "sessions": raw["sessions"],
            "booking_requests": raw["booking_requests"],
            "exams": raw["exams"],
            "calendar": raw["calendar"],
        },
    }


@app.post("/api/import")
async def import_dataset(
    file: UploadFile = File(...),
    x_demo_user: str = Header(default="debjeet"),
) -> dict:
    _require_admin(x_demo_user)
    payload = await file.read()
    try:
        raw = json.loads(payload)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=422, detail=f"invalid JSON: {error}") from error
    _load_raw(raw, file.filename or "uploaded.json")
    return dataset()


@app.post("/api/generate")
def generate(x_demo_user: str = Header(default="debjeet"), seconds: float = 90.0) -> dict:
    _require_admin(x_demo_user)
    return _generate(seconds)


@app.get("/api/schedule")
def schedule() -> dict:
    if STATE["schedule"] is None:
        raise HTTPException(status_code=404, detail="no schedule generated")
    return {
        "schedule": STATE["schedule"],
        "summary": _summary(STATE["report"]),
        "decisions": STATE["decisions"],
        "approvals": STATE["approvals"],
        "diff": STATE["diff"],
        "after": STATE["after"],
        "after_summary": _summary(STATE["after_report"]) if STATE["after_report"] else None,
        "proposal_status": STATE["proposal_status"],
    }


@app.post("/api/disruption")
async def disruption(
    file: UploadFile = File(...),
    x_demo_user: str = Header(default="debjeet"),
    seconds: float = 90.0,
) -> dict:
    _require_admin(x_demo_user)
    if STATE["schedule"] is None or STATE["placements"] is None:
        raise HTTPException(status_code=409, detail="generate a schedule first")
    try:
        change = json.loads(await file.read())
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=422, detail=f"invalid JSON: {error}") from error
    if not isinstance(change.get("changes"), list):
        raise HTTPException(status_code=422, detail="disruption must contain a changes array")
    disruption_path = API_EXPORTS / "disruption.json"
    disruption_path.write_text(json.dumps(change, ensure_ascii=False), encoding="utf-8")

    data: Data = STATE["data"]
    disrupted_raw, extra_fac, extra_room, _added, _removed = apply_disruption(data.raw, change)
    disrupted = Data(disrupted_raw)
    result = solve_weekly(
        disrupted,
        max_seconds=seconds,
        extra_faculty_unavailable=extra_fac,
        extra_room_unavailable=extra_room,
        baseline=STATE["placements"],
    )
    if result.status != "FEASIBLE":
        raise HTTPException(
            status_code=422,
            detail={"status": result.status, "message": "no feasible repair; published schedule unchanged"},
        )
    policy = Policy.from_dataset(disrupted)
    decisions, stats = decide_bookings(disrupted, result.placements, policy)
    export_rows, records = finalize_decisions(disrupted, decisions, policy, approver="debjeet")
    exams = solve_exams(disrupted)
    after_schedule = build_schedule(disrupted, result.placements, export_rows, exams.placements)
    after_path = API_EXPORTS / "proposal_after.json"
    write_schedule(after_path, after_schedule)
    report = _validate(
        STATE["data_path"],
        after_path,
        ["--disruption", str(disruption_path), "--baseline", str(API_EXPORTS / "schedule.json")],
    )
    diff = build_diff(data, STATE["placements"], result.placements, change["changes"])
    stale = API_EXPORTS / "schedule_after.json"
    if stale.exists():
        stale.unlink()
    STATE.update(
        after=after_schedule,
        after_report=report,
        diff=diff,
        approvals=records,
        proposal_status="pending",
    )
    store.save_state(STATE)
    return {
        "status": "FEASIBLE",
        "proposal_status": "pending",
        "moved": diff["moved_count"],
        "time_changed": diff["time_changed"],
        "room_only_changed": diff["room_only_changed"],
        "minimal": diff["moved_minimal"],
        "diff": diff,
        "bookings": stats,
        "summary": _summary(report),
    }


@app.post("/api/approve")
def approve(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    _require_admin(x_demo_user)
    request_id = payload.get("request_id")
    if not request_id:
        raise HTTPException(status_code=422, detail="request_id is required")
    decisions = STATE.get("decisions") or []
    decision = next((d for d in decisions if d["request_id"] == request_id), None)
    if decision is None:
        raise HTTPException(status_code=404, detail="unknown request")
    requester = (STATE["data"].requests[request_id] or {}).get("requester", "")
    if requester.strip().lower() == x_demo_user.strip().lower():
        raise HTTPException(status_code=403, detail="self-approval is not allowed")
    if decision["status"] not in ("approved", "alternative_offered"):
        raise HTTPException(status_code=409, detail=f"request is {decision['status']}")
    return {"ok": True, "approved_by": x_demo_user, "request_id": request_id}


@app.get("/api/policy")
def get_policy() -> dict:
    return {
        "priority_order": STATE["policy_order"],
        "role_category_cap": dict(STATE["data"].role_cap) if STATE["data"] else {},
        "version": STATE["policy_version"],
    }


@app.put("/api/policy")
def put_policy(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    _require_admin(x_demo_user)
    order = payload.get("priority_order")
    if not isinstance(order, list) or sorted(order) != sorted(CATEGORIES):
        raise HTTPException(
            status_code=422,
            detail=f"priority_order must be a permutation of {list(CATEGORIES)}",
        )
    version = str(payload.get("version") or "admin-custom")
    STATE["policy"] = Policy(tuple(order), dict(STATE["data"].role_cap), version)
    STATE["policy_order"] = list(order)
    STATE["policy_version"] = version
    STATE.update(
        schedule=None,
        placements=None,
        report=None,
        decisions=None,
        approvals=None,
        after=None,
        after_report=None,
        diff=None,
        generated_at=None,
        proposal_status=None,
    )
    store.clear_generation()
    store.save_state(STATE)
    for name in ("schedule.json", "schedule_after.json", "proposal_after.json"):
        path = API_EXPORTS / name
        if path.exists():
            path.unlink()
    return get_policy()


@app.post("/api/proposal/approve")
def approve_proposal(x_demo_user: str = Header(default="debjeet")) -> dict:
    _require_admin(x_demo_user)
    if STATE["after"] is None:
        raise HTTPException(status_code=409, detail="no proposal to approve")
    write_schedule(API_EXPORTS / "schedule_after.json", STATE["after"])
    STATE["proposal_status"] = "approved"
    store.save_state(STATE)
    return {
        "ok": True,
        "proposal_status": "approved",
        "summary": _summary(STATE["after_report"]) if STATE["after_report"] else None,
    }


@app.post("/api/proposal/reject")
def reject_proposal(x_demo_user: str = Header(default="debjeet")) -> dict:
    _require_admin(x_demo_user)
    if STATE["after"] is None:
        raise HTTPException(status_code=409, detail="no proposal to reject")
    STATE.update(after=None, after_report=None, diff=None, proposal_status="rejected")
    for name in ("schedule_after.json", "proposal_after.json"):
        path = API_EXPORTS / name
        if path.exists():
            path.unlink()
    store.save_state(STATE)
    return {"ok": True, "proposal_status": "rejected"}


@app.post("/api/manual")
def manual_placement(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    name, role = _actor(x_demo_user)
    if role not in ("admin", "department_coordinator"):
        raise HTTPException(status_code=403, detail="only Admin or Department Coordinator may propose")
    if STATE["placements"] is None:
        raise HTTPException(status_code=409, detail="generate a schedule first")
    session_id = payload.get("session_id")
    day = payload.get("day")
    start = payload.get("start_period")
    room_id = payload.get("room_id")
    if not all([session_id, day, room_id]) or not isinstance(start, int):
        raise HTTPException(
            status_code=422,
            detail="session_id, day, start_period and room_id are required",
        )
    violations = validate_manual(
        STATE["data"], STATE["placements"], session_id, day, start, room_id
    )
    if violations:
        raise HTTPException(status_code=422, detail={"violations": violations})
    return {
        "ok": True,
        "placement": {
            "session_id": session_id,
            "day": day,
            "start_period": start,
            "room_id": room_id,
        },
        "applied": False,
        "note": "validated proposal; apply through the approval workflow",
        "requested_by": name,
    }


@app.get("/api/exports/{name}")
def export_file(name: str) -> FileResponse:
    allowed = {"schedule.json", "schedule_after.json", "schedule.report.json", "schedule_after.report.json"}
    if name not in allowed:
        raise HTTPException(status_code=404, detail="unknown export")
    path = API_EXPORTS / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="export not generated yet")
    return FileResponse(path, media_type="application/json", filename=name)


@app.post("/api/reset")
def reset(x_demo_user: str = Header(default="debjeet")) -> dict:
    _require_admin(x_demo_user)
    store.clear_generation()
    for path in API_EXPORTS.glob("*"):
        if path.is_file():
            path.unlink()
    _load_raw(json.loads(DEFAULT_DATA.read_text(encoding="utf-8")), "bundled")
    return {"ok": True, "message": "dataset reloaded and generated artifacts cleared"}


@app.exception_handler(Exception)
def unhandled(_request, exc: Exception) -> JSONResponse:  # pragma: no cover
    return JSONResponse(status_code=500, content={"detail": f"internal error: {exc}"})
