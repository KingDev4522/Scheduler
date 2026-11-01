"""Terminal presentation for the FastAPI backend.

A judge runs this locally, so the console should read like a confident little
CLI instead of a wall of framework noise. Sarcasm is included at no extra cost.
No secrets or prompt contents are printed.
"""

from __future__ import annotations

import logging
import os
import sys

try:  # Windows terminals default to cp1252; the box drawing needs UTF-8.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

_NO_COLOR = bool(os.getenv("NO_COLOR"))
_QUIET = bool(os.getenv("PYTEST_CURRENT_TEST"))


def _c(code: str) -> str:
    return "" if _NO_COLOR else code


BOLD = _c("\033[1m")
DIM = _c("\033[2m")
CYAN = _c("\033[36m")
GREEN = _c("\033[32m")
YELLOW = _c("\033[33m")
RED = _c("\033[31m")
MAGENTA = _c("\033[35m")
RESET = _c("\033[0m")

BANNER = r"""
   ██████╗██╗████████╗
  ██╔════╝██║╚══██╔══╝
  ██║     ██║   ██║
  ██║     ██║   ██║
  ╚██████╗██║   ██║
   ╚═════╝╚═╝   ╚═╝
   S C H E D U L E R
"""


def banner(dataset_id: str | None, source: str | None, generated: bool) -> None:
    if _QUIET:
        return
    dataset = dataset_id or "no dataset (bold choice)"
    state = (
        "generated schedule loaded. Try not to break it."
        if generated
        else "ready to generate. The solver is stretching."
    )
    print(
        f"{CYAN}{BANNER}{RESET}"
        f"{CYAN}╔══════════════════════════════════════════════════════════╗{RESET}\n"
        f"  {BOLD}Welcome to CIT Scheduler.{RESET} The spreadsheet is trembling.\n"
        f"  Timetables, exams, bookings and approvals — minus chaos.\n"
        f"{CYAN}╚══════════════════════════════════════════════════════════╝{RESET}\n"
        f"  {DIM}dataset{RESET}  {dataset} ({source or 'unknown'})\n"
        f"  {DIM}state  {RESET}  {state}\n"
        f"  {DIM}docs   {RESET}  http://127.0.0.1:8000/docs — yes, the API has manners.\n"
        f"  {DIM}mode   {RESET}  judge-ready. excuses: out of stock.\n",
        flush=True,
    )


def step(number: int, total: int, label: str) -> None:
    if _QUIET:
        return
    print(f"{DIM}[{number}/{total}]{RESET} {CYAN}▸{RESET} {label}", flush=True)


def done(label: str) -> None:
    if _QUIET:
        return
    print(f"      {GREEN}✓{RESET} {label}", flush=True)


def warn(label: str) -> None:
    if _QUIET:
        return
    print(f"      {YELLOW}!{RESET} Not ideal, chief: {label}", flush=True)


def error(label: str) -> None:
    if _QUIET:
        return
    print(f"      {RED}✗{RESET} Well, that went poorly: {label}", flush=True)


def rule(label: str) -> None:
    if _QUIET:
        return
    print(f"\n{DIM}──────────────────────────────────────────────────────────{RESET}")
    print(f"{MAGENTA}{BOLD}{label}{RESET}", flush=True)


class _SarcasticFormatter(logging.Formatter):
    """Keep uvicorn's useful fields, add an unnecessary opinion."""

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        if record.name == "uvicorn.access":
            status = int(getattr(record, "status_code", 0) or 0)
            if status >= 500:
                suffix = "— that's going in the incident report."
            elif status >= 400:
                suffix = "— the client had one job."
            else:
                suffix = "— another request, another tiny victory."
            return f"{base} {suffix}"
        if record.name == "uvicorn.error":
            return f"{base} — the server is awake. Try not to wake the solver."
        return base


def install_sarcastic_access_logs() -> None:
    if _QUIET:
        return
    formatter = _SarcasticFormatter()
    for name in ("uvicorn.access", "uvicorn.error"):
        logger = logging.getLogger(name)
        for handler in logger.handlers:
            handler.setFormatter(formatter)
