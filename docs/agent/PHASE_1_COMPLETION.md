# Phase 1 Completion Matrix

**Status: COMPLETE on the browser-only track (D1 = A).** The organizer starter pack was found at
`CrunchWeek_StarterPack/`, so every Phase 1 research and import deliverable is now written from source.
The phase exit gate is met: the dataset, validator contract, time model, session representation,
export format and disruption format can all be explained from the pack.

Remaining non-Phase-1 items: backend/database startup (N/A under D1 = A) and the external
"repository created after hackathon start" check.

Last updated: 2026-10-31 · `npm run build` green · official dataset import verified 7/7 counts.

---

## 1. `01_PHASE_1_FOUNDATION.md` §9 acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | All starter-pack files inventoried | **DONE** | `docs/starter-pack-inventory.md` — 15 files, sizes, SHA-256 prefixes |
| 2 | Data dictionary complete for fields used by the app | **DONE** | `docs/data-dictionary.md` — every collection/field from the starter README, with counts |
| 3 | Validator invocation and expected input/output documented | **DONE** | `docs/validator-contract.md` — CLI, report shape, H1–H14, B1–B3, E1–E2, S1–S6 |
| 4 | Disruption file semantics documented | **DONE** | `docs/disruption-contract.md` — five change types, permanence, ordering, baseline |
| 5 | Official export schema documented from source | **DONE** | `docs/export-schema.md` — `schedule.json` / `schedule_after.json` |
| 6 | Repository created after hackathon start | **EXTERNAL** | Not verifiable from the working tree; needs the organizer timeline |
| 7 | Frontend starts locally | **DONE** | `npm run dev` → `http://localhost:5173`; production build green |
| 8 | Backend starts locally | **N/A under D1 = A** | No backend by decision (DEC-001); future contract in `ARCHITECTURE.md` |
| 9 | Database starts and migrations run | **N/A under D1 = A** | No database; localStorage is the store |
| 10 | Dataset import succeeds and produces a clear summary | **DONE** | `src/lib/dataset.ts` + Admin panel; real file: 7/7 counts, 0 errors |
| 11 | Invalid input produces useful errors | **DONE** | Verified: duplicate id, unknown faculty, unknown cancellation ref, missing collection, malformed JSON |
| 12 | `.env.example` exists and contains no secrets | **DONE** | `.env.example`; `.env` is git-ignored |
| 13 | Team architecture and API contracts documented | **DONE** | `docs/agent/ARCHITECTURE.md` |

**Score: 10 done, 2 N/A under D1 = A, 1 external.** If D1 changes to B/C, items 8–9 reopen.

---

## 2. Workstream A — Starter-pack investigation

| Task | Status | Evidence |
|---|---|---|
| Confirm all files present and readable | **DONE** | `docs/starter-pack-inventory.md` |
| Read the starter README completely | **DONE** | Field meanings, time model, export, disruption, validator usage |
| Inspect `cit_public.json` collections/fields | **DONE** | `docs/data-dictionary.md` §3 |
| Compare JSON and CSV consistency | **DONE** | All 9 collections: same counts and id sets → `CONSISTENT` |
| Inspect `validator.py` | **DONE** | `docs/validator-contract.md` — CLI, rules, penalties, score, stability |
| Inspect `sample_disruption.json` | **DONE** | `docs/disruption-contract.md` §4 |
| Review sample English/Hinglish requests | **DONE** | `docs/booking-examples.md` — 8 official examples + expected structure |
| Record uncertainties | **DONE** | Resolved from source; remaining D1/role items tracked in `DECISIONS.md` |

**Required outputs:** `docs/data-dictionary.md` ✅ · `docs/validator-contract.md` ✅ ·
`docs/disruption-contract.md` ✅ · `docs/booking-examples.md` ✅ · starter-pack inventory ✅

---

## 3. Workstream B — Architecture and repository

| Task | Status |
|---|---|
| Architecture documented (current + future options) | **DONE** — `docs/agent/ARCHITECTURE.md` |
| Module boundaries and responsibilities | **DONE** |
| Repository rules (no secrets, no organizer-file edits, no pre-hackathon code) | **DONE** |
| `.env.example` with placeholders only | **DONE** |
| GitHub repository creation | **EXTERNAL** |
| `AI_USAGE.md` / `THIRD_PARTY.md` | Phase 5 (no AI provider is used yet) |

---

## 4. Workstream C — Local environment

| Item | Status |
|---|---|
| Frontend: React + TS + Vite + Tailwind, router, type check | **DONE** |
| Frontend lint | **N/A** — no ESLint config; `tsc --noEmit` is the gate |
| Backend / PostgreSQL / Alembic / Docker / Redis | **N/A under D1 = A** |
| Pytest | **N/A under D1 = A** |
| Automated test suite (Vitest or equivalent) | **NOT DONE** — Phase 5; current verification is `npm run build` plus Node checks |
| API client | **N/A under D1 = A** |

---

## 5. Workstream D — Domain model and import

| Requirement | Status |
|---|---|
| Validate required fields and types | **DONE** — `src/lib/dataset.ts` |
| Preserve source identifiers | **DONE** |
| Detect duplicate identifiers | **DONE** |
| Check foreign-key references | **DONE** (sessions→courses/faculty/groups, cancellations→requests, exams→courses) |
| Report malformed rows with actionable errors | **DONE** (`sessions[0].faculty_id: Unknown faculty "F-NOPE"`) |
| Repeatable and safe imports | **DONE** — nothing stored unless validation passes |
| Keep original source files unchanged | **DONE** — the app reads a copy; organizer files untouched |
| Record dataset version/hash | **DONE** — `fnv1a-…`, `dataset_id`, stored timestamp/actor |
| Official dataset import succeeds with a summary | **DONE** — 27/40/14/62/189/25/41 all match |
| Official CSV columns mapped into the app | **PARTIAL** — JSON is the app's import path; CSV mirrors verified identical but not yet parsed by the official adapter |

---

## 6. Phase exit gate

> “Do not begin full solver implementation until the team can explain the dataset, official validator
> contract, time model, session representation, export format and disruption input format.”

| Gate question | Answer | Source |
|---|---|---|
| Dataset | 14 top-level collections, counts verified | README + `cit_public.json` |
| Validator contract | CLI, rules, soft weights, booking score, stability | `validator.py` |
| Time model | MON–FRI, P1–P9, lunch after P5, P10–P13 events, labs P2/P6 | README |
| Session representation | `id, course_id, kind, groups[], faculty_id, size, duration, room_types[], needs_accessible, basket_slot, fixed_slot` | README |
| Export format | `sessions[]`, `fest_week{bookings[], session_overrides[]}`, `exams[]` | README + example |
| Disruption input | five change types, permanent, applied in order | README + `apply_disruption` |

**Exit gate: MET on the browser-only track.** The official scheduler and exports are Phase 2.

---

## 7. What remains outside Phase 1

1. **D1** — confirm browser-only, or authorise the backend/database (reopens §9 items 8–9).
2. **D3** — confirm three demo roles or add Faculty (the pack names four roles).
3. **Repository provenance** — confirm creation after the hackathon start.
4. **Phase 2** — map the official schema into the scheduler, generate a validated timetable and exams,
   produce `exports/schedule.json` and run `validator.py`.
5. **Phase 5** — automated test suite, deployment, `AI_USAGE.md`, `THIRD_PARTY.md`, video.

---

## 8. How to verify

```bash
npm install
npm run build        # type-check + production build
npm run dev          # http://localhost:5173 → Admin → Load bundled dataset

# Official validator (example intentionally is not a solution)
python CrunchWeek_StarterPack/validator.py \
  --data CrunchWeek_StarterPack/data/cit_public.json \
  --schedule CrunchWeek_StarterPack/examples/schedule.example.json --quiet
```

Import checks run in Node:
- valid `cit_public.json` → `ok: true`, 0 errors, 7/7 counts;
- duplicate room id → `rooms[27].id: Duplicate room id "AUD"`;
- unknown faculty → `sessions[0].faculty_id: Unknown faculty "F-NOPE"`;
- missing collection → `exams: Missing required top-level field "exams"`;
- malformed JSON → `$: Invalid JSON…`.
