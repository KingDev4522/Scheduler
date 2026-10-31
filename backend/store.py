"""SQLite persistence for backend state.

A single-file database is the system of record for the demo: the imported
dataset and the last generated/proposed schedule survive restarts. This also
gives the project a real schema + migration point (`init_db`).
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_DB = Path(__file__).resolve().parent / "state.sqlite3"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DB)))

SCHEMA = """
CREATE TABLE IF NOT EXISTS dataset (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    raw TEXT NOT NULL,
    source TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generation (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_submissions (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    decided_by TEXT,
    decided_at TEXT,
    reason TEXT
);

CREATE TABLE IF NOT EXISTS change_requests (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    decided_by TEXT,
    decided_at TEXT,
    reason TEXT
);
"""

STATE_FIELDS = (
    "schedule",
    "placements",
    "report",
    "decisions",
    "approvals",
    "after",
    "after_report",
    "diff",
    "generated_at",
    "proposal_status",
    "proposal_approved_by",
    "proposal_approved_at",
    "policy_order",
    "policy_version",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def _db():
    """Commit and always close. `with sqlite3.Connection` does not close."""
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _db() as conn:
        conn.executescript(SCHEMA)


def save_dataset(raw: dict[str, Any], source: str) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT INTO dataset (id, raw, source, updated_at) VALUES (1, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET raw = excluded.raw, source = excluded.source, "
            "updated_at = excluded.updated_at",
            (json.dumps(raw, ensure_ascii=False), source, _now()),
        )


def load_dataset() -> tuple[dict[str, Any] | None, str | None]:
    with _db() as conn:
        row = conn.execute("SELECT raw, source FROM dataset WHERE id = 1").fetchone()
    if row is None:
        return None, None
    return json.loads(row["raw"]), row["source"]


def save_state(state: dict[str, Any]) -> None:
    payload = {key: state.get(key) for key in STATE_FIELDS}
    with _db() as conn:
        conn.execute(
            "INSERT INTO generation (id, payload, updated_at) VALUES (1, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, "
            "updated_at = excluded.updated_at",
            (json.dumps(payload, ensure_ascii=False), _now()),
        )


def load_state() -> dict[str, Any]:
    with _db() as conn:
        row = conn.execute("SELECT payload FROM generation WHERE id = 1").fetchone()
    if row is None:
        return {}
    payload = json.loads(row["payload"])
    placements = payload.get("placements")
    if isinstance(placements, dict):
        payload["placements"] = {key: tuple(value) for key, value in placements.items()}
    return payload


def clear_generation() -> None:
    with _db() as conn:
        conn.execute("DELETE FROM generation WHERE id = 1")


def save_submission(request: dict[str, Any]) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO booking_submissions "
            "(id, payload, status, submitted_at, decided_by, decided_at, reason) "
            "VALUES (?, ?, 'pending', ?, NULL, NULL, NULL)",
            (request["id"], json.dumps(request, ensure_ascii=False), request["submitted_at"]),
        )


def list_submissions() -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT payload, status, submitted_at, decided_by, decided_at, reason "
            "FROM booking_submissions ORDER BY submitted_at DESC"
        ).fetchall()
    out = []
    for row in rows:
        record = json.loads(row["payload"])
        record.update(
            status=row["status"],
            submitted_at=row["submitted_at"],
            decided_by=row["decided_by"],
            decided_at=row["decided_at"],
            reason=row["reason"],
        )
        out.append(record)
    return out


def get_submission(request_id: str) -> dict[str, Any] | None:
    return next((item for item in list_submissions() if item["id"] == request_id), None)


def decide_submission(request_id: str, status: str, actor: str, reason: str) -> None:
    with _db() as conn:
        conn.execute(
            "UPDATE booking_submissions SET status = ?, decided_by = ?, decided_at = ?, reason = ? "
            "WHERE id = ?",
            (status, actor, _now(), reason, request_id),
        )


def save_change_request(record: dict[str, Any]) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO change_requests "
            "(id, payload, status, submitted_at, decided_by, decided_at, reason) "
            "VALUES (?, ?, ?, ?, NULL, NULL, NULL)",
            (
                record["id"],
                json.dumps(record, ensure_ascii=False),
                record.get("status", "pending"),
                record["submitted_at"],
            ),
        )


def list_change_requests() -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT payload, status, submitted_at, decided_by, decided_at, reason "
            "FROM change_requests ORDER BY submitted_at DESC"
        ).fetchall()
    out = []
    for row in rows:
        record = json.loads(row["payload"])
        record.update(
            status=row["status"],
            submitted_at=row["submitted_at"],
            decided_by=row["decided_by"],
            decided_at=row["decided_at"],
            reason=row["reason"],
        )
        out.append(record)
    return out


def get_change_request(request_id: str) -> dict[str, Any] | None:
    return next((item for item in list_change_requests() if item["id"] == request_id), None)


def decide_change_request(request_id: str, status: str, actor: str, reason: str) -> None:
    with _db() as conn:
        conn.execute(
            "UPDATE change_requests SET status = ?, decided_by = ?, decided_at = ?, reason = ? "
            "WHERE id = ?",
            (status, actor, _now(), reason, request_id),
        )
