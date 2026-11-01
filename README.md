# CIT Scheduler

A role-aware campus scheduling and venue-management app built for the CIT problem statement:
conflict-free weekly timetables, 41 midsem exams, 25 Spectra booking requests with priority,
disruption repair, auditable approvals, and an AI intake layer that never decides validity.

**Current local state:** React + FastAPI + SQLite + OR-Tools CP-SAT. The official
`cit_public.json` imports and validates. The app and `python -m solver.run` generate
`exports/schedule.json` and `exports/schedule_after.json`; both pass the unmodified official
validator with **0 hard violations** (base and after-disruption soft **3**), booking score
**65.5/70**, and a **15-session** minimal disruption (3 time changes, 12 room-only). Live deployment
and the video remain external deliverables.

## Features

- **Weekly timetable** — 189 official sessions, Mon–Fri P1–P9 with lunch, P10–P13 events.
- **Campus calendar** — a week picker (Weeks 1–8 via the backend's derived semester) plus week/month
  views on the Dashboard and Timetables. Week 7 overlays the approved Spectra events and Week 8 shows
  the midsem board; hover/click reveal dates and details. No Week 1–6 or month data is invented.
- **Date-based booking** — the manual form and the assistant pick **actual dates** on a calendar
  (multi-select, past dates and weekends blocked, exam week closed) and a **start/end time**; the
  weekday, week number, period range and duration are derived from those (1 period = 1 hour). The
  chosen date+week are stored on the app's submission; the official dataset schema and validator are
  untouched. The assistant reports **all** missing fields in one pass.
- **Exams** — 41 official midsem exams with AM/PM sessions, multi-room allocation and half capacity.
- **Spectra bookings** — the 25 official requests, priority policy, reasons, alternatives and cancellations.
- **Disruption repairs** — faculty leave / room closure, minimal-movement diff, Admin approval gate.
- **AI intake** — Gemini extracts editable drafts; the previous draft is sent back on every turn so
  follow-up answers merge instead of resetting, and all missing fields are listed at once. A
  deterministic local parser takes over during provider outages. Validation, priority and approval
  remain Python-side.
- **Four roles** — Admin, Department Coordinator, Faculty, Club Representative, with server-side
  permissions and signed session tokens. Coordinators decide their department's lab bookings and
  session moves; nobody can approve their own request.
- **Official-data screens** — dashboard, timetables, rooms, exams, bookings, approvals, changes and
  exports read the generated official schedule; the manual/AI booking flow validates and applies
  ad-hoc requests.
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
| `VITE_API_BASE_URL` | empty (same origin) | API origin; leave empty in dev (Vite proxies `/api` to `127.0.0.1:8000`) and in Docker. Set only when the API is on a different origin |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins (comma-separated) |
| `DATABASE_PATH` | `backend/state.sqlite3` | SQLite system of record |
| `SEMESTER_START_DATE` | `2026-11-02` | Week-1 Monday for the display calendar (dataset ships no dates) |
| `TEAM_NAME` | `CIT Scheduler` | Team name written into `schedule.json` |
| `GEMINI_API_KEY` | empty | Server-side Gemini key; never exposed to the browser |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Preferred extraction model |
| `GEMINI_MODELS` | 2.5 → 3.6 → 3.5 → 3.8 flash | Ordered outage fallbacks |
| `SESSION_SECRET` | random per process | HMAC key for demo session tokens |
| `SESSION_TTL_SECONDS` | `28800` | Token lifetime |
| `DEMO_PASSWORD` | `1234` | Demo account password |
| `ALLOW_DEMO_HEADER` | `0` | Accept explicit `x-demo-user` only for local tests; keep `0` in a public deployment |

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

Docker (optional):

```bash
docker compose up --build
# http://localhost:8000
```

### Deploy

`render.yaml` is a one-service Render Blueprint for the Docker image. Connect the public
repository, set `GEMINI_API_KEY` and the deployed origin in `CORS_ORIGINS`, and Render runs
`/api/health` as the health check with a persistent `/data` disk for SQLite and exports.

Any Docker host works with the same environment:

- `DATABASE_PATH` on a persistent volume
- `CORS_ORIGINS` set to the public origin (same-origin SPA does not need CORS)
- `SESSION_SECRET` set once and kept stable
- `ALLOW_DEMO_HEADER=0`
- `GEMINI_API_KEY` server-side only

The deployed app must stay up until the results are announced; the four demo accounts and the
Admin reset button are the judge entry points.

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

Canonical results: **0 hard violations**, base soft **3** (`S4: 3`), after-disruption soft **3**
(`S4: 3`), booking **65.5/70**, 21 approved / 2 alternatives / 2 rejected, 0 priority
inversions, exam penalty **0**, disruption **15 moved** (3 time, 12 room-only).

## Calendar and dates

The official dataset has **no dates**: sessions and booking windows are weekday + period. The app
therefore uses a configured term start for the display calendar instead of inventing sessions:

- **Week 1 = Mon 2 Nov 2026** by default (`SEMESTER_START_DATE`), so **Week 7 = Mon 14 Dec 2026**
  (Spectra) and **exam week (Week 8) = Mon 21 Dec 2026**. The assumption is shown in the UI. If the
  setting is unset/invalid, it falls back to the dataset's Spectra-week timestamp (the cancellation
  on 2027-02-03).
- Weeks 1–6 reuse the one solved weekly template; Week 7 adds the Spectra events; Week 8 is the
  midsem board. There is no Week 1–6 dataset, so none is fabricated.
- `GET /api/dataset` returns this as `semester` (weeks, dates, phases). Booking submissions store the
  chosen `dates` and derived `weeks` on the **app's** record only; the official dataset request and
  `validator.py` are unchanged, so conflict checking stays weekday + period.
- Clock times map 1:1 onto the period grid (one period = one hour; 08:00–13:00 and 14:00–22:00, lunch
  closed), so the form takes a start/end time and derives the period range and duration.

## Tests

```bash
python -m pytest -q       # engine + backend
npm test                  # frontend Vitest
npm run build             # TypeScript + production build
```

Current local suite: **93 Python tests** (1 skipped because this dataset has no fixed-slot sessions
for H14) and **17 frontend tests**. The negative-constraint suite
proves the official validator actually rejects every hard rule it can trigger (H1–H13; H14 skipped
when absent) and detects every soft rule S1–S6. Solver tests use the committed canonical exports;
run `python -m solver.run` first on a clean checkout.

The backend tests use disposable databases under the system temp directory, so they do not touch
`backend/state.sqlite3` or the committed exports.

## Roles and screens

- **Admin** — dashboard, official data, generate/import/reset, bookings, manual booking, approvals,
  changes, role workspace, priority/proposal controls.
- **Department Coordinator** — department-scoped timetable/approvals, department lab booking
  decisions, manual booking, session-change requests.
- **Faculty** — personal timetable, unavailability, session-change request, AI assistant, workspace.
- **Club Representative** — natural-language/manual booking, official Spectra board, booking history
  and cancellation, AI assistant, workspace.

## Known limitations

- Live deployment and the ≤5-minute video are external deliverables; not included in this repo state.
  The Dockerfile is production-ready and exposes `/api/health` for a host health check.
- Set `ALLOW_DEMO_HEADER=1` only for local automated tests. The default `0` requires the signed
  bearer token; the frontend logs in with the four demo accounts.
- `POST /api/generate` is synchronous and can take up to 150 seconds; the UI shows a spinner rather
  than a pollable job feed.
- The frontend reads the official dataset and generated schedule on `/dashboard`, `/timetables`,
  `/rooms`, `/exams`, `/bookings`, `/official`, `/changes`, `/manual`, `/assistant`, `/approvals`,
  `/admin` and `/workspace`. The browser demo seed remains for the legacy unit tests only and is not
  rendered by the judge-facing pages.
- Change-request approval applies `move_session` to the current schedule when a schedule exists;
  add/remove-session changes use the official change-file upload on `/changes` or `/admin`.
- SQLite is the system of record; no Redis/worker is used.
- `python -m solver.run` uses 120 seconds per solve; the API uses the same default. Soft scores can
  vary slightly between runs because CP-SAT stops at the time limit, but hard correctness does not.

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
