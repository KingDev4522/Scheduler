"""FastAPI backend for the CIT Scheduler.

Wraps the existing CP-SAT engine in `solver/` and exposes the judge workflow:
import dataset → generate → validate → disruption → diff → exports → reset.

Run:
    python -m pip install -r backend/requirements.txt
    uvicorn backend.app:app --reload --port 8000
"""

from __future__ import annotations

import base64
import copy
import hashlib
import hmac
import json
import os
import secrets
import shutil
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
from solver.manual import suggest_session_alternatives, validate_manual
from solver.policy import CATEGORIES, Policy
from solver.weekly import solve_weekly

from . import store
from .console import banner, done, error, install_sarcastic_access_logs, rule, step, warn
from .semester import derive_semester, weeks_for_dates
from .occupancy import build_availability, build_session_availability
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
# Keep demo-header access opt-in. Judges use the documented demo logins; a
# public deployment must not accept an unsigned identity header.
ALLOW_DEMO_HEADER = os.getenv("ALLOW_DEMO_HEADER", "0") == "1"
PUBLIC_API_PATHS = {"/api/health", "/api/auth/login"}

app = FastAPI(title="CIT Scheduler API", version="1.0.0")

# ── CORS ────────────────────────────────────────────────────────────────
# The SPA and the API are deployed on different origins (Vercel frontend,
# Render backend). A browser blocks the request at the preflight unless the
# calling origin is allowed here, before any of our own code runs.
LOCAL_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)
# The live frontend. Kept in code as well as in CORS_ORIGINS so a stale env var
# on the host can never lock the deployed site out of its own API.
DEPLOYED_ORIGINS = (
    "https://cit-scheduler-4-idiots.vercel.app",
)


def _cors_origins() -> list[str]:
    extra = [
        origin.strip().rstrip("/")
        for origin in (os.getenv("CORS_ORIGINS") or "").split(",")
        if origin.strip() and origin.strip() != "*"
    ]
    ordered: list[str] = []
    for origin in (*DEPLOYED_ORIGINS, *LOCAL_ORIGINS, *extra):
        if origin and origin not in ordered:
            ordered.append(origin)
    return ordered


# Vercel gives every preview build its own hostname, so previews match by
# pattern while the explicit list above pins the production origin.
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or r"https://[a-z0-9-]+\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
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
    "after_placements": None,
    "after_decisions": None,
    "after_approvals": None,
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
    try:
        password_ok = hmac.compare_digest(password, DEMO_PASSWORD)
    except TypeError:
        password_ok = False
    if username not in DEMO_USERS or not password_ok:
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


def _submission_room_id(item: dict) -> str:
    return str(item.get("room_id") or item.get("requested_room") or "")


def _scoped_submissions(role: str, name: str, items: list[dict]) -> list[dict]:
    """Admin sees all; a coordinator sees their own + their department's labs."""
    if role == "admin":
        return items
    if role == "department_coordinator":
        return [
            item
            for item in items
            if item.get("requester") == name
            or _coordinator_can_decide_room(name, _submission_room_id(item))
        ]
    return [item for item in items if item.get("requester") == name]


def _scoped_changes(role: str, name: str, items: list[dict]) -> list[dict]:
    """Change requests are visible to the requester and to Admin (who decides them)."""
    if role == "admin":
        return items
    return [item for item in items if item.get("requester") == name]


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
    for key in ("rooms", "faculty", "student_groups", "courses", "sessions", "exams", "booking_requests"):
        ids = [item.get("id") for item in raw[key] if isinstance(item, dict)]
        if len(ids) != len(set(ids)):
            errors.append(f"{key}: duplicate ids")
    order = raw.get("priority_order")
    if not isinstance(order, list) or sorted(order) != sorted(CATEGORIES):
        errors.append(f"priority_order must be a permutation of {list(CATEGORIES)}")
    caps = raw.get("role_category_cap")
    if not isinstance(caps, dict):
        errors.append("role_category_cap must be an object")
    else:
        for role, cap in caps.items():
            if cap not in CATEGORIES:
                errors.append(f"role_category_cap[{role!r}] is not a valid category")
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
        fixed = session.get("fixed_slot")
        if fixed and (fixed.get("day") not in raw["calendar"]["days"] or not isinstance(fixed.get("start_period"), int)):
            errors.append(f"sessions[{index}]: invalid fixed_slot")
    for index, room in enumerate(raw["rooms"]):
        if not room.get("id") or not room.get("type"):
            errors.append(f"rooms[{index}]: id and type are required")
    for index, entry in enumerate(raw.get("room_unavailability", [])):
        if entry.get("room_id") not in room_ids:
            errors.append(f"room_unavailability[{index}]: unknown room_id")
        if entry.get("day") not in raw["calendar"]["days"]:
            errors.append(f"room_unavailability[{index}]: invalid day")
    for index, member in enumerate(raw["faculty"]):
        for entry in member.get("unavailable", []):
            if entry.get("day") not in raw["calendar"]["days"]:
                errors.append(f"faculty[{index}]: invalid unavailable day")
            if not isinstance(entry.get("periods"), list):
                errors.append(f"faculty[{index}]: unavailable periods must be a list")
    for index, exam in enumerate(raw["exams"]):
        for course_id in exam.get("course_ids", []):
            if course_id not in course_ids:
                errors.append(f"exams[{index}]: unknown course {course_id!r}")
        for group in exam.get("groups", []):
            if group not in group_ids:
                errors.append(f"exams[{index}]: unknown group {group!r}")
        if not isinstance(exam.get("size"), int) or exam["size"] <= 0:
            errors.append(f"exams[{index}]: size must be a positive integer")
    for index, request in enumerate(raw["booking_requests"]):
        if request.get("role") not in raw["role_category_cap"]:
            errors.append(f"booking_requests[{index}]: unknown role")
        if request.get("requested_category") not in CATEGORIES:
            errors.append(f"booking_requests[{index}]: unknown category")
        for window in request.get("windows", []):
            if window.get("day") not in raw["calendar"]["days"]:
                errors.append(f"booking_requests[{index}]: invalid window day")
            if not isinstance(window.get("from_period"), int) or not isinstance(window.get("to_period"), int):
                errors.append(f"booking_requests[{index}]: window periods must be integers")
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
        _clear_api_exports()
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
        after_placements=None,
        after_decisions=None,
        after_approvals=None,
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
    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"validator failed (exit {result.returncode}): {result.stderr[-1200:]}",
        )
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
        after_placements=None,
        after_decisions=None,
        after_approvals=None,
        after_report=None,
        diff=None,
        generated_at=None,
        proposal_status=None,
    )
    store.clear_generation()
    store.save_state(STATE)
    _clear_api_exports()


API_EXPORT_NAMES = (
    "schedule.json",
    "schedule.report.json",
    "schedule_after.json",
    "schedule_after.report.json",
    "proposal_after.json",
    "proposal_after.report.json",
    "disruption.json",
)


def _clear_api_exports() -> None:
    for name in API_EXPORT_NAMES:
        path = API_EXPORTS / name
        if path.exists():
            path.unlink()


ROOM_DEPARTMENT = {
    "CS-LAB-1": "CSE",
    "CS-LAB-2": "CSE",
    "ELEC-LAB-1": "ECE",
    "ELEC-LAB-2": "ECE",
    "PHY-LAB": "SCIENCE",
    "MECH-WS": "ME",
    "CIVIL-LAB": "CE",
}


def _room_department(room_id: str | None) -> str | None:
    if not room_id:
        return None
    if room_id in ROOM_DEPARTMENT:
        return ROOM_DEPARTMENT[room_id]
    upper = room_id.upper()
    if upper.startswith("CS-LAB"):
        return "CSE"
    if upper.startswith("ELEC-LAB"):
        return "ECE"
    if upper.startswith("PHY-LAB"):
        return "SCIENCE"
    if upper.startswith("MECH"):
        return "ME"
    if upper.startswith("CIVIL-LAB"):
        return "CE"
    return None


def _actor_department(user: str) -> str | None:
    return DEMO_PROFILES.get(user, {}).get("department")


def _coordinator_can_decide_room(user: str, room_id: str | None) -> bool:
    department = _actor_department(user)
    return bool(department and _room_department(room_id) == department)


def _session_department(session_id: str | None) -> str | None:
    data: Data | None = STATE.get("data")
    if data is None or not session_id:
        return None
    session = data.sessions.get(session_id)
    if session is None:
        return None
    for group_id in session.get("groups", []):
        group = data.groups.get(group_id)
        if group and group.get("department"):
            return str(group["department"])
    course = data.courses.get(session.get("course_id"))
    if course and course.get("department"):
        return str(course["department"])
    faculty = data.faculty.get(session.get("faculty_id"))
    if faculty and faculty.get("department"):
        return str(faculty["department"])
    return None


def _coordinator_can_decide_session(user: str, session_id: str | None) -> bool:
    department = _actor_department(user)
    return bool(department and _session_department(session_id) == department)


def _infeasible_hints(data: Data, extra_fac: set, extra_room: set) -> list[str]:
    hints: list[str] = []
    faculty_unavailable = data.fac_unavailable | extra_fac
    for session in data.sessions.values():
        starts = data.legal_starts(session["duration"], session["kind"])
        usable = []
        for day in data.days:
            for start in starts:
                fixed = session.get("fixed_slot")
                if fixed and (fixed["day"] != day or fixed["start_period"] != start):
                    continue
                if any(
                    (session["faculty_id"], day, p) in faculty_unavailable
                    for p in data.block(start, session["duration"])
                ):
                    continue
                usable.append((day, start))
        if not usable:
            hints.append(
                f"{session['id']}: no legal teaching slot after closures, fixed-slot or daily-hour rules"
            )
        if not data.eligible_rooms(session):
            hints.append(
                f"{session['id']}: no room matches type, capacity or accessibility"
            )
    return hints[:25] or [
        "no single-session precheck failed; the combined room, faculty, group and basket constraints are infeasible"
    ]


def _check_disruption(data: Data, change: dict) -> list[str]:
    errors: list[str] = []
    changes = change.get("changes")
    if not isinstance(changes, list) or not changes:
        return ["changes must be a non-empty array"]
    for index, item in enumerate(changes):
        if not isinstance(item, dict):
            errors.append(f"changes[{index}] must be an object")
            continue
        kind = item.get("type")
        prefix = f"changes[{index}]"
        if kind == "faculty_unavailable":
            if item.get("faculty_id") not in data.faculty:
                errors.append(f"{prefix}: unknown faculty_id")
            for day in item.get("days", []):
                if day not in data.days:
                    errors.append(f"{prefix}: invalid day {day!r}")
            periods = item.get("periods")
            if not isinstance(periods, list) or not all(
                isinstance(p, int) and 1 <= p <= 13 for p in periods
            ):
                errors.append(f"{prefix}: periods must be integers 1..13")
        elif kind == "room_unavailable":
            if item.get("room_id") not in data.rooms:
                errors.append(f"{prefix}: unknown room_id")
            for day in item.get("days", []):
                if day not in data.days:
                    errors.append(f"{prefix}: invalid day {day!r}")
            periods = item.get("periods")
            if not isinstance(periods, list) or not all(
                isinstance(p, int) and 1 <= p <= 13 for p in periods
            ):
                errors.append(f"{prefix}: periods must be integers 1..13")
        elif kind == "add_faculty":
            faculty = item.get("faculty")
            if not isinstance(faculty, dict):
                errors.append(f"{prefix}: faculty object is required")
            elif faculty.get("id") in data.faculty:
                errors.append(f"{prefix}: faculty id already exists")
            elif not faculty.get("id") or not faculty.get("name"):
                errors.append(f"{prefix}: faculty id and name are required")
        elif kind == "add_session":
            session = item.get("session")
            if not isinstance(session, dict):
                errors.append(f"{prefix}: session object is required")
                continue
            if session.get("id") in data.sessions:
                errors.append(f"{prefix}: session id already exists")
            if session.get("course_id") not in data.courses:
                errors.append(f"{prefix}: unknown course_id")
            if session.get("faculty_id") not in data.faculty:
                errors.append(f"{prefix}: unknown faculty_id")
            for group in session.get("groups", []):
                if group not in data.groups:
                    errors.append(f"{prefix}: unknown group {group!r}")
            if session.get("kind") not in ("lecture", "tutorial", "lab"):
                errors.append(f"{prefix}: invalid kind")
            if not isinstance(session.get("duration"), int) or not (1 <= session["duration"] <= 9):
                errors.append(f"{prefix}: duration must be 1..9")
            for room_type in session.get("room_types", []):
                if not any(r["type"] == room_type for r in data.rooms.values()):
                    errors.append(f"{prefix}: no room of type {room_type!r}")
        elif kind == "remove_session":
            if item.get("session_id") not in data.sessions:
                errors.append(f"{prefix}: unknown session_id")
        else:
            errors.append(f"{prefix}: unknown change type {kind!r}")
    return errors


def _faculty_for_actor(user: str) -> dict | None:
    matches = [
        member
        for member in (STATE["raw"] or {}).get("faculty", [])
        if user.lower() in str(member.get("name", "")).lower()
    ]
    return matches[0] if len(matches) == 1 else None


def _generate(seconds: float = 120.0) -> dict:
    seconds = min(max(float(seconds), 5.0), 150.0)
    rule("Official schedule generation")
    step(1, 6, "Waking the dataset. It was sleeping on the job.")
    if STATE["data"] is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    data: Data = STATE["data"]
    policy: Policy = STATE["policy"] or Policy.from_dataset(data)
    done(f"Dataset awake: {len(data.sessions)} sessions, {len(data.exams)} exams. Miracles happen.")

    for name in ("schedule_after.json", "proposal_after.json"):
        stale = API_EXPORTS / name
        if stale.exists():
            stale.unlink()
    step(2, 6, f"Asking CP-SAT to place {len(data.sessions)} sessions. It enjoys showing off.")
    weekly = solve_weekly(data, max_seconds=seconds)
    if weekly.status != "FEASIBLE":
        error(f"weekly solver returned {weekly.status}")
        raise HTTPException(
            status_code=422,
            detail={"status": weekly.status, "message": weekly.detail},
        )
    done(f"{len(weekly.placements)} sessions placed. No chairs were harmed.")
    step(3, 6, "Herding exams into rooms. Half capacity, full drama.")
    exams = solve_exams(data, max_seconds=min(seconds, 60))
    if exams.status != "FEASIBLE":
        error(f"exam solver returned {exams.status}")
        raise HTTPException(status_code=422, detail={"status": exams.status, "message": "exams"})
    done(f"{len(exams.placements)} exams placed. Students will still complain.")

    step(4, 6, "Reading Spectra requests like a very tired bouncer.")
    decisions, stats = decide_bookings(data, weekly.placements, policy)
    done(
        f"{stats.get('approved', 0)} approved, "
        f"{stats.get('alternative', 0)} got the polite maybe."
    )
    try:
        export_rows, records = finalize_decisions(data, decisions, policy, approver="debjeet")
    except ApprovalError as approval_error:
        raise HTTPException(status_code=403, detail=str(approval_error)) from approval_error

    step(5, 6, "Running the official validator — the only opinion that counts.")
    schedule = build_schedule(data, weekly.placements, export_rows, exams.placements)
    schedule_path = API_EXPORTS / "schedule.json"
    write_schedule(schedule_path, schedule)
    report = _validate(STATE["data_path"], schedule_path)
    hard = report.get("hard_violation_count", 0)
    if hard:
        schedule_path.unlink(missing_ok=True)
        (API_EXPORTS / "schedule.report.json").unlink(missing_ok=True)
        error(f"{hard} hard violations. Refusing to publish an invalid schedule.")
        raise HTTPException(
            status_code=422,
            detail={
                "status": "INVALID",
                "hard_violation_count": hard,
                "violations": report.get("hard_violations", [])[:40],
            },
        )
    done(f"{hard} hard violations. Suspiciously competent.")

    step(6, 6, "Writing exports. Paperwork, but make it digital.")
    STATE.update(
        schedule=schedule,
        placements=weekly.placements,
        report=report,
        decisions=decisions,
        approvals=records,
        generated_at=datetime.now(timezone.utc).isoformat(),
        after=None,
        after_placements=None,
        after_decisions=None,
        after_approvals=None,
        after_report=None,
        diff=None,
        proposal_status=None,
    )
    store.save_state(STATE)
    done("schedule.json written. Go show off.")
    rule("Generation complete — go brag in Official Data.")
    print(
        f"      sessions={len(weekly.placements)} exams={len(exams.placements)} "
        f"hard={hard} soft={report.get('soft_total', 0)} "
        f"booking={(report.get('bookings') or {}).get('booking_score')}",
        flush=True,
    )
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
    install_sarcastic_access_logs()
    store.init_db()
    raw, source = store.load_dataset()
    if raw is None:
        if DEFAULT_DATA.exists():
            _load_raw(json.loads(DEFAULT_DATA.read_text(encoding="utf-8")), "bundled")
        banner(
            (STATE["raw"] or {}).get("dataset_id"),
            STATE["source"],
            STATE["schedule"] is not None,
        )
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
    banner(
        (STATE["raw"] or {}).get("dataset_id"),
        STATE["source"],
        STATE["schedule"] is not None,
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
        "semester": derive_semester(raw),
        "entities": {
            "rooms": raw["rooms"],
            "faculty": raw["faculty"],
            "student_groups": raw["student_groups"],
            "courses": raw["courses"],
            "sessions": raw["sessions"],
            "booking_requests": raw["booking_requests"],
            "exams": raw["exams"],
            "calendar": raw["calendar"],
            "room_unavailability": raw.get("room_unavailability", []),
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
def generate(x_demo_user: str = Header(default="debjeet"), seconds: float = 120.0) -> dict:
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
    seconds: float = 120.0,
) -> dict:
    _require_admin(x_demo_user)
    seconds = min(max(float(seconds), 5.0), 150.0)
    rule("Disruption repair")
    step(1, 5, "Reading the change file. Hopefully it's a small problem.")
    if STATE["schedule"] is None or STATE["placements"] is None:
        raise HTTPException(status_code=409, detail="generate a schedule first")
    try:
        payload = await file.read(5_000_001)
        if len(payload) > 5_000_000:
            raise HTTPException(status_code=413, detail="disruption upload exceeds 5 MB")
        change = json.loads(payload)
    except json.JSONDecodeError as json_error:
        raise HTTPException(status_code=422, detail=f"invalid JSON: {json_error}") from json_error
    if not isinstance(change.get("changes"), list):
        raise HTTPException(status_code=422, detail="disruption must contain a changes array")
    data: Data = STATE["data"]
    disruption_errors = _check_disruption(data, change)
    if disruption_errors:
        raise HTTPException(status_code=422, detail={"errors": disruption_errors[:20]})
    disruption_path = API_EXPORTS / "disruption.json"
    disruption_path.write_text(json.dumps(change, ensure_ascii=False), encoding="utf-8")
    done(f"{len(change['changes'])} change(s) read. Brave.")

    disrupted_raw, extra_fac, extra_room, _added, _removed = apply_disruption(data.raw, change)
    disrupted = Data(disrupted_raw)
    step(2, 5, "Repairing with CP-SAT. Minimum movement, maximum smugness.")
    result = solve_weekly(
        disrupted,
        max_seconds=seconds,
        extra_faculty_unavailable=extra_fac,
        extra_room_unavailable=extra_room,
        baseline=STATE["placements"],
    )
    if result.status != "FEASIBLE":
        hints = _infeasible_hints(disrupted, extra_fac, extra_room)
        error(f"repair returned {result.status}. The schedule stays untouched.")
        raise HTTPException(
            status_code=422,
            detail={
                "status": result.status,
                "message": "no feasible repair; published schedule unchanged",
                "conflicts": hints,
            },
        )
    done("Repair found. Nobody has to panic.")
    step(3, 5, "Re-evaluating bookings after the repair.")
    policy = Policy.from_dataset(disrupted)
    decisions, stats = decide_bookings(disrupted, result.placements, policy)
    export_rows, records = finalize_decisions(disrupted, decisions, policy, approver="debjeet")
    exams = solve_exams(disrupted)
    if exams.status != "FEASIBLE":
        raise HTTPException(
            status_code=422,
            detail={"status": exams.status, "message": "exam week has no feasible assignment"},
        )
    after_schedule = build_schedule(disrupted, result.placements, export_rows, exams.placements)
    after_path = API_EXPORTS / "proposal_after.json"
    write_schedule(after_path, after_schedule)
    step(4, 5, "Validating the proposal. The validator has no friends.")
    report = _validate(
        STATE["data_path"],
        after_path,
        ["--disruption", str(disruption_path), "--baseline", str(API_EXPORTS / "schedule.json")],
    )
    hard = report.get("hard_violation_count", 0)
    if hard:
        after_path.unlink(missing_ok=True)
        (API_EXPORTS / "proposal_after.report.json").unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail={
                "status": "INVALID",
                "hard_violation_count": hard,
                "violations": report.get("hard_violations", [])[:40],
            },
        )
    done(f"{hard} hard violations. Rude, but acceptable.")
    step(5, 5, "Building the exact diff.")
    diff = build_diff(data, STATE["placements"], result.placements, change["changes"])
    done(f"{diff['moved_count']} moved. Minimal movement, minimal drama.")
    stale = API_EXPORTS / "schedule_after.json"
    if stale.exists():
        stale.unlink()
    STATE.update(
        after=after_schedule,
        after_placements=result.placements,
        after_decisions=decisions,
        after_approvals=records,
        after_report=report,
        diff=diff,
        approvals=records,
        proposal_status="pending",
        proposal_approved_by=None,
        proposal_approved_at=None,
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
        after_placements=None,
        after_decisions=None,
        after_approvals=None,
        after_report=None,
        diff=None,
        generated_at=None,
        proposal_status=None,
    )
    store.clear_generation()
    store.save_state(STATE)
    _clear_api_exports()
    return get_policy()


@app.post("/api/proposal/approve")
def approve_proposal(x_demo_user: str = Header(default="debjeet")) -> dict:
    _require_admin(x_demo_user)
    if STATE["after"] is None or STATE["after_placements"] is None:
        raise HTTPException(status_code=409, detail="no proposal to approve")
    if (STATE["after_report"] or {}).get("hard_violation_count", 0):
        raise HTTPException(status_code=409, detail="proposal has hard violations and cannot be approved")
    write_schedule(API_EXPORTS / "schedule_after.json", STATE["after"])
    write_schedule(API_EXPORTS / "schedule.json", STATE["after"])
    STATE.update(
        schedule=STATE["after"],
        placements=STATE["after_placements"],
        report=STATE["after_report"],
        decisions=STATE["after_decisions"],
        approvals=STATE["after_approvals"],
        proposal_status="approved",
        proposal_approved_by=x_demo_user,
        proposal_approved_at=datetime.now(timezone.utc).isoformat(),
    )
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
    STATE.update(
        after=None,
        after_placements=None,
        after_decisions=None,
        after_approvals=None,
        after_report=None,
        diff=None,
        proposal_status="rejected",
    )
    for name in ("schedule_after.json", "proposal_after.json", "proposal_after.report.json"):
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
    for submission in store.list_submissions():
        if submission.get("status") in ("approved", "alternative_offered"):
            out.append(
                {
                    "request_id": submission.get("id"),
                    "room_id": submission.get("room_id") or submission.get("requested_room"),
                    "day": submission.get("day"),
                    "start_period": submission.get("start_period"),
                    "end_period": submission.get("end_period"),
                }
            )
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
        requested_room=payload.get("requested_room") or payload.get("room_id") or None,
        mandatory_for_groups=list(payload.get("mandatory_for_groups") or []),
        raw_text=str(payload.get("raw_text") or ""),
        request_reason=str(payload.get("request_reason") or "").strip()[:500],
        requested_category=payload.get("requested_category") or None,
        day=payload.get("day") or None,
        start_period=payload.get("start_period") if isinstance(payload.get("start_period"), int) else None,
        dates=[str(value) for value in payload.get("dates") or [] if isinstance(value, str)],
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


def _submission_proposal(submission: dict) -> BookingProposal:
    return BookingProposal(
        title=str(submission.get("title") or "Untitled request"),
        requester=str(submission.get("requester") or ""),
        role=str(submission.get("role") or "club"),
        attendance=int(submission.get("attendance") or 0),
        duration_periods=int(submission.get("duration_periods") or 0),
        windows=list(submission.get("windows") or []),
        room_types=list(submission.get("room_types") or []),
        needs=list(submission.get("needs") or []),
        requested_room=submission.get("room_id") or submission.get("requested_room"),
        mandatory_for_groups=list(submission.get("mandatory_for_groups") or []),
        raw_text=str(submission.get("raw_text") or ""),
        request_reason=str(submission.get("request_reason") or ""),
        requested_category=submission.get("requested_category"),
        day=submission.get("day"),
        start_period=submission.get("start_period"),
        dates=[str(value) for value in submission.get("dates") or [] if isinstance(value, str)],
    )


def _official_request_from_submission(submission: dict) -> dict:
    keys = (
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
        "request_reason",
        "series_id",
        "raw_text",
    )
    return {key: submission[key] for key in keys if key in submission}


def _append_approved_submission(submission: dict, reason: str, actor: str) -> None:
    proposal = _submission_proposal(submission)
    existing = _approved_bookings()
    existing = [item for item in existing if item.get("request_id") != submission.get("id")]
    result = validate_booking(
        STATE["data"], STATE["placements"] or {}, proposal, existing
    )
    if not result["ok"]:
        raise HTTPException(
            status_code=422,
            detail={"violations": result["violations"], "alternatives": result["alternatives"]},
        )

    raw = copy.deepcopy(STATE["raw"])
    schedule = copy.deepcopy(STATE["schedule"])
    decisions = copy.deepcopy(STATE["decisions"] or [])
    approvals = copy.deepcopy(STATE["approvals"] or [])
    official = _official_request_from_submission(submission)
    if not any(item.get("id") == official["id"] for item in raw["booking_requests"]):
        raw["booking_requests"].append(official)
    decision = {
        "request_id": official["id"],
        "status": "approved",
        "day": submission["day"],
        "start_period": submission["start_period"],
        "end_period": submission["end_period"],
        "room_id": submission["room_id"],
        "reason": reason,
    }
    decisions.append(decision)
    schedule.setdefault("fest_week", {}).setdefault("bookings", []).append(decision)
    approvals.append(
        {
            "request_id": official["id"],
            "status": "approved",
            "decided_by": actor,
            "decided_role": "admin",
            "decided_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
        }
    )

    data_path = STATE["data_path"]
    schedule_path = API_EXPORTS / "schedule.json"
    old_raw_text = data_path.read_text(encoding="utf-8") if data_path.exists() else None
    old_schedule_text = schedule_path.read_text(encoding="utf-8") if schedule_path.exists() else None
    try:
        data_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
        write_schedule(schedule_path, schedule)
        report = _validate(data_path, schedule_path)
        if report.get("hard_violation_count", 0):
            raise HTTPException(
                status_code=422,
                detail={
                    "violations": report.get("hard_violations", []),
                    "message": "approved booking would make the schedule invalid",
                },
            )
        STATE.update(
            raw=raw,
            data=Data(raw),
            schedule=schedule,
            decisions=decisions,
            approvals=approvals,
            report=report,
        )
        store.save_dataset(raw, STATE["source"])
        store.save_state(STATE)
    except Exception:
        if old_raw_text is not None:
            data_path.write_text(old_raw_text, encoding="utf-8")
        if old_schedule_text is not None:
            schedule_path.write_text(old_schedule_text, encoding="utf-8")
        raise


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
    previous = payload.get("previous_draft")
    if not isinstance(previous, dict):
        previous = None
    try:
        parsed = (
            parse_change_request(STATE["data"], text)
            if kind == "change"
            else parse_booking_request(STATE["data"], text, previous)
        )
    except AssistantUnavailable as error:
        raise HTTPException(
            status_code=503,
            detail={"message": str(error), "fallback": "manual"},
        ) from error
    return {
        "source": "local-rules" if parsed.model == "local-rules" else "gemini",
        "model": parsed.model,
        "draft": parsed.draft,
        "follow_up": parsed.follow_up,
        "missing": parsed.missing,
        "fallback_reason": parsed.fallback_reason,
    }


@app.post("/api/bookings/validate")
def validate_booking_request(
    payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    proposal, result = _validate_proposal(payload, name, role)
    return {**result, "category": proposal.category(STATE["data"])}


def _coerce_period(value: Any, label: str) -> int:
    try:
        period = int(value)
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=f"{label} must be a period number") from error
    if not 1 <= period <= 13:
        raise HTTPException(status_code=422, detail=f"{label} must be within P1-P13")
    return period


@app.post("/api/availability")
def availability(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    """Live occupancy for the selected dates/room: what is already here, and how hard."""
    _actor(x_demo_user)
    if STATE["data"] is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    dates = [str(value)[:10] for value in payload.get("dates") or [] if isinstance(value, str)]
    if not dates:
        raise HTTPException(status_code=422, detail="at least one date is required")
    from_period = _coerce_period(payload.get("from_period"), "from_period")
    to_period = _coerce_period(payload.get("to_period"), "to_period")
    if to_period < from_period:
        from_period, to_period = to_period, from_period
    room_id = payload.get("room_id") if isinstance(payload.get("room_id"), str) else None
    attendance = payload.get("attendance")
    attendance = int(attendance) if isinstance(attendance, int) else None
    return build_availability(
        STATE["data"],
        STATE["placements"],
        STATE["decisions"],
        store.list_submissions(),
        STATE["schedule"],
        dates=dates,
        from_period=from_period,
        to_period=to_period,
        room_id=room_id,
        room_types=[str(value) for value in payload.get("room_types") or []],
        attendance=attendance,
        needs=[str(value) for value in payload.get("needs") or []],
        mandatory_groups=[str(value) for value in payload.get("mandatory_for_groups") or []],
    )


def _check_session_scope(name: str, role: str, session_id: str) -> None:
    data: Data | None = STATE["data"]
    if data is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    session = data.sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="unknown session")
    if role == "admin":
        return
    if role == "faculty":
        member = _faculty_for_actor(name)
        if member is None or member.get("id") != session["faculty_id"]:
            raise HTTPException(status_code=403, detail="you can only request changes to your own sessions")
        return
    if role == "department_coordinator":
        if not _coordinator_can_decide_session(name, session_id):
            raise HTTPException(status_code=403, detail="this session is outside your department")
        return
    raise HTTPException(status_code=403, detail="this role cannot request session changes")


@app.post("/api/session-availability")
def session_availability(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    name, role = _actor(x_demo_user)
    session_id = str(payload.get("session_id") or "")
    _check_session_scope(name, role, session_id)
    day = str(payload.get("day") or "").upper()
    if day not in (STATE["data"].days if STATE["data"] else []):
        raise HTTPException(status_code=422, detail="invalid day")
    start = _coerce_period(payload.get("start_period"), "start_period")
    room_id = str(payload.get("room_id") or "")
    if room_id not in (STATE["data"].rooms if STATE["data"] else {}):
        raise HTTPException(status_code=422, detail="unknown room")
    return build_session_availability(
        STATE["data"],
        STATE["placements"],
        session_id=session_id,
        day=day,
        start=start,
        room_id=room_id,
    )


@app.post("/api/change-requests/preview")
def preview_change_request(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    name, role = _actor(x_demo_user)
    if role == "club":
        raise HTTPException(status_code=403, detail="club representatives do not request session changes")
    text = payload.get("text")
    draft = payload.get("draft")
    if not isinstance(draft, dict):
        if not isinstance(text, str) or len(text.strip()) < 5:
            raise HTTPException(status_code=422, detail="text is required")
        parsed = parse_change_request(STATE["data"], text)
        draft = parsed.draft
        follow_up = parsed.follow_up
        model = parsed.model
    else:
        follow_up = []
        model = "manual-edit"
    session_id = draft.get("session_id")
    if session_id:
        _check_session_scope(name, role, str(session_id))
    result: dict[str, Any] = {
        "ok": True,
        "blocked": [],
        "warnings": [],
        "alternatives": [],
        "draft": draft,
        "follow_up": follow_up,
        "model": model,
    }
    if (
        draft.get("kind") == "move_session"
        and session_id
        and draft.get("day")
        and isinstance(draft.get("start_period"), int)
        and draft.get("room_id")
    ):
        result.update(
            build_session_availability(
                STATE["data"],
                STATE["placements"],
                session_id=str(session_id),
                day=str(draft["day"]),
                start=int(draft["start_period"]),
                room_id=str(draft["room_id"]),
            )
        )
    return result


@app.get("/api/room-blocks")
def list_room_blocks(x_demo_user: str = Header(default="debjeet")) -> dict:
    _actor(x_demo_user)
    return {"items": (STATE["raw"] or {}).get("room_unavailability", [])}


@app.post("/api/room-blocks")
def add_room_block(payload: dict, x_demo_user: str = Header(default="debjeet")) -> dict:
    _require_admin(x_demo_user)
    raw = STATE["raw"]
    data: Data | None = STATE["data"]
    if raw is None or data is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    room_id = str(payload.get("room_id") or "")
    day = str(payload.get("day") or "").upper()
    periods = sorted(
        {int(value) for value in payload.get("periods") or [] if str(value).isdigit()}
    )
    reason = str(payload.get("reason") or "Reserved / permanently allocated").strip()
    if room_id not in data.rooms:
        raise HTTPException(status_code=422, detail="unknown room")
    if day not in data.days:
        raise HTTPException(status_code=422, detail="invalid day")
    if not periods or any(period < 1 or period > 13 for period in periods):
        raise HTTPException(status_code=422, detail="periods must be within P1-P13")
    conflicts: list[str] = []
    for session_id, (placed_day, start, room) in (STATE["placements"] or {}).items():
        if room != room_id or placed_day != day:
            continue
        session = data.sessions.get(session_id)
        if session and set(periods) & set(data.block(start, session["duration"])):
            conflicts.append(f"{session_id} ({session['course_id']})")
    for decision in STATE["decisions"] or []:
        if (
            decision.get("room_id") == room_id
            and decision.get("day") == day
            and decision.get("status") in ("approved", "alternative_offered")
            and isinstance(decision.get("start_period"), int)
            and isinstance(decision.get("end_period"), int)
        ):
            if set(periods) & set(range(decision["start_period"], decision["end_period"] + 1)):
                conflicts.append(str(decision.get("request_id")))
    if conflicts:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "this block would conflict with existing placements",
                "conflicts": conflicts[:20],
            },
        )
    next_raw = copy.deepcopy(raw)
    next_raw.setdefault("room_unavailability", []).append(
        {"room_id": room_id, "day": day, "periods": periods, "reason": reason}
    )
    STATE.update(raw=next_raw, data=Data(next_raw))
    if STATE["data_path"] is not None:
        STATE["data_path"].write_text(json.dumps(next_raw, ensure_ascii=False), encoding="utf-8")
    store.save_dataset(next_raw, STATE["source"])
    store.save_state(STATE)
    return {"ok": True, "items": next_raw["room_unavailability"]}


@app.delete("/api/room-blocks/{index}")
def delete_room_block(index: int, x_demo_user: str = Header(default="debjeet")) -> dict:
    _require_admin(x_demo_user)
    raw = STATE["raw"]
    if raw is None:
        raise HTTPException(status_code=409, detail="no dataset loaded")
    blocks = raw.get("room_unavailability") or []
    if index < 0 or index >= len(blocks):
        raise HTTPException(status_code=404, detail="unknown room block")
    next_raw = copy.deepcopy(raw)
    next_raw["room_unavailability"].pop(index)
    STATE.update(raw=next_raw, data=Data(next_raw))
    if STATE["data_path"] is not None:
        STATE["data_path"].write_text(json.dumps(next_raw, ensure_ascii=False), encoding="utf-8")
    store.save_dataset(next_raw, STATE["source"])
    store.save_state(STATE)
    return {"ok": True, "items": next_raw["room_unavailability"]}


@app.post("/api/bookings/submit")
def submit_booking_request(
    payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    if STATE["placements"] is None:
        raise HTTPException(status_code=409, detail="generate a schedule before submitting a booking")
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
    if proposal.day and proposal.start_period and proposal.requested_room:
        request.update(
            {
                "day": proposal.day,
                "start_period": proposal.start_period,
                "end_period": proposal.start_period + proposal.duration_periods - 1,
                "room_id": proposal.requested_room,
            }
        )
    if proposal.dates:
        request["dates"] = proposal.dates
        request["weeks"] = weeks_for_dates(derive_semester(STATE["raw"]), proposal.dates)
    store.save_submission(request)
    return {"ok": True, "status": "pending", "request": request}


@app.get("/api/bookings")
def list_booking_requests(x_demo_user: str = Header(default="debjeet")) -> dict:
    name, role = _actor(x_demo_user)
    return {"items": _scoped_submissions(role, name, store.list_submissions())}


@app.post("/api/bookings/{request_id}/decide")
def decide_booking_request(
    request_id: str, payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    submission = store.get_submission(request_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="unknown request")
    if submission.get("status") != "pending":
        raise HTTPException(status_code=409, detail="request already decided")
    if role not in ("admin", "department_coordinator"):
        raise HTTPException(status_code=403, detail="Admin or owning department coordinator only")
    if role == "department_coordinator":
        room_id = submission.get("room_id") or submission.get("requested_room")
        if not _coordinator_can_decide_room(name, room_id):
            raise HTTPException(
                status_code=403,
                detail="only the owning department coordinator may decide this venue",
            )
    if str(submission.get("requester", "")).lower() == name.lower():
        raise HTTPException(status_code=403, detail="self-approval is not allowed")
    decision = payload.get("decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="decision must be approved or rejected")
    reason = str(payload.get("reason") or "").strip()
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="a reason is required")
    if decision == "approved":
        _append_approved_submission(submission, reason, name)
    store.decide_submission(request_id, decision, name, reason)
    return {"ok": True, "status": decision}


def _cancel_approved_submission(submission: dict, reason: str, actor: str) -> None:
    request_id = submission.get("id")
    if not request_id or STATE["raw"] is None or STATE["schedule"] is None:
        return
    if not any(item.get("id") == request_id for item in STATE["raw"]["booking_requests"]):
        return
    raw = copy.deepcopy(STATE["raw"])
    schedule = copy.deepcopy(STATE["schedule"])
    decisions = copy.deepcopy(STATE["decisions"] or [])
    cancellations = raw.setdefault("cancellations", [])
    if not any(item.get("request_id") == request_id for item in cancellations):
        cancellations.append(
            {
                "request_id": request_id,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "by": actor,
                "note": reason,
            }
        )
    for row in schedule.get("fest_week", {}).get("bookings", []):
        if row.get("request_id") == request_id:
            row.clear()
            row.update({"request_id": request_id, "status": "rejected", "reason": reason})
    for row in decisions:
        if row.get("request_id") == request_id:
            row.clear()
            row.update({"request_id": request_id, "status": "rejected", "reason": reason})
    data_path = STATE["data_path"]
    schedule_path = API_EXPORTS / "schedule.json"
    old_raw = data_path.read_text(encoding="utf-8") if data_path.exists() else None
    old_schedule = schedule_path.read_text(encoding="utf-8") if schedule_path.exists() else None
    try:
        data_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
        write_schedule(schedule_path, schedule)
        report = _validate(data_path, schedule_path)
        if report.get("hard_violation_count", 0):
            raise HTTPException(
                status_code=422,
                detail={"violations": report.get("hard_violations", []), "message": "cancellation would invalidate the schedule"},
            )
        STATE.update(raw=raw, data=Data(raw), schedule=schedule, decisions=decisions, report=report)
        store.save_dataset(raw, STATE["source"])
        store.save_state(STATE)
    except Exception:
        if old_raw is not None:
            data_path.write_text(old_raw, encoding="utf-8")
        if old_schedule is not None:
            schedule_path.write_text(old_schedule, encoding="utf-8")
        raise


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
    if submission.get("status") in ("approved", "alternative_offered"):
        _cancel_approved_submission(submission, reason, name)
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
    draft_override = payload.get("draft")
    if isinstance(draft_override, dict):
        draft = draft_override
        follow_up: list[str] = []
        model = "manual-edit"
        stored_text = (text if isinstance(text, str) else "Structured change request").strip()[:4000]
    else:
        if not isinstance(text, str) or len(text.strip()) < 5:
            raise HTTPException(status_code=422, detail="text is required")
        try:
            parsed = parse_change_request(STATE["data"], text)
        except AssistantUnavailable as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        draft = parsed.draft
        follow_up = parsed.follow_up
        model = parsed.model
        stored_text = text.strip()[:4000]
    session_id = draft.get("session_id")
    if session_id:
        _check_session_scope(name, role, str(session_id))
    blocked: list[dict] = []
    warnings: list[str] = []
    alternatives: list[dict] = []
    if (
        draft.get("kind") == "move_session"
        and session_id
        and draft.get("day")
        and isinstance(draft.get("start_period"), int)
        and draft.get("room_id")
    ):
        check = build_session_availability(
            STATE["data"],
            STATE["placements"],
            session_id=str(session_id),
            day=str(draft["day"]),
            start=int(draft["start_period"]),
            room_id=str(draft["room_id"]),
        )
        blocked = check["blocked"]
        warnings = check["warnings"]
        alternatives = check["alternatives"]
        if blocked:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "this move is blocked by hard constraints and cannot be submitted",
                    "blocked": blocked,
                    "alternatives": alternatives,
                },
            )
    request_reason = str(
        payload.get("request_reason") or draft.get("request_reason") or ""
    ).strip()[:500]
    if request_reason:
        draft = {**draft, "request_reason": request_reason}
    request_id = f"CHG-{int(datetime.now().timestamp() * 1000)}"
    record = {
        "id": request_id,
        "requester": name,
        "role": role,
        "text": stored_text,
        "request_reason": request_reason,
        "draft": draft,
        "follow_up": follow_up,
        "warnings": warnings,
        "alternatives": alternatives,
        "model": model,
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
    return {"items": _scoped_changes(role, name, store.list_change_requests())}


def _apply_change_request(record: dict) -> None:
    draft = record.get("draft") or {}
    if draft.get("kind") != "move_session":
        raise HTTPException(
            status_code=409,
            detail="only move_session requests can be applied here; use a disruption file for add/remove changes",
        )
    if STATE["schedule"] is None or STATE["placements"] is None:
        raise HTTPException(status_code=409, detail="generate a schedule first")
    session_id = draft.get("session_id")
    day = draft.get("day")
    start = draft.get("start_period")
    if not session_id or day not in (STATE["data"].days if STATE["data"] else []) or not isinstance(start, int):
        raise HTTPException(status_code=422, detail="a target session, valid day and start_period are required")
    current = STATE["placements"].get(session_id)
    room_id = draft.get("room_id") or (current[2] if current else None)
    if not room_id:
        raise HTTPException(status_code=422, detail="a room_id is required")
    violations = validate_manual(
        STATE["data"], STATE["placements"], session_id, day, start, room_id
    )
    if violations:
        raise HTTPException(status_code=422, detail={"violations": violations})

    schedule = copy.deepcopy(STATE["schedule"])
    placements = copy.deepcopy(STATE["placements"])
    for row in schedule.get("sessions", []):
        if row.get("session_id") == session_id:
            row.update(day=day, start_period=start, room_id=room_id)
            break
    placements[session_id] = (day, start, room_id)
    schedule_path = API_EXPORTS / "schedule.json"
    old_schedule = schedule_path.read_text(encoding="utf-8") if schedule_path.exists() else None
    try:
        write_schedule(schedule_path, schedule)
        report = _validate(STATE["data_path"], schedule_path)
        if report.get("hard_violation_count", 0):
            raise HTTPException(
                status_code=422,
                detail={
                    "violations": report.get("hard_violations", []),
                    "message": "the requested move would make the schedule invalid",
                },
            )
        STATE.update(schedule=schedule, placements=placements, report=report)
        store.save_state(STATE)
    except Exception:
        if old_schedule is not None:
            schedule_path.write_text(old_schedule, encoding="utf-8")
        raise


@app.post("/api/change-requests/{request_id}/decide")
def decide_change_request(
    request_id: str, payload: dict, x_demo_user: str = Header(default="debjeet")
) -> dict:
    name, role = _actor(x_demo_user)
    record = store.get_change_request(request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="unknown change request")
    if record.get("status") != "pending":
        raise HTTPException(status_code=409, detail="request already decided")
    if role != "admin":
        raise HTTPException(status_code=403, detail="timetable changes are decided by Admin only")
    if str(record.get("requester", "")).lower() == name.lower():
        raise HTTPException(status_code=403, detail="self-approval is not allowed")
    decision = payload.get("decision")
    reason = str(payload.get("reason") or "").strip()
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="decision must be approved or rejected")
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="a reason is required")
    if decision == "approved" and STATE["schedule"] is not None and STATE["placements"] is not None:
        _apply_change_request(record)
    store.decide_change_request(request_id, decision, name, reason)
    return {
        "ok": True,
        "status": decision,
        "request_id": request_id,
        "decided_by": name,
        "note": "Approved move_session requests are applied to the current schedule.",
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
    store.clear_submissions()
    store.clear_change_requests()
    _clear_api_exports()
    _load_raw(json.loads(DEFAULT_DATA.read_text(encoding="utf-8")), "bundled")
    return {
        "ok": True,
        "message": "dataset reloaded; generated artifacts, booking submissions and change requests cleared",
    }


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
