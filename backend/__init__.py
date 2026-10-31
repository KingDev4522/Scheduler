"""CIT Scheduler backend package.

Loads local secrets from the repository `.env` (git-ignored) once, before any
module reads environment variables. Real environment variables always win.
"""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)
