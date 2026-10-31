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
