# Phase 2 — Scheduling & Examination Engine

**Status: complete.** The engine generates `exports/schedule.json` and
`exports/schedule_after.json` from the official dataset; both pass
`CrunchWeek_StarterPack/validator.py` with **0 hard violations**.

Sources: `02_PHASE_2_SCHEDULING_ENGINE.md`, `CrunchWeek_StarterPack/README.md`,
`CrunchWeek_StarterPack/validator.py`, `docs/validator-contract.md`.

---

## 1. How to run

```bash
python -m pip install -r solver/requirements.txt   # ortools
python -m solver.run                                # solve, export, validate (exit 1 on any hard violation)
python -m unittest discover -s solver/tests -v      # 11 acceptance tests
```

`python -m solver.run` writes `exports/schedule.json`, `exports/schedule_after.json`, their validator
reports, and copies them to `public/exports/` so the web app can display them.

## 2. Architecture (per `02_PHASE_2` §4)

| Layer | Module | Responsibility |
|---|---|---|
| Input adapter | `solver/data.py` | Load `cit_public.json`; time model, eligibility, priority rules |
| Model builder | `solver/weekly.py` | CP-SAT weekly timetable |
| Exam model | `solver/exams.py` | CP-SAT exam datesheet |
| Booking decisions | `solver/bookings.py` | Deterministic Spectra priority decisions |
| Result decoder / export | `solver/export.py` | Build `schedule.json`; apply disruption files |
| Runner | `solver/run.py` | Orchestrate, invoke the official validator, exit code |
| Independent validator | `CrunchWeek_StarterPack/validator.py` | Official authority (unmodified) |
| Tests | `solver/tests/test_phase2.py` | 11 checks incl. validator runs |

The solver never certifies itself: every export is checked by the official validator before the run
is considered successful.

## 3. Decision variables and constraints

**Weekly** (`weekly.py`)
- `x[session, slot]` booleans over legal slots; `start[session]` integer channelled to them;
  `room[session, room]` booleans over eligible rooms.
- Legal slots exclude lunch crossers (H9), enforce 3-hour lab starts at P2/P6 (H9), honour
  `fixed_slot` (H14) and faculty unavailability (H7).
- Rooms: `NoOverlap` over optional intervals (H4); eligibility = `type ∈ room_types` (H6),
  `capacity ≥ size` (H5), accessibility when required (H10).
- Faculty: `NoOverlap` per faculty (H2); daily hours ≤ `max_hours_per_day` (H12).
- Groups: `NoOverlap` per group (H3). Sessions sharing a `basket_slot` are forced to one slot
  (H11) and counted once per group so options do not clash with each other.
- Room unavailability forbids room+slot combinations (H8).

**Exams** (`exams.py`)
- `x[exam, slot]` over `calendar.exam_week.days × sessions` (AM/PM); exactly one per exam (E1).
- `y[exam, slot, room]`; rooms must allow `exam` (E2); `Σ(capacity // 2) ≥ size` (H5, half capacity);
  a room hosts one exam per slot (H4); a group sits one exam per slot (H3).

**Bookings** (`bookings.py`)
- Requests are decided in priority order (`priority_order`, role cap, earlier `submitted_at`).
- Approved only when the room allows events, matches `room_types`, has capacity and features, sits
  fully inside one requested window, and clashes with no session, approved booking or mandatory group
  (H13). Otherwise an out-of-window slot is offered as `alternative_offered`, or the request is
  rejected with a reason, or noted as cancelled (B3).

## 4. Objective (all six soft constraints)

| Code | Term in the model |
|---|---|
| S1 | avoided faculty day+period, 2 per teaching hour |
| S2 | idle gap between a group's first and last period on a day |
| S3 | `max(0, group hours/day − 6) × 3` |
| S4 | `(extra occurrences of a course for a group in a day) × 3` |
| S5 | room fill below 40 % |
| S6 | session in P9 |

Weights are the validator's own, not invented. When a `baseline` is supplied (disruption re-solve) a
large movement penalty dominates the soft terms so as few sessions move as possible.

## 5. Results (official dataset)

| Metric | `schedule.json` | `schedule_after.json` |
|---|---|---|
| Hard violations | **0** | **0** |
| Sessions scheduled | 189 / 189 | 189 / 189 |
| Exams scheduled | 41 / 41 | 41 / 41 |
| Soft penalty | 12 (S4) | 12 (S4) |
| Booking score | 67.0 / 70 | 67.0 / 70 |
| Priority inversions | 0 | 0 |
| Sessions moved | — | 10 (4 time, 6 room-only) |

## 6. Acceptance criteria (`02_PHASE_2` §13)

| Criterion | Status |
|---|---|
| All 189 sessions assigned exactly once | ✅ validator H1 = 0 |
| All hard constraints pass the official validator | ✅ 0 violations |
| All six soft constraints represented per official semantics | ✅ S1–S6 in the objective with validator weights |
| No unsupported penalty weights hardcoded | ✅ weights taken from `validator.py` |
| Exam scheduler handles all 41 exams | ✅ E1 = 0 |
| Half-capacity exam rule enforced | ✅ `Σ(capacity // 2) ≥ size` |
| Result status accurately reported | ✅ FEASIBLE / INFEASIBLE / UNKNOWN; runner exits 1 on failure |
| Invalid or infeasible results are not published | ✅ exports written only on FEASIBLE; infeasible test asserts empty placements |
| `exports/schedule.json` generated by the application | ✅ `python -m solver.run` |
| Tests cover all listed constraints | ✅ `solver/tests/test_phase2.py`, 11 tests |

**Exit gate:** timetable and exams are generated by the engine and checked against the official
validator with zero hard violations. Met.

## 7. Known limits

- The runner is an offline CLI, not a web service. Under D1 = A the SPA cannot invoke it; artifacts are
  published to `public/exports/` for the UI to display. A live "generate" button needs D1 = B/C.
- No `session_overrides`: no booking displaces a regular class. Institute events that clash are offered
  as alternatives. This is valid (H13/B2 hold) but leaves some booking score on the table.
- Exam invigilation and seating are not modelled; the validator does not require them.
