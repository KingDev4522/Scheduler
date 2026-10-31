# CIT Scheduler

A role-aware campus scheduling and venue management web app — conflict-free timetables, exam scheduling, venue bookings with priority, disruption repair, and auditable approvals. Built for the CIT problem statement (189 teaching sessions, 41 midsems, 25 Spectra requests).

**Current state:** the working app, the official starter pack, and the **Phase 2 + Phase 3 engines** with a FastAPI backend. The real `cit_public.json` loads and validates. `python -m solver.run` generates `exports/schedule.json` and `exports/schedule_after.json`; both pass the official validator with **0 hard violations** (189/189 sessions, 41/41 exams, soft penalty 3, booking score 63/70, disruption moves 12 sessions — minimal). Phase 3 adds a configurable priority policy, Admin-only approvals with self-approval blocking, a proposal approval gate, official disruption processing, and an exact diff.

**Not yet built:** live deployment, the ≤5-minute video, manual booking form with AI disabled, AI/Hinglish parsing. Official generation, approvals and the official-data UI are live.

## Quick start

Two processes: the SPA and the scheduling API.

```bash
# terminal 1 — official scheduler API
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --port 8000

# terminal 2 — web app
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

The Admin page has **Generate official schedule**; **Official Data** in the sidebar shows the
official timetable, exams, booking decisions and disruption diff. Without the API, the app still
runs on labelled demo data.

## Demo accounts

| Username | Password | Role |
|---|---|---|
| `debjeet` | `1234` | Administrator |
| `mehul` | `1234` | Club Representative |
| `indranil` | `1234` | Department Coordinator |
| `ananya` | `1234` | Faculty |

One-click sign-in buttons are available on the login screen. Demo credentials and app data stay in the browser's localStorage; the official dataset is fetched as a static asset (`/data/cit_public.json`). The CP-SAT engine is a separate Python CLI — see "Phase 2/3 engine" below.

## Sidebar & roles

Navigation lives in a [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) (`SidebarProvider` → `Sidebar` + `SidebarInset`), grouped as **Overview / Scheduling / Workflow / System**. Items a role cannot use are hidden *and* blocked at the route level.

- **Collapsible icon rail** — the sidebar narrows to icons with tooltips; the edge rail strip or the header trigger toggles it (`Ctrl`/`⌘+B` works too)
- **Mobile** — under 768px the sidebar becomes a slide-in sheet, closed automatically on navigation
- **Persistent** — the expanded/collapsed choice is stored in localStorage and restored on reload
- **User menu** — the footer avatar opens a dropdown with the signed-in role and *Sign out*

| Section | Admin | Coord. | Club Rep | Faculty |
|---|:--:|:--:|:--:|:--:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Timetables, Rooms | ✅ | ✅ | ✅ | ✅ |
| Official Data | ✅ | ✅ | ✅ | ✅ |
| Exams | ✅ | ✅ | — | — |
| Bookings | ✅ | ✅ | ✅ | ✅ |
| Changes, AI Assistant, Approvals | ✅ | ✅ | — | — |
| Import / Exports | ✅ | — | — | — |
| Help | ✅ | ✅ | ✅ | ✅ |

## Project structure

```
├── README.md                  ← you are here
├── CrunchWeek_StarterPack/    ← organizer pack (read-only): README, validator.py, data/, examples/
├── docs/                      ← product & engineering documentation
│   ├── 00_START_HERE.md       ← documentation index (start here)
│   ├── 01_MASTER_PRODUCT_PRD.md
│   ├── 02_DATA_AND_VALIDATOR_CONTRACT.md
│   ├── …                      ← PRDs 03–17
│   ├── starter-pack-inventory.md  ← every pack file + SHA-256 + how it is consumed
│   ├── data-dictionary.md     ← official fields from the starter README
│   ├── validator-contract.md  ← official H1–H14 / B1–B3 / E1–E2 / S1–S6
│   ├── disruption-contract.md ← official change-file format
│   ├── export-schema.md       ← official schedule.json / schedule_after.json
│   ├── booking-examples.md    ← official sample requests + priority/caps
│   └── 17_DOCUMENTATION_TEMPLATES.md
├── .env.example               ← placeholders only; `.env` is git-ignored
├── public/data/cit_public.json ← served copy of the official dataset
├── index.html                 ← Vite entry
├── vite.config.ts             ← React + Tailwind plugins
└── src/
    ├── main.tsx               ← bootstrap + demo-user seeding
    ├── App.tsx                ← routes + auth/role guards
    ├── engine/
    │   ├── types.ts           ← solver/validator contracts
    │   ├── input.ts           ← data adapter + legal windows
    │   ├── solver.ts          ← deterministic backtracking (MRV) + repair
    │   ├── validate.ts        ← independent hard-constraint checks
    │   ├── soft.ts            ← provisional soft-penalty weights
    │   └── disruption.ts      ← disruption spec → repair constraints
    ├── lib/
    │   ├── auth.tsx           ← login, session, roles, rate-limiting
    │   ├── nav.tsx            ← single source of truth: sidebar + routes + access
    │   ├── store.ts           ← localStorage data layer + booking/apply mutations
    │   ├── selectors.ts       ← shared derived data (conflicts, utilisation, queues)
    │   ├── dataset.ts         ← official cit_public.json loader + validation
    │   ├── import.ts          ← provisional schema validation + import summary
    │   ├── time.ts            ← period/day model (P1–P9, lunch, P10–P13)
    │   └── storage.ts         ← typed localStorage helpers
    ├── (python) solver/
    │   ├── data.py · weekly.py · exams.py · bookings.py
    │   ├── policy.py · approvals.py · diff.py · manual.py
    │   ├── export.py · run.py · tests/
    │   └── requirements.txt
    ├── components/            ← AppShell + AppSidebar (shadcn Sidebar), PageHeader,
    │                            StatCard, States, Badges, DecisionDialog, TimetableGrid
    │   └── ui/                ← shadcn primitives: sidebar, sheet, tooltip,
    │                            dropdown-menu, button, input, separator, skeleton
    └── pages/                 ← Login, Dashboard, Rooms, Bookings, Timetables,
                                 Changes, Approvals, AdminImportExport, Help
                                 + scaffolds for Exams and AI Assistant
```

## Demo data and the engine

- The app ships **25 demo teaching sessions** and **25 Spectra requests** so every screen is
  exercisable. Demo data is always labelled and is never claimed to be official or
  validator-passing output.
- The Admin page can **generate** a timetable with `src/engine/solver.ts`: deterministic
  backtracking with minimum-remaining-values variable choice, respecting capacity, room type,
  room/faculty/group overlap, lunch and 3-hour-lab starts, daily faculty limits and approved
  bookings.
- A separate validator (`src/engine/validate.ts`) re-checks the finished schedule. **Apply is only
  enabled when the validator reports zero hard violations.**
- **Official import** (`src/lib/dataset.ts`) parses the real `cit_public.json`, checks required fields,
  duplicate ids, references and the 7 expected counts, and stores it under `cit-scheduler:dataset`.
  The pack's JSON and CSV mirrors were verified to carry identical records.
- **Provisional import** (`src/lib/import.ts`) validates the demo schema and reports path-level errors
  before anything is written. Official `exports/schedule.json` generation is Phase 2.
- Soft-constraint weights in the demo engine are provisional heuristics; the **official** S1–S6
  weights and booking score are now documented from `validator.py` (`docs/validator-contract.md`).

## Documentation

Full PRD set lives in [`docs/`](docs/00_START_HERE.md):

- [00_START_HERE.md](docs/00_START_HERE.md) — index and read order
- [01_MASTER_PRODUCT_PRD.md](docs/01_MASTER_PRODUCT_PRD.md) — scope, journeys, acceptance
- [09_FRONTEND_UX_PRD.md](docs/09_FRONTEND_UX_PRD.md) — screens and interaction rules
- [13_IMPLEMENTATION_PLAN.md](docs/13_IMPLEMENTATION_PLAN.md) — work breakdown and demo plan

Agent-facing docs live in [`docs/agent/`](docs/agent/FRONTEND_GUIDE.md):

- [FRONTEND_GUIDE.md](docs/agent/FRONTEND_GUIDE.md) — file map, data flow, conventions for UI work
- [ARCHITECTURE.md](docs/agent/ARCHITECTURE.md) — layers, boundaries, API/interface contracts
- [PHASE_1_COMPLETION.md](docs/agent/PHASE_1_COMPLETION.md) — item-by-item Phase 1 acceptance matrix
- [BRIEFING.md](docs/agent/BRIEFING.md) — product rules, constraints, acceptance gates
- [DECISIONS.md](docs/agent/DECISIONS.md) — open and settled decisions
- [GAP_MAP.md](docs/agent/GAP_MAP.md) — what is built vs placeholder

Phase 1 contracts (all copied from the starter pack):

- [starter-pack-inventory.md](docs/starter-pack-inventory.md) — every pack file, SHA-256, how it is consumed
- [data-dictionary.md](docs/data-dictionary.md) — official fields, counts, invariants
- [validator-contract.md](docs/validator-contract.md) — official CLI, H1–H14 / B1–B3 / E1–E2 / S1–S6
- [disruption-contract.md](docs/disruption-contract.md) — official change-file format
- [export-schema.md](docs/export-schema.md) — official `schedule.json` / `schedule_after.json`
- [booking-examples.md](docs/booking-examples.md) — official requests, priority order and role caps

## Roadmap

1. ✅ Shell: sidebar UI, auth (3 roles), role-aware dashboard
2. ✅ Rooms finder with availability filters
3. ✅ Bookings board: all 25 Spectra requests, role-scoped audited decisions, no self-approval
4. ✅ Timetable grid: Mon–Fri × P1–P9, lunch divider, P10–P13 event band, three views
5. ✅ Demo constraint engine: generate → independent validation → apply
6. ✅ Change proposals: faculty-leave / room-closure repair, diff preview, Admin approval
7. ✅ Approvals inbox: pending queue, decision history, audit
8. ✅ Official dataset import (`cit_public.json`, 7/7 counts) + Phase 1 contracts from source
9. ✅ Phase 2 engine: CP-SAT timetable + exams + bookings → validated `exports/schedule.json` (0 hard violations)
10. ✅ Phase 3: configurable priority policy, Admin-only approvals, official disruption, minimal-move diff
11. ⬜ Official bookings/diff UI, live in-app generation (needs a backend — D1 = B/C)
12. ⬜ AI assistant (NL/Hinglish extraction) with deterministic validation
13. ⬜ Deployment and submission artifacts
