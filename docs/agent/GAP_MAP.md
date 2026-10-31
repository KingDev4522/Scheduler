# Gap Map — Navigation Surface vs. Phase Plan

Inventory of the ten `NAV` items in `src/lib/nav.tsx`, mapped to the owning phase and task.
Status legend: **done** = functional · **partial** = renders real data or part of the flow ·
**missing** = placeholder or absent.

State recorded after the Phase 1 implementation pass (2026-10-31, D1 = browser-only).

| # | Nav item | Route | Route file | Status | Owning phase / task | Notes |
|---|---|---|---|---|---|---|
| 1 | Dashboard | `/` | `src/pages/Dashboard.tsx` | **done** | Phase 1 / T2.3 | Cards, decision queue, conflicts, utilisation and activity all come from `src/lib/selectors.ts`. Reusable `EmptyState` / `ErrorState` / `LoadingState` / `StatusNotice` in `src/components/States.tsx`. |
| 2 | Timetables | `/timetables` | `src/pages/Timetables.tsx` | **done (demo)** | Phase 1 / T3.1–T3.3 | Mon–Fri × P1–P9, lunch divider, P10–P13 event band, duration blocks, legend, overlap highlighting, group/faculty/room views persisted in the URL, stacked mobile agenda. Real import still blocked on D2. |
| 3 | Rooms | `/rooms` | `src/pages/Rooms.tsx` | **done (demo)** | Phase 1 / T2.1 | Search, type, min capacity, feature, accessibility and day filters; availability from demo sessions + approved bookings; exam effective capacity shown; responsive table/cards; empty state. |
| 4 | Exams | `/exams` | `src/pages/Exams.tsx` | missing | Phase 2 (exams) · Phase 5 | Placeholder. Exam fields and semantics are `VERIFY` (D2). Half effective capacity rule is documented. |
| 5 | Bookings | `/bookings` | `src/pages/Bookings.tsx` | **done (demo)** | Phase 1 / T2.2 · Phase 3 | All 25 seed requests with priority, status, reason, conflicts. Admin decides all; coordinator decides own-department labs; event manager sees own only. Required reason, audit entry, localStorage persistence, self-approval blocked in UI **and** store. |
| 6 | Changes | `/changes` | `src/pages/Changes.tsx` | **done (demo)** | Phase 3 | Faculty-leave and room-closure repair via `repairTimetable` (unaffected sessions held fixed), before/after diff, moved count, submit-for-approval. Nothing is applied until Admin approval. Extra-session disruptions are not built yet. |
| 7 | AI Assistant | `/assistant` | `src/pages/Assistant.tsx` | missing | Phase 4 | Placeholder. Extraction, clarification, validation and offline fallback remain. |
| 8 | Approvals | `/approvals` | `src/pages/Approvals.tsx` | **done (demo)** | Phase 3 · Phase 4 | Pending queue + decision history, type filter, requester, conflicts, reason and actor. Bookings and change proposals are decided through the same store mutations the dashboard uses. |
| 9 | Import / Exports | `/admin` | `src/pages/AdminImportExport.tsx` | **partial** | Phase 1 (done) · Phase 2 engine | **Official dataset loader** (`cit_public.json`, 7/7 counts, path-level errors) and the demo engine panel (generate → validate → apply) are live. Remaining: wire the official dataset into the scheduler and generate the official `exports/schedule.json` (Phase 2). |
| 10 | Help | `/help` | `src/pages/Help.tsx` | **done** | Phase 1 | Demo accounts, role scope, Admin reset. |

## Cross-cutting support files

| File | Status | Purpose |
|---|---|---|
| `src/App.tsx` | done | Router + `RequireAuth` / `RequireRole` enforcement |
| `src/lib/nav.tsx` | done | Single source of truth for sidebar, routes and access |
| `src/lib/auth.tsx` | done | Three demo accounts, session, lockout |
| `src/lib/store.ts` | done (demo) | Demo entities, booking decisions, audited timetable apply |
| `src/lib/storage.ts` | done | Typed localStorage wrapper |
| `src/lib/time.ts` | done | Period/day constants and window validation |
| `src/lib/selectors.ts` | done | Shared derived data + deterministic conflict checks |
| `src/lib/import.ts` | done (provisional) | Demo-schema import validation + summary |
| `src/lib/dataset.ts` | **done** | Official `cit_public.json` loader + validation + storage |
| `src/components/AppShell.tsx` | done | shadcn Sidebar shell + header + outlet |
| `src/components/AppSidebar.tsx` | done | Sidebar navigation, groups, roles, collapse, user menu |
| `src/components/ui/*` | done | shadcn primitives (sidebar, sheet, tooltip, dropdown-menu, button, input, separator, skeleton) |
| `src/components/States.tsx` | done | Empty / error / loading / status primitives |
| `src/components/Badges.tsx` | done | Status, priority, room-type and session-kind badges |
| `src/components/DecisionDialog.tsx` | done | Reason-required approve/reject dialog |
| `src/components/TimetableGrid.tsx` | done | Desktop grid + mobile agenda |
| `src/engine/*` | done (demo) | Solver, adapter, independent validator, soft scoring, disruption planning |
| `docs/agent/FRONTEND_GUIDE.md` | done | Handoff guide for parallel frontend work |
| `docs/agent/ARCHITECTURE.md` | done | Layers, boundaries, API/interface contracts |
| `docs/agent/PHASE_1_COMPLETION.md` | done | Item-by-item Phase 1 acceptance matrix |
| `docs/data-dictionary.md` | **done (from source)** | Official fields, counts, invariants |
| `docs/validator-contract.md` | **done (from source)** | Official CLI, rules, penalties, score |
| `docs/disruption-contract.md` | **done (from source)** | Official change-file format |
| `docs/export-schema.md` | **done (from source)** | Official `schedule.json` schema |
| `docs/booking-examples.md` | **done (from source)** | Official requests, priority, role caps |
| `docs/starter-pack-inventory.md` | **done** | Every pack file + SHA-256 + consumption |
| `.env.example` | done | Placeholders only; `.env` is git-ignored |
| Official import | **done** | `cit_public.json` loads, 7/7 counts; JSON/CSV mirrors consistent |

## Phase 1 exit status

The full matrix lives in [`PHASE_1_COMPLETION.md`](PHASE_1_COMPLETION.md). Summary:

- **Phase 1 is complete on the browser-only track.** Workstream A (pack investigation) is done from
  source; the official dataset import succeeds with 7/7 counts and actionable errors.
- Backend/database items are **N/A under DEC-001** (D1 = browser-only); they reopen if D1 changes.
- Remaining outside Phase 1: wire the official schema into the scheduler, generate
  `exports/schedule.json`, run `validator.py` (Phase 2); tests, deployment and submission docs (Phase 5).
