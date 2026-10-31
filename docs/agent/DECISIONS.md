# Decision Log

Format follows `14_OPEN_QUESTIONS_AND_DECISIONS.md`:
`DEC-### | Date | Question | Decision | Source | Alternatives | Owner | Status | Impact`

Status values: **PROPOSED** (default in force, user has not confirmed), **CONFIRMED**, **BLOCKED** (waiting on an external input).

---

## DEC-001 — Architecture baseline

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | D1: browser-only localStorage (A), FastAPI + PostgreSQL + OR-Tools (B), or hybrid (C)? |
| Decision | **(C) Hybrid** — the React SPA stays the UI; a FastAPI service under `backend/` wraps the Python OR-Tools CP-SAT engine, persists state in SQLite, and exposes generation, validation, policy, proposal approval, manual validation and exports. The in-browser TypeScript engine remains for demo/fallback. |
| Source | `AGENT_IMPLEMENTATION_PLAN.md` §1 D1; user instruction 2026-10-31 (set up a backend) |
| Alternatives | (A) browser-only was the earlier default; (B) full backend replaces the SPA engine — neither is current. |
| Owner | User · Agent |
| Status | **CONFIRMED** (2026-10-31) |
| Impact | Backend runs at `:8000`; `backend/store.py` (SQLite) is the system of record; `backend/tests` covers 10 API behaviours. The SPA calls the API from Admin and Official Data. |

## DEC-002 — Starter pack

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | D2: Where are `cit_public.json`, the CSV mirrors, `validator.py`, the starter README and `sample_disruption.json`? |
| Decision | **RESOLVED — the pack was found** at `CrunchWeek_StarterPack/` (README, `validator.py`, `data/cit_public.json`, CSV mirrors, `examples/`). All field names, enums, rules, penalties, the disruption format and the export schema are now copied from source. Nothing is inferred. |
| Source | `CrunchWeek_StarterPack/README.md`, `CrunchWeek_StarterPack/validator.py`, `CrunchWeek_StarterPack/data/cit_public.json` |
| Alternatives | None — inventing field names remains forbidden. |
| Owner | Agent |
| Status | **RESOLVED** (2026-10-31) |
| Impact | `docs/data-dictionary.md`, `docs/validator-contract.md`, `docs/disruption-contract.md`, `docs/export-schema.md`, `docs/booking-examples.md` and `docs/starter-pack-inventory.md` are written from source. The official dataset loads via `src/lib/dataset.ts` with 7/7 counts matching; JSON and CSV mirrors verified consistent. Remaining: map the official schema into the scheduler (Phase 2) and produce the official exports. |

## DEC-003 — Role model

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | D3: The problem statement describes Admin, Department Coordinator, Faculty and Club Representative. The app ships 3 demo accounts. Add a 4th? |
| Decision | **Four accounts are required by the problem statement** (`12_DEPLOYMENT_SUBMISSION_PRD.md` §Mandatory artifacts: four working demo role accounts). The app now ships Admin (`debjeet`), Club Representative (`mehul`, internal id `event_manager`), Department Coordinator (`indranil`) and Faculty (`ananya`, added 2026-10-31). |
| Source | `12_DEPLOYMENT_SUBMISSION_PRD.md`; `04_PHASE_4_AI_AUTH_FRONTEND.md` §6; `src/lib/auth.tsx` |
| Alternatives | Keep three accounts — rejected: it would fail a mandatory submission artifact. |
| Owner | Agent |
| Status | **RESOLVED** (2026-10-31) |
| Impact | `Role` gains `faculty`; login/Help/README list four accounts; faculty sees Dashboard, Timetables, Rooms, Bookings and Help, scoped to their own requests. Existing browsers gain the account via `ensureSeedUsers` merge. |

## DEC-004 — Documentation numbering

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | D4: `docs/` holds two colliding numbering series (PRDs `00_`–`17_` and phases `00_ROADMAP_INDEX`–`05_PHASE_5`). Rename? |
| Decision | **Do not rename.** New agent-authored documents live under `docs/agent/`. |
| Source | `AGENT_IMPLEMENTATION_PLAN.md` §1 DECISION D4 |
| Alternatives | Prefix phase files (`P1_`, `P2_`) — rejected without user approval. |
| Owner | User |
| Status | **PROPOSED** — default in force |
| Impact | Cross-document links stay stable; reader must use the full filename to disambiguate `00_START_HERE.md` from `00_ROADMAP_INDEX.md`. |

## DEC-005 — Timetable time model

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | What period grid and duration rules does the UI render? |
| Decision | Monday–Friday. P1 08–09, P2 09–10, P3 10–11, P4 11–12, P5 12–13, **lunch 13–14**, P6 14–15, P7 15–16, P8 16–17, P9 17–18. P10–P13 18–22 are **event-only**. A 3-hour lab may start only at P2 or P6. |
| Source | `03_SCHEDULING_SOLVER_PRD.md` "Scope" |
| Alternatives | None recorded. |
| Owner | Agent |
| Status | **CONFIRMED** for the UI (single sourced statement) |
| Impact | `src/lib/time.ts` is the single source of truth for periods; grids, availability and conflict checks all import it. |

## DEC-006 — Demo schedule data

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | What does the timetable show before the official dataset arrives? |
| Decision | A small, clearly labelled **demo session set** stored in `localStorage` under `cit-scheduler:data`. It is illustrative only. The UI must state "demo data — not validator output" wherever it is shown, and no document may claim it passed the official validator. |
| Source | `AGENT_IMPLEMENTATION_PLAN.md` Sprint 3 (T3.3); guardrail in `AGENT_IMPLEMENTATION_PLAN.md` §2 |
| Alternatives | Blank timetable until D2 resolves — rejected because the grid's time model and accessibility behaviour need to be exercised now. |
| Owner | Agent |
| Status | **CONFIRMED** for the demo build only |
| Impact | `SEED_VERSION` bumps when the demo shape changes so stale localStorage is replaced. Replacing demo data with the official import is a Phase 1 Workstream D / Sprint 4 task. |

## DEC-007 — Scheduling engine approach under D1 = A

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | With no Python backend, how does the app generate a timetable? |
| Decision | A TypeScript engine in `src/engine/`: data adapter → deterministic backtracking search (MRV variable choice, heuristic value order) → **independent validator** → audited apply. No OR-Tools, no server process. |
| Source | `AGENT_IMPLEMENTATION_PLAN.md` Sprint 4 "If (A) browser-only"; `03_SCHEDULING_SOLVER_PRD.md` §"Proposed algorithm", §"Validation and explanations" |
| Alternatives | (B) OR-Tools service and (C) hybrid remain available if D1 is reassigned. |
| Owner | Agent |
| Status | **CONFIRMED** for the demo build |
| Impact | Only H01–H06, H09, H12, H13 and H14 are modelled. H07/H08/H10/H11 need starter-pack fields. Soft weights are provisional and never presented as the official penalty. `applyPlacements()` refuses partial or malformed results, and the UI only enables Apply after a 0-violation validation run. |

## DEC-008 — Demo approval records and coordinator scope

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | The seed contained booking-kind `Approval` records that duplicated bookings, and the coordinator had no decision path. How are they reconciled? |
| Decision | Booking decisions live on the booking record only; the `proposals` collection holds change proposals only. Coordinator decisions are limited to lab rooms whose `department` matches the coordinator's department, and self-approval is rejected by the store. |
| Source | `05_BOOKINGS_AND_PRIORITY_PRD.md` §"Deterministic decision procedure"; `01_MASTER_PRODUCT_PRD.md` §"Users and jobs" |
| Alternatives | Keep duplicate approval records — rejected because two decision paths could disagree. |
| Owner | Agent |
| Status | **CONFIRMED** for the demo build |
| Impact | `dashboardStats`, `pendingDecisions` and the Bookings board read one queue. `decideBooking()` enforces `requester != approver` regardless of UI state. |

## DEC-009 — Disruption repair workflow

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | How is a disruption (faculty leave, room closure) repaired and applied? |
| Decision | `repairTimetable()` re-places **only the affected sessions** and holds every other session exactly where it is — the moved count is therefore the minimum forced by the disruption. A repair is offered for approval only when the merged schedule passes the independent validator with 0 hard violations. Proposals are stored as `ChangeProposal` records with `before`/`after` placements; approval by an Admin is what actually writes the timetable. |
| Source | `06_RESCHEDULING_PRD.md`; `03_SCHEDULING_SOLVER_PRD.md` §"Validation and explanations" |
| Alternatives | Allow the solver to move unaffected sessions to make room for others — rejected for now because it breaks the "minimise moved sessions" reading and needs a proper objective function. |
| Owner | Agent |
| Status | **CONFIRMED** for the demo build |
| Impact | Faculty leave closes all of that faculty's periods for the day (H07); room closure closes the room for the day (H08). "New session" disruptions are planned but not yet exposed in the UI. `proposals` seeds empty — proposals are produced only by the engine, never hand-authored. |

## DEC-010 — Provisional dataset import and snapshot export

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | Phase 1 requires a working import with an actionable error report, but the official schema is unknown. What do we ship? |
| Decision | Ship a **provisional importer for the app's internal schema** (`src/lib/import.ts`): required fields/types, duplicate IDs, referential integrity, time-window rules, capacity/type warnings, a `fnv1a` source hash, and no write until the Admin presses Apply. Add an **internal snapshot download** for round-trip checks. Both are explicitly labelled non-official; `exports/schedule.json` remains blocked. |
| Source | `01_PHASE_1_FOUNDATION.md` §7; `02_DATA_AND_VALIDATOR_CONTRACT.md` §Import pipeline, §Export contract |
| Alternatives | Leave import disabled until D2 — rejected because Phase 1 acceptance explicitly requires a working import and useful errors for invalid input. |
| Owner | Agent |
| Status | **CONFIRMED** for the demo build |
| Impact | Satisfies the import/error-reporting criteria without inventing official field names. Replacing the adapter later is contained to `src/lib/import.ts` + the Admin page. The snapshot is never presented as the official export. |

## DEC-011 — Backend/database items in the Phase 1 checklist

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | `01_PHASE_1_FOUNDATION.md` requires the backend, database and migrations to start locally. Are they in scope? |
| Decision | Under D1 = A they are **N/A** and are recorded as such — not marked done. The future HTTP/API contract is documented in `docs/agent/ARCHITECTURE.md` so they can be added without rework. |
| Source | `AGENT_IMPLEMENTATION_PLAN.md` §1 DECISION D1; `01_PHASE_1_FOUNDATION.md` §6, §9 |
| Alternatives | Scaffold FastAPI/PostgreSQL anyway — rejected as unrequested scope and a direct contradiction of D1 = A. |
| Owner | User (D1 unanswered) |
| Status | **PROPOSED** — default in force |
| Impact | Literal Phase 1 completion requires D1 = B or C. See `docs/agent/PHASE_1_COMPLETION.md` §4 and §8. |

## DEC-012 — CP-SAT reference is analysis-only

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | How should the external CP-SAT timetabling repository be used? |
| Decision | Use it **only to analyse how a constraint solver builds a weekly timetable**. Do not copy code (the repo has no licence), do not adopt its data model, and do **not** implement its examination scheduler. Record the findings in `docs/agent/CP_SAT_REFERENCE_ANALYSIS.md`. Any adoption (lexicographic tiers, room-matching stage, relaxation diagnosis) belongs to Phase 2 and requires D1 to be settled first. |
| Source | User instruction, 2026-10-31; `docs/agent/CP_SAT_REFERENCE_ANALYSIS.md` |
| Alternatives | Porting the repo wholesale — rejected: different institution, different schema, out-of-scope features, no licence. |
| Owner | Agent |
| Status | **CONFIRMED** |
| Impact | No `solver/` package, no Python service and no exam scheduler are added during Phase 1. The current TypeScript engine and validator remain the implementation. |

## DEC-013 — Official dataset import path

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | How does the app load the official dataset now that the pack is present? |
| Decision | `src/lib/dataset.ts` parses `cit_public.json` into typed official structures, validates required fields, duplicate ids, references and the 7 expected counts, and stores it under `cit-scheduler:dataset`. A byte-identical copy is served at `public/data/cit_public.json` so the Admin page can load it without a file picker. The demo `AppData` store is kept **separate** so existing screens keep working; the scheduler is pointed at the official dataset in Phase 2. |
| Source | `CrunchWeek_StarterPack/README.md`; `src/lib/dataset.ts` |
| Alternatives | Replace the demo model wholesale — rejected during Phase 1 because it would pre-empt Phase 2's scheduler work and churn every screen. |
| Owner | Agent |
| Status | **CONFIRMED** |
| Impact | Phase 1's "import the official dataset with a clear summary" and "invalid input produces useful errors" criteria are met (verified: 7/7 counts, and path-level errors for duplicate id / unknown reference / missing collection / malformed JSON). The official `schedule.json` export is still Phase 2. |

## DEC-014 — Phase 2 engine is an offline CP-SAT CLI

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | The Phase 2 engine needs OR-Tools, which the browser cannot run. How does the app get a schedule? |
| Decision | Phase 2 is a Python CP-SAT package under `solver/` (`data`, `weekly`, `exams`, `bookings`, `export`, `run`). `python -m solver.run` solves, exports `exports/schedule.json` and `exports/schedule_after.json`, runs the official validator unmodified, exits non-zero on any hard violation, and publishes the artifacts to `public/exports/` for the SPA to display. No live service is added; D1 stays (A) for the app. |
| Source | `02_PHASE_2_SCHEDULING_ENGINE.md`; user instruction 2026-10-31 |
| Alternatives | A FastAPI/OR-Tools service callable from the browser (D1 = B/C) — deferred; a generate button needs it. |
| Owner | Agent |
| Status | **CONFIRMED** |
| Impact | Phase 2 exit gate met: 189/189 sessions and 41/41 exams, 0 hard violations in both exports, soft penalty 12, booking score 67/70, disruptions move 10 sessions. The SPA can show the artifacts but cannot trigger a solve until a backend exists. |

## DEC-015 — Phase 3 engine scope under D1 = A

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | Phase 3 requires priority decisions, approvals, minimal-move rescheduling and manual scheduling. How much is implemented without a backend? |
| Decision | Implement the full decision pipeline in the engine: configurable priority policy, Admin-only approvals with `requester != approver`, validated alternatives, official disruption processing, an exact diff with a minimality proof, and a manual-placement validator. The engine emits **proposal artifacts** (`schedule_after.json`, `schedule_diff.json`, `booking_decisions*.json`); it does not silently mutate a published state. UI wiring and a shared approval service are deferred (Phase 4 / D1 = B/C). |
| Source | `03_PHASE_3_BOOKINGS_RESCHEDULING.md`; `05_BOOKINGS_AND_PRIORITY_PRD.md`; `06_RESCHEDULING_PRD.md` |
| Alternatives | Build an official bookings UI now — deferred to Phase 4, which owns the frontend. |
| Owner | Agent |
| Status | **CONFIRMED** |
| Impact | All 16 Phase 3 acceptance criteria are met at the engine level and covered by 17 tests. Booking score 64.5/70, 0 inversions, disruption moves 9 sessions (minimal), both exports 0 hard violations. The app screens still use the demo store. No `session_overrides` (class-displacing events are offered as alternatives). |

## DEC-016 — Backend, SQLite and the proposal gate

| Field | Value |
|---|---|
| Date | 2026-10-31 |
| Question | How do the Phase 2/3 engines become usable by judges in the deployed app? |
| Decision | Add a FastAPI service (`backend/app.py`) over `solver/`, with SQLite persistence (`backend/store.py`, `DATABASE_PATH`) and a demo-identity header. Generation writes validated exports; a disruption creates a **pending proposal** and `schedule_after.json` is only published after Admin approval; manual placements are validated but never auto-applied; the priority order is admin-configurable via `GET/PUT /api/policy`. |
| Source | `12_DEPLOYMENT_SUBMISSION_PRD.md`; `03_PHASE_3_BOOKINGS_RESCHEDULING.md` §9–10; user instruction 2026-10-31 |
| Alternatives | Offline CLI only — rejected: judges must be able to reset, generate and apply change files in the app. |
| Owner | Agent |
| Status | **CONFIRMED** |
| Impact | Backend tests: 10/10. The SPA gains **Official Data** and an Admin engine panel. State survives restart. Deployment and video remain. |

