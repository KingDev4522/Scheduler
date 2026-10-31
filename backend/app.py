"""FastAPI backend for the CIT Scheduler.

Wraps the existing CP-SAT engine in `solver/` and exposes the judge workflow:
import dataset → generate → validate → disruption → diff → exports → reset.

Run:
    python -m pip install -r backend/requirements.txt
    uvicorn backend.app:app --reload --port 8000
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from solver.approvals import ApprovalError, finalize_decisions
from solver.booking_validation import BookingProposal, validate_booking
from solver.bookings import decide_bookings
from solver.data import Data
from solver.diff import build_diff
from solver.exams import solve_exams
from solver.export import apply_disruption, build_schedule, write_schedule
from solver.manual import validate_manual
from solver.policy import CATEGORIES, Policy
from solver.weekly import solve_weekly

from . import store
from .assistant import (
    GEMINI_MODEL,
    AssistantUnavailable,
    configured as gemini_configured,
    model_chain,
    parse_booking_request,
    parse_change_request,
)

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
DEMO_PROFILES = {
    "debjeet": {"displayName": "Debjeet", "department": None},
    "mehul": {"displayName": "Mehul", "department": None},
    "indranil": {"displayName": "Indranil", "department": "CSE"},
    "ananya": {"displayName": "Dr. Ananya Mishra", "department": "CSE"},
}
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "1234")
SESSION_SECRET = os.getenv("SESSION_SECRET") or secrets.token_hex(32)
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "28800"))
ALLOW_DEMO_HEADER = os.getenv("ALLOW_DEMO_HEADER", "1") != "0"
PUBLIC_API_PATHS = {"/api/health", "/api/auth/login"}

app = FastAPI(title="CIT Scheduler API", version="1.0.0")
LOCAL_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", LOCAL_ORIGINS).split(","),
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


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _issue_token(user: str) -> str:
    payload = {"u": user, "exp": int(time.time()) + SESSION_TTL_SECONDS}
    body = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(SESSION_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256)
    return f"{body}.{_b64encode(signature.digest())}"


def _token_user(authorization: str) -> str | None:
    if not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        body, signature = token.split(".", 1)
    except ValueError:
        return None
    expected = hmac.new(
        SESSION_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256
    )
    if not hmac.compare_digest(signature, _b64encode(expected.digest())):
        return None
    try:
        payload = json.loads(_b64decode(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or int(payload.get("exp", 0)) < int(time.time()):
        return None
    user = str(payload.get("u", ""))
    return user if user in DEMO_USERS else None


def _public_user(user: str) -> dict[str, Any]:
    profile = DEMO_PROFILES[user]
    name = profile["displayName"]
    initials = "".join(part[0] for part in name.split()[:2]).upper()
    return {
        "username": user,
        "role": "event_manager" if DEMO_USERS[user] == "club" else DEMO_USERS[user],
        "displayName": name,
        "department": profile["department"],
        "initials": initials,
    }


@app.middleware("http")
async def authenticate(request, call_next):
    # CORS preflight carries no credentials; let CORSMiddleware answer it.
    if request.method == "OPTIONS":
        return await call_next(request)
    path = request.url.path
    if path.startswith("/api/") and path not in PUBLIC_API_PATHS:
        token_user = _token_user(request.headers.get("authorization", ""))
        if token_user:
            headers = [
                (key, value)
                for key, value in request.scope["headers"]
                if key.lower() != b"x-demo-user"
            ]
            headers.append((b"x-demo-user", token_user.encode("ascii")))
            request.scope["headers"] = headers
        else:
            supplied = request.headers.get("x-demo-user", "").strip()
            if not ALLOW_DEMO_HEADER or supplied not in DEMO_USERS:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "authentication required"},
                )
    return await call_next(request)


@app.post("/api/auth/login")
def login(payload: dict) -> dict:
    username = str(payload.get("username") or "").strip().lower()
    password = str(payload.get("password") or "")
    if username not in DEMO_USERS or not hmac.compare_digest(password, DEMO_PASSWORD):
        raise HTTPException(status_code=401, detail="invalid username or password")
    return {"token": _issue_token(username), "user": _public_user(username)}


@app.get("/api/auth/me")
def auth_me(x_demo_user: str = Header(default="debjeet")) -> dict:
    name, _role = _actor(x_demo_user)
    return {"user": _public_user(name)}


def _actor(user: str, role: str | None = None) -> tuple[str, str]:
    if not user:
        raise HTTPException(status_code=401, detail="authentication required")
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
        if key == "booking_requests":
            # Ad-hoc requests approved through the manual workflow are added to
            # the operational dataset; the official pack still has 25.
            if actual < expected:
                errors.append(f"{key}: expected at least {expected}, got {actual}")
        elif actual != expected:
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
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
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


def _invalidate_generation() -> None:
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


def _faculty_for_actor(user: str) -> dict | None:
    matches = [
        member
        for member in (STATE["raw"] or {}).get("faculty", [])
        if user.lower() in str(member.get("name", "")).lower()
    ]
    return matches[0] if len(matches) == 1 else None


def _generate(seconds: float = 90.0) -> dict:
    seconds = min(max(float(seconds), 5.0), 150.0)
    if STATE["data"] is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    data: Data = STATE["data"]
    policy: Policy = STATE["policy"] or Policy.from_dataset(data)

    for name in ("schedule_after.json", "proposal_after.json"):
        stale = API_EXPORTS / name
        if stale.exists():
            stale.unlink()
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
def dataset(x_demo_user: str = Header(default="debjeet")) -> dict:
    _actor(x_demo_user)
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
    payload = await file.read(5_000_001)
    if len(payload) > 5_000_000:
        raise HTTPException(status_code=413, detail="dataset upload exceeds 5 MB")
    try:
        raw = json.loads(payload)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=422, detail=f"invalid JSON: {error}") from error
    _load_raw(raw, file.filename or "uploaded.json")
    return dataset()


@app.post("/api/generate")
def generate(x_demo_user: str = Header(default="debjeet"), seconds: float = 90.0) -> dict:
    _require_admin(x_demo_user)
    seconds = min(max(float(seconds), 5.0), 150.0)
    return _generate(seconds)


@app.get("/api/schedule")
def schedule(x_demo_user: str = Header(default="debjeet")) -> dict:
    _actor(x_demo_user)
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
    seconds = min(max(float(seconds), 5.0), 150.0)
    if STATE["schedule"] is None or STATE["placements"] is None:
        raise HTTPException(status_code=409, detail="generate a schedule first")
    try:
        payload = await file.read(5_000_001)
        if len(payload) > 5_000_000:
            raise HTTPException(status_code=413, detail="disruption upload exceeds 5 MB")
        change = json.loads(payload)
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
    decision["approved_by"] = x_demo_user
    decision["approved_at"] = datetime.now(timezone.utc).isoformat()
    store.save_state(STATE)
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
    STATE["proposal_approved_by"] = x_demo_user
    STATE["proposal_approved_at"] = datetime.now(timezone.utc).isoformat()
    store.save_state(STATE)
    return {
        "ok": True,
        "proposal_status": "approved",
        "approved_by": x_demo_user,
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


def _approved_bookings() -> list[dict]:
    out = []
    for decision in STATE.get("decisions") or []:
        if decision.get("status") in ("approved", "alternative_offered"):
            out.append(decision)
    return out


def _proposal_from_payload(payload: dict, actor_name: str, role: str) -> BookingProposal:
    data: Data | None = STATE["data"]
    if data is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    try:
        attendance = int(payload.get("attendance") or 0)
        duration = int(payload.get("duration_periods") or 0)
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail="attendance and duration_periods must be integers") from error
    windows = []
    for window in payload.get("windows") or []:
        if not isinstance(window, dict) or window.get("day") not in data.days:
            raise HTTPException(status_code=422, detail="invalid window day")
        try:
            windows.append(
                {
                    "day": window["day"],
                    "from_period": int(window["from_period"]),
                    "to_period": int(window["to_period"]),
                }
            )
        except (KeyError, TypeError, ValueError) as error:
            raise HTTPException(status_code=422, detail="invalid window periods") from error
    return BookingProposal(
        title=str(payload.get("title") or "Untitled request"),
        requester=str(payload.get("requester") or actor_name),
        role=role,
        attendance=attendance,
        duration_periods=duration,
        windows=windows,
        room_types=list(payload.get("room_types") or []),
        needs=list(payload.get("needs") or []),
        requested_room=payload.get("requested_room") or None,
        mandatory_for_groups=list(payload.get("mandatory_for_groups") or []),
        raw_text=str(payload.get("raw_text") or ""),
        requested_category=payload.get("requested_category") or None,
        day=payload.get("day") or None,
        start_period=payload.get("start_period") if isinstance(payload.get("start_period"), int) else None,
    )


def _validate_proposal(payload: dict, actor_name: str, role: str) -> tuple[BookingProposal, dict]:
    proposal = _proposal_from_payload(payload, actor_name, role)
    result = validate_booking(
        STATE["data"],
        STATE["placements"] or {},
        proposal,
        _approved_bookings(),
    )
    return proposal, result


@app.get("/api/assistant/status")
def assistant_status() -> dict:
    return {
        "configured": gemini_configured(),
        "model": GEMINI_MODEL,
        "models": model_chain(),
        "fallback": "local-rules",
    }


@app.post("/api/assistant/parse")
def assistant_parse(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    _actor(x_demo_user)
    text = payload.get("text")
    if not isinstance(text, str) or len(text.strip()) < 5:
        raise HTTPException(status_code=422, detail="text is required")
    kind = payload.get("kind") or "booking"
    try:
        parsed = (
            parse_change_request(STATE["data"], text)
            if kind == "change"
            else parse_booking_request(STATE["data"], text)
        )
    except AssistantUnavailable as error:
        raise HTTPException(
            status_code=503,
            detail={"message": str(error), "fallback": "manual"},
        ) from error
    return {
        "source": "gemini",
        "model": parsed.model,
        "draft": parsed.draft,
        "follow_up": parsed.follow_up,
    }


@app.post("/api/bookings/validate")
def validate_booking_request(
    payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    proposal, result = _validate_proposal(payload, name, role)
    return {**result, "category": proposal.category(STATE["data"])}


@app.post("/api/bookings/submit")
def submit_booking_request(
    payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    proposal, result = _validate_proposal(payload, name, role)
    if not result["ok"]:
        raise HTTPException(
            status_code=422,
            detail={"violations": result["violations"], "alternatives": result["alternatives"]},
        )
    request_id = f"ADH-{int(datetime.now().timestamp() * 1000)}"
    request = proposal.as_official(
        STATE["data"], request_id, datetime.now(timezone.utc).isoformat()
    )
    store.save_submission(request)
    return {"ok": True, "status": "pending", "request": request}


@app.get("/api/bookings")
def list_booking_requests(x_demo_user: str = Header(default="debjeet")) -> dict:
    name, role = _actor(x_demo_user)
    items = store.list_submissions()
    if role in ("club", "faculty"):
        items = [item for item in items if item.get("requester") == name]
    return {"items": items}


@app.post("/api/bookings/{request_id}/decide")
def decide_booking_request(
    request_id: str, payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    submission = store.get_submission(request_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="unknown request")
    if submission.get("status") != "pending":
        raise HTTPException(status_code=409, detail="request already decided")
    if str(submission.get("requester", "")).lower() == name.lower():
        raise HTTPException(status_code=403, detail="self-approval is not allowed")
    decision = payload.get("decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="decision must be approved or rejected")
    reason = str(payload.get("reason") or "").strip()
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="a reason is required")
    store.decide_submission(request_id, decision, name, reason)

    if decision == "approved":
        official = {
            key: submission[key]
            for key in (
                "id",
                "submitted_at",
                "requester",
                "role",
                "department",
                "requested_category",
                "title",
                "attendance",
                "duration_periods",
                "windows",
                "room_types",
                "needs",
                "requested_room",
                "mandatory_for_groups",
                "series_id",
                "raw_text",
            )
            if key in submission
        }
        if not any(item.get("id") == request_id for item in STATE["raw"]["booking_requests"]):
            STATE["raw"]["booking_requests"].append(official)
            store.save_dataset(STATE["raw"], STATE["source"])
            STATE["data"] = Data(STATE["raw"])
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
    return {"ok": True, "status": decision}


@app.post("/api/bookings/{request_id}/cancel")
def cancel_booking_request(
    request_id: str, payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    submission = store.get_submission(request_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="unknown request")
    if role != "admin" and str(submission.get("requester", "")).lower() != name.lower():
        raise HTTPException(status_code=403, detail="you may only cancel your own request")
    if submission.get("status") not in ("pending", "approved", "alternative_offered"):
        raise HTTPException(status_code=409, detail=f"request is {submission.get('status')}")
    reason = str(payload.get("reason") or "cancelled by requester").strip()
    store.decide_submission(request_id, "cancelled", name, reason)
    return {"ok": True, "status": "cancelled", "request_id": request_id, "cancelled_by": name}


@app.get("/api/faculty/availability")
def faculty_availability(
    faculty_id: str | None = None, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    record = None
    if faculty_id:
        record = next(
            (f for f in (STATE["raw"] or {}).get("faculty", []) if f.get("id") == faculty_id),
            None,
        )
    elif role == "faculty":
        record = _faculty_for_actor(name)
    if record is None:
        raise HTTPException(status_code=404, detail="faculty member not found")
    return {
        "faculty_id": record["id"],
        "name": record.get("name"),
        "department": record.get("department"),
        "unavailable": record.get("unavailable", []),
    }


@app.put("/api/faculty/availability")
def set_faculty_availability(
    payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    record = _faculty_for_actor(name) if role == "faculty" else None
    if role == "admin" and payload.get("faculty_id"):
        record = next(
            (
                f
                for f in (STATE["raw"] or {}).get("faculty", [])
                if f.get("id") == payload["faculty_id"]
            ),
            None,
        )
    if role not in ("faculty", "admin"):
        raise HTTPException(status_code=403, detail="Faculty or Admin only")
    if record is None:
        raise HTTPException(status_code=404, detail="faculty member not found")
    unavailable = payload.get("unavailable")
    if not isinstance(unavailable, list):
        raise HTTPException(status_code=422, detail="unavailable must be a list")
    days = set(STATE["data"].days)
    cleaned = []
    for item in unavailable:
        if not isinstance(item, dict) or item.get("day") not in days:
            raise HTTPException(status_code=422, detail="each entry needs a valid day")
        periods = item.get("periods")
        if not isinstance(periods, list) or not all(
            isinstance(period, int) and 1 <= period <= 13 for period in periods
        ):
            raise HTTPException(status_code=422, detail="periods must be integers 1..13")
        cleaned.append(
            {
                "day": item["day"],
                "periods": sorted(set(periods)),
                "reason": str(item.get("reason") or "Marked unavailable"),
            }
        )
    record["unavailable"] = cleaned
    store.save_dataset(STATE["raw"], STATE["source"])
    STATE["data"] = Data(STATE["raw"])
    _invalidate_generation()
    return faculty_availability(record["id"], x_demo_user)


@app.post("/api/change-requests")
def create_change_request(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    name, role = _actor(x_demo_user)
    if role not in ("faculty", "department_coordinator", "admin"):
        raise HTTPException(status_code=403, detail="Faculty, Coordinator or Admin only")
    text = payload.get("text")
    if not isinstance(text, str) or len(text.strip()) < 5:
        raise HTTPException(status_code=422, detail="text is required")
    try:
        parsed = parse_change_request(STATE["data"], text)
    except AssistantUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    request_id = f"CHG-{int(datetime.now().timestamp() * 1000)}"
    record = {
        "id": request_id,
        "requester": name,
        "role": role,
        "text": text.strip()[:4000],
        "draft": parsed.draft,
        "follow_up": parsed.follow_up,
        "model": parsed.model,
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "decided_by": None,
        "decided_at": None,
        "reason": None,
    }
    store.save_change_request(record)
    return record


@app.get("/api/change-requests")
def list_change_requests(x_demo_user: str = Header(default="debjeet")) -> dict:
    name, role = _actor(x_demo_user)
    items = store.list_change_requests()
    if role in ("faculty", "club"):
        items = [item for item in items if item.get("requester") == name]
    return {"items": items}


@app.post("/api/change-requests/{request_id}/decide")
def decide_change_request(
    request_id: str, payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    record = store.get_change_request(request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="unknown change request")
    if record.get("status") != "pending":
        raise HTTPException(status_code=409, detail="request already decided")
    if str(record.get("requester", "")).lower() == name.lower():
        raise HTTPException(status_code=403, detail="self-approval is not allowed")
    decision = payload.get("decision")
    reason = str(payload.get("reason") or "").strip()
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="decision must be approved or rejected")
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="a reason is required")
    store.decide_change_request(request_id, decision, name, reason)
    return {
        "ok": True,
        "status": decision,
        "request_id": request_id,
        "decided_by": name,
        "note": "Approval records the decision; apply the move through the disruption/approval workflow.",
    }


@app.get("/api/exports/{name}")
def export_file(name: str) -> FileResponse:
    allowed = {"schedule.json", "schedule_after.json", "schedule.report.json", "schedule_after.report.json"}
    if name not in allowed:
        raise HTTPException(status_code=404, detail="unknown export")
    if name.startswith("schedule_after") and STATE["proposal_status"] != "approved":
        raise HTTPException(status_code=409, detail="post-disruption export is not approved")
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


# --------------------------------------------------------------------------
# Production: serve the built SPA from the same origin (no CORS needed).
# --------------------------------------------------------------------------

DIST = ROOT / "dist"
if DIST.exists():
    assets = DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "docs", "openapi.json", "redoc")):
            raise HTTPException(status_code=404, detail="not found")
        candidate = (DIST / full_path).resolve()
        if candidate.is_file() and str(candidate).startswith(str(DIST.resolve())):
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
