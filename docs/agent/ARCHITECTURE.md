# Architecture & Interface Contracts

**Decision:** DEC-001 = **(C) hybrid**. The SPA is the UI; the official scheduler is a Python
FastAPI + OR-Tools CP-SAT service under `backend/` and `solver/`, with SQLite state. The in-browser
TypeScript engine remains a demo/fallback. See `DEC-016`.

Sources: `01_PHASE_1_FOUNDATION.md` §5–8, `10_BACKEND_API_DATABASE_PRD.md`, `AGENT_IMPLEMENTATION_PLAN.md`.

---

## 1. Current architecture (D1 = C hybrid)

```
React SPA (src/) ──HTTP/JSON──▶ FastAPI (backend/app.py)
                                  ├─ dataset import / validation
                                  ├─ GET/PUT /api/policy
                                  ├─ POST /api/generate            → solver/weekly.py + exams.py
                                  ├─ POST /api/disruption          → proposal (not applied)
                                  ├─ POST /api/proposal/approve|reject
                                  ├─ POST /api/manual              → solver/manual.py
                                  ├─ GET  /api/schedule
                                  └─ GET  /api/exports/{name}
                                        │
                                        ▼
                                  SQLite (backend/store.py)
                                    dataset + generation payload
```

The official endpoints implemented:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | liveness, dataset, generated flag |
| GET | `/api/dataset` | demo user | counts + entities for the UI |
| POST | `/api/import` | Admin | upload and validate `cit_public.json` |
| POST | `/api/generate` | Admin | solve timetable + exams + bookings, validate, export |
| GET | `/api/schedule` | demo user | schedule, summary, decisions, approvals, diff, proposal status |
| POST | `/api/disruption` | Admin | apply a change file → **pending proposal** + diff |
| POST | `/api/proposal/approve` | Admin | publish `schedule_after.json` |
| POST | `/api/proposal/reject` | Admin | discard the proposal |
| GET/PUT | `/api/policy` | read / Admin | priority order; invalidates the generated schedule |
| POST | `/api/manual` | Admin or Coordinator | validate a manual placement; never auto-applies |
| POST | `/api/approve` | Admin | booking approval guard (`requester != approver`) |
| GET | `/api/exports/{name}` | public | `schedule.json`, `schedule_after.json`, reports |
| POST | `/api/reset` | Admin | reload the dataset and clear generated artifacts |

### 1.1 Browser layer (demo/fallback)

A single-page application with a deterministic, in-browser scheduling engine.

```
┌──────────────────────────────── React SPA (Vite + TypeScript) ───────────────────────────────┐
│                                                                                              │
│  Pages (src/pages)                                                                           │
│    Dashboard · Timetables · Rooms · Bookings · Changes · Approvals · Admin · Help            │
│        │ reads derived data                         │ writes through mutations               │
│        ▼                                            ▼                                        │
│  Selectors (src/lib/selectors.ts)             Store (src/lib/store.ts)                       │
│    conflicts, availability, utilisation,         getData / persist                            │
│    pending queue, timetable views                decideBooking / submitProposal               │
│        │                                         decideProposal / applyPlacements             │
│        │                                         writeImportedData / resetDemoData             │
│        ▼                                            │                                        │
│  Engine (src/engine)                                ▼                                        │
│    input adapter → solver → independent          Storage (src/lib/storage.ts)                │
│    validator → soft score                        localStorage keys                           │
│    repair planner → repair search                                                            │
│                                                                                              │
│  Auth (src/lib/auth.tsx) · Time model (src/lib/time.ts) · Import (src/lib/import.ts)         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Files | Rules |
|---|---|---|
| Presentation | `src/pages`, `src/components` | No storage access except `getData()`; no duplicated derivations. |
| Derived reads | `src/lib/selectors.ts` | Pure functions over `AppData`; deterministic. |
| Domain/persistence | `src/lib/store.ts` | Only place that writes localStorage; enforces authorization and audit. |
| Time model | `src/lib/time.ts` | Single source of truth for days/periods/lunch/lab rules. |
| Engine | `src/engine/*` | Input adapter → search → **independent** validator → result. Never writes storage. |
| Import | `src/lib/import.ts` | Structural/referential validation; returns a summary, does not write. |
| Auth | `src/lib/auth.tsx` | Session, roles, lockout. Demo credentials only. |

### Boundaries worth preserving

- **Solver ≠ validator.** `validatePlacements` receives only the finished placements and input.
- **Decision ≠ application.** Booking decisions are immediate; timetable changes require an Admin
  approval and are applied only in `decideProposal` / `applyPlacements`.
- **Engine ≠ persistence.** Engine output is applied by the store after validation.
- **No UI-only authorization.** `canDecideBooking`, `decideProposal` and `applyPlacements`
  re-check rules in the store layer.

---

## 2. Persistence

| Key | Shape | Owner |
|---|---|---|
| `cit-scheduler:data` | `AppData` | `store.ts` |
| `cit-scheduler:users` | `StoredUser[]` | `auth.tsx` |
| `cit-scheduler:session` | `{ username, loggedInAt }` | `auth.tsx` |
| `cit-scheduler:login-attempts` | `{ count, lockedUntil }` | `auth.tsx` |
| `cit-scheduler:sidebar-open` | `boolean` | `AppShell.tsx` |

- `SEED_VERSION` (currently 4) invalidates stale data on shape changes.
- `resetDemoData()` clears only the data key; the next read reseeds.
- Import replaces `cit-scheduler:data` only after validation and records provenance in the audit.

---

### 2.1 Backend state (SQLite)

`backend/store.py` persists the imported dataset and the last generation/proposal:

| Table | Contents |
|---|---|
| `dataset` | raw `cit_public.json` + source + timestamp |
| `generation` | schedule, placements, validator report, decisions, approvals, proposal, diff, policy order/version |

`DATABASE_PATH` defaults to `backend/state.sqlite3` (git-ignored). `init_db()` creates the schema;
state survives a backend restart (verified).

---

## 3. Interface contracts

`01_PHASE_1_FOUNDATION.md` §8 requires these to be agreed before parallel work. The HTTP surface is
implemented (see §1); the rules below apply to it and to the browser fallback.

### 3.1 Naming and versioning

- Internal functions: `verbNoun` (`decideBooking`, `submitProposal`, `applyPlacements`).
- Result objects are discriminated unions: `{ ok: true, data } | { ok: false, error }`.
- Future HTTP: `/api/v1/...`; version in the path; no breaking change within a major version.

### 3.2 Error shape

| Today | Future HTTP |
|---|---|
| `{ ok: false, error: string }` | `{ "error": { "code": "STRING_CODE", "message": "human readable", "details": { "field": "..." } } }` |

Rules: errors never leak secrets; validation errors name the offending path; authorization errors
do not reveal whether a record exists.

### 3.3 Pagination

- Today: not applicable — demo collections are small and rendered in full.
- Future HTTP: cursor-based (`?limit=50&cursor=...`) returning
  `{ items, nextCursor }`; stable ordering by `(day, startPeriod, id)` for timetable data.

### 3.4 Time and dates

- Internal representation: `day` + `startPeriod` + `periods`; **no timezone** because the schedule
  is week-relative.
- Period wall-clock times live once in `src/lib/time.ts`.
- Timestamps (`submittedAt`, `decidedAt`, `updatedAt`) are epoch milliseconds, UTC.
- Future HTTP: ISO-8601 instants for timestamps; period integers for schedule data.

### 3.5 IDs and enums

- IDs are opaque strings (`LT-1`, `SPC-02`, `SES-01`, `CHG-…`); source IDs are preserved on import.
- Enums are lowercase strings; the internal union types are the source of truth.
- `BookingPriority` is a demo 1–3 scale; the official six-tier order is `VERIFY`.

### 3.6 Long-running job contract

- Engine jobs are synchronous today; the UI shows a busy state, then a result.
- Result status values: `FEASIBLE`, `INFEASIBLE`, `TIMEOUT`.
- **`TIMEOUT` is not proof of infeasibility** and is displayed separately.
- Future HTTP job shape: `{ jobId, status: 'queued'|'running'|'succeeded'|'failed'|'timeout', progress?, result? }`
  with polling or SSE; never label a proposal “approved” before the server confirms.

### 3.7 Frontend types

- Types are maintained in `src/lib/store.ts` / `src/engine/types.ts` and imported, never duplicated.
- If a backend arrives, generate or hand-maintain a single `api-types.ts` and keep the same
  discriminated-union result shape at the client boundary.

---

## 4. Repository and environment rules

- Node/npm project only; no committed secrets. `.env.example` contains placeholders only.
- Build must stay green: `npm run build` (`tsc --noEmit && vite build`).
- Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`) when committing.
- Do not push to `main` without explicit approval.
- Do not modify organizer files (`validator.py`, starter data) when they arrive.
- No pre-hackathon code or purchased templates.
- Declare AI tools/models and third-party dependencies in `AI_USAGE.md` / `THIRD_PARTY.md`
  (Phase 5, not yet written).

### Environment variables

Current build needs **none**. `.env.example` documents safe placeholders for an optional future
backend/LLM integration. Only `VITE_`-prefixed variables are exposed to the browser; secrets must
never be placed there.

---

## 5. If D1 changes to (B) or (C)

1. Write the decision and rationale to `docs/agent/DECISIONS.md` before code.
2. Keep the frontend untouched; add a `backend/` modular monolith:
   `api/ · core/ · models/ · schemas/ · repositories/ · services/ · scheduling/ · examinations/
   bookings/ · rescheduling/ · ai/ · validation/ · workers/`.
3. PostgreSQL as system of record; SQLAlchemy + Alembic migrations.
4. OR-Tools CP-SAT inside `scheduling/`; the TypeScript engine can remain as a validation oracle
   or be retired.
5. Background jobs (Celery + Redis) for long solves; expose the job contract above.
6. Reuse the internal validator semantics as the differential test oracle against the official
   `validator.py`.

---

## 6. Phase 1 exit-gate status

See `docs/agent/PHASE_1_COMPLETION.md` for the item-by-item matrix. In summary: the browser-only
track is complete; backend/database items are **N/A under D1 = A**; official data, validator,
disruption and export contracts are **BLOCKED on DEC-002**.
