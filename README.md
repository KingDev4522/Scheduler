# CIT Scheduler

A role-aware campus scheduling and venue-management app built for the CIT problem statement:
conflict-free weekly timetables, 41 midsem exams, 25 Spectra booking requests with priority,
disruption repair, auditable approvals, and an AI intake layer that never decides validity.

**Current local state:** React + FastAPI + SQLite + OR-Tools CP-SAT. The official
`cit_public.json` imports and validates. `python -m solver.run` generates
`exports/schedule.json` and `exports/schedule_after.json`; both pass the unmodified official
validator with **0 hard violations**, soft penalty **3**, booking score **63/70**, and a
**12-session** (room-only) minimal disruption. Deployment and the video are external deliverables.

## Features

- **Weekly timetable** — 189 official sessions, Mon–Fri P1–P9 with lunch, P10–P13 events.
- **Exams** — 41 official midsem exams with AM/PM sessions, multi-room allocation and half capacity.
- **Spectra bookings** — the 25 official requests, priority policy, reasons, alternatives and cancellations.
- **Disruption repairs** — faculty leave / room closure, minimal-movement diff, Admin approval gate.
- **AI intake** — Gemini extracts editable drafts; a deterministic local parser takes over during
  provider outages. Validation, priority and approval remain Python-side.
- **Four roles** — Admin, Department Coordinator, Faculty, Club Representative, with server-side
  permissions and signed session tokens.
- **Role workspace** — faculty unavailability and change requests, club cancellation, Admin review.
- **Auditable approvals** — no self-approval, reasons required, official proposal gate.

## Architecture

```text
┌──────────────────────────────┐
│ React SPA (Vite, TypeScript) │
│  role-aware routes + pages   │
└──────────────┬───────────────┘
               │ JSON / Bearer token
┌──────────────▼───────────────┐
│ FastAPI (backend/app.py)     │
│ auth · validation · imports  │
│ approvals · exports · jobs   │
└───────┬──────────────┬───────┘
        │              │
┌───────▼──────┐  ┌────▼─────────────────┐
│ SQLite       │  │ Python solver          │
│ dataset +    │  │ OR-Tools CP-SAT        │
│ schedules +  │  │ weekly · exams ·       │
│ submissions  │  │ bookings · disruption  │
└──────────────┘  └────┬─────────────────┘
                       │ subprocess
              ┌────────▼─────────┐
              │ official         │
              │ validator.py     │
              └──────────────────┘
        Gemini (optional, server-side) ──► draft only
```

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 7, Vite 8, Tailwind 4, shadcn/Radix, Lucide, Framer Motion |
| Backend | Python 3.11, FastAPI, Pydantic, Uvicorn |
| Solver | Google OR-Tools CP-SAT |
| Storage | SQLite (`DATABASE_PATH`, default `backend/state.sqlite3`) |
| AI | Gemini 3.6 Flash + ordered model fallbacks; local rules fallback |
| Validation | Unmodified `CrunchWeek_StarterPack/validator.py` |
| Tests | Python `pytest`/`unittest`; Vitest |

## Prerequisites

- Node.js 22+ and npm
- Python 3.11+
- OR-Tools (`python -m pip install -r solver/requirements.txt`)
- No database server required: SQLite is embedded

## Local setup

```bash
# 1. Python dependencies
python -m pip install -r backend/requirements.txt
python -m pip install -r solver/requirements.txt

# 2. Frontend dependencies
npm install

# 3. Environment (optional for AI; copy only if needed)
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

`.env` is git-ignored. The backend reads environment variables from the process; export them or use
Docker Compose. `GEMINI_API_KEY` is optional — manual booking and local parsing work without it.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` in dev | Frontend API origin |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins (comma-separated) |
| `DATABASE_PATH` | `backend/state.sqlite3` | SQLite system of record |
| `GEMINI_API_KEY` | empty | Server-side Gemini key; never exposed to the browser |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Preferred extraction model |
| `GEMINI_MODELS` | 3.6 → 3.8 → 3.5 → 2.5 flash | Ordered outage fallbacks |
| `SESSION_SECRET` | random per process | HMAC key for demo session tokens |
| `SESSION_TTL_SECONDS` | `28800` | Token lifetime |
| `DEMO_PASSWORD` | `1234` | Demo account password |
| `ALLOW_DEMO_HEADER` | `1` | Accept explicit `x-demo-user` for local tests; set `0` in a hardened deployment |

## Run everything

```bash
# terminal 1 — API
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000

# terminal 2 — SPA
npm run dev      # http://localhost:5173
```

Production-style single origin (FastAPI serves `dist/`):

```bash
npm run build
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

Docker (optional; deployment is external):

```bash
docker compose up --build
# http://localhost:8000
```

## Demo accounts

| Username | Password | Role |
|---|---|---|
| `debjeet` | `1234` | Administrator |
| `mehul` | `1234` | Club Representative |
| `indranil` | `1234` | Department Coordinator |
| `ananya` | `1234` | Faculty |

The login screen also has one-click buttons. Authentication is a server-side credential check that
returns a signed HMAC session token; the browser stores the token, not the password. The explicit
`x-demo-user` header remains only as a local test/demo fallback (`ALLOW_DEMO_HEADER=0` disables it).

## Dataset, reset and imports

- Bundled official dataset: `CrunchWeek_StarterPack/data/cit_public.json` (also served at
  `public/data/cit_public.json`).
- Admin → **Import / Exports** uploads a JSON dataset; the backend checks the 7 official counts and
  references before replacing the state.
- **Reset** reloads the bundled dataset and clears generated schedules/exports. The Help page also
  resets browser-local demo data.
- Uploads are capped at 5 MB.

## Generate schedules and exports

```bash
# Canonical CLI run: weekly + exams + bookings, validator, diff, public exports
python -m solver.run
```

Outputs:

- `exports/schedule.json`
- `exports/schedule_after.json` (after `sample_disruption.json`)
- `exports/schedule.report.json`, `exports/schedule_after.report.json`
- `exports/schedule_diff.json`, `exports/booking_decisions*.json`
- mirrored under `public/exports/`

Validate manually with the unmodified official validator:

```bash
python CrunchWeek_StarterPack/validator.py \
  --data CrunchWeek_StarterPack/data/cit_public.json \
  --schedule exports/schedule.json

python CrunchWeek_StarterPack/validator.py \
  --data CrunchWeek_StarterPack/data/cit_public.json \
  --schedule exports/schedule_after.json \
  --disruption CrunchWeek_StarterPack/examples/sample_disruption.json \
  --baseline exports/schedule.json
```

Canonical results: **0 hard violations**, soft **3** (`S4: 3`), booking **63/70**, 20 approved /
3 alternatives / 2 rejected, 0 priority inversions, exam penalty **0**, disruption **12 moved**
(0 time, 12 room-only).

## Tests

```bash
python -m pytest -q       # engine + backend
npm test                  # frontend Vitest
npm run build             # TypeScript + production build
```

Current local suite: **56 Python tests** (34 engine, 22 backend) and **5 frontend tests**. The
negative-constraint suite proves the official validator actually rejects H1/H2/H3/H4/H7/H8
violations. Solver tests use the committed canonical exports; run `python -m solver.run` first on a
clean checkout.

## Roles and screens

- **Admin** — dashboard, official data, generate/import/reset, bookings, manual booking, approvals,
  changes, role workspace, priority/proposal controls.
- **Department Coordinator** — department-scoped timetable/approvals, manual booking, changes.
- **Faculty** — personal timetable, unavailability, session-change request, AI assistant, workspace.
- **Club Representative** — natural-language/manual booking, booking history and cancellation,
  AI assistant, workspace.

## Known limitations

- Live deployment and the ≤5-minute video are external deliverables; not included in this repo state.
- The explicit `x-demo-user` fallback is enabled by default for local judging/tests. Set
  `ALLOW_DEMO_HEADER=0` to require tokens only.
- `POST /api/generate` is synchronous and can take up to 150 seconds; the UI shows a spinner rather
  than a pollable job feed. A job endpoint is the next reliability step.
- The frontend renders official data on `/official`, `/timetables`, `/exams`, `/dashboard`,
  `/bookings`, `/manual`, `/assistant`, and `/workspace` actions. `/changes` and the demo store on
  `/approvals` still mix local demo data with official actions; the official proposal card is live.
- Change-request approval records the decision; applying a move still goes through the disruption/
  approval workflow.
- SQLite is the system of record; no Redis/worker is used.

## Project structure

```text
├── backend/                  FastAPI app, auth, store, assistant, tests
├── solver/                   CP-SAT engine, policy, approvals, diff, tests
├── CrunchWeek_StarterPack/   official dataset, validator, examples (read-only)
├── exports/                  canonical generated schedules + reports
├── reports/                  archived validator evidence
├── public/                   SPA assets + published exports
├── src/                      React app (pages, components, lib, engine)
├── docs/                     PRDs, phase docs, agent notes
├── Dockerfile / docker-compose.yml
└── .env.example
```

## Documentation

- [`docs/00_START_HERE.md`](docs/00_START_HERE.md) — index and read order
- [`docs/04_PHASE_4_AI_AUTH_FRONTEND.md`](docs/04_PHASE_4_AI_AUTH_FRONTEND.md)
- [`docs/05_PHASE_5_TEST_DEPLOY_SUBMISSION.md`](docs/05_PHASE_5_TEST_DEPLOY_SUBMISSION.md)
- [`docs/agent/ARCHITECTURE.md`](docs/agent/ARCHITECTURE.md)
- [`docs/agent/PHASE_5_COMPLETION.md`](docs/agent/PHASE_5_COMPLETION.md) — local completion matrix
- [`docs/HACKATHON_COMPLIANCE.md`](docs/HACKATHON_COMPLIANCE.md)
- [`AI_USAGE.md`](AI_USAGE.md), [`THIRD_PARTY.md`](THIRD_PARTY.md)
