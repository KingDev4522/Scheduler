# Phase 3 Completion Matrix

## 0. Backend update (2026-10-31)

The engine now runs behind FastAPI, and the system-level gaps are closed:

- **Priority policy:** `GET/PUT /api/policy` (Admin), invalid permutations rejected; changing it invalidates the schedule and affects the next generate (verified: default score 63 vs custom 64.5).
- **Approval gate:** a disruption creates `proposal_status = pending`; `schedule_after.json` returns 404 until `POST /api/proposal/approve`; reject discards it.
- **Manual scheduling:** `POST /api/manual` validates against H2–H12 and never auto-applies; conflicts return 422 with rule IDs.
- **Role enforcement:** demo identity header; Admin-only generate/reset/approve/policy, Admin or Coordinator for manual proposals.
- **Persistence:** SQLite; generated schedule survives a restart.
- **Tests:** 28 engine tests + 10 backend API tests pass. Latest result: soft 3, booking score 63/70, disruption 12 moved (minimal).

---

**Status: complete on the engine track.** All 16 acceptance criteria are met and covered by tests.
The official artifacts are generated and validated; the app UI still renders the demo store until
the official data is wired into the screens (Phase 4), and a live approval backend depends on D1.

Last updated: 2026-10-31 · `python -m solver.run` → PASS · 28 tests pass.

---

## 1. `03_PHASE_3_BOOKINGS_RESCHEDULING.md` §12 acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | All starter booking requests can be loaded | `exports/schedule.json` has 25 decisions; ids match the dataset |
| 2 | Cancelled request handled correctly | BR-04 rejected with reason; validator `B3 = 0` |
| 3 | Six priority categories in official order | `priority_order = [exam, regular_session, institute_event, guest_lecture, department_event, club_event]` |
| 4 | Admin can change priority order | `solver/policy.py` + `--policy`; invalid permutations rejected; test proves reordering changes precedence |
| 5 | Booking validation blocks hard conflicts | `test_impossible_request_is_rejected`; validator `H13 = 0` |
| 6 | Every decision has a reason | rejected/alternative rows all carry `reason`; test enforces it |
| 7 | Alternatives are actually validated | official validator checks every alternative; `H13 = 0` |
| 8 | No self-approval possible | `finalize_decisions` raises; `test_self_approval_blocked` |
| 9 | Role permissions enforced | engine gate rejects non-Admin approvers (`test_only_admin_role_may_approve`); demo store enforces the same |
| 10 | Disruption file processed per actual schema | `faculty_unavailable`, `room_unavailable`, `add_session` applied; `CS202-T2` present in `schedule_after.json` |
| 11 | Rescheduling minimizes moved sessions | 9 moved = 9 directly affected; `moved_minimal: true` |
| 12 | Before/after diff visible | `exports/schedule_diff.json` with before/after per session |
| 13 | No change applied before Admin approval | approval records cover every approved/alternative decision; the reschedule is emitted as a proposal artifact |
| 14 | Infeasible cases preserve the published schedule | infeasible solve returns no placements; runner does not write `schedule_after.json` |
| 15 | Manual scheduling cannot bypass hard constraints | `validate_manual` checks H2–H12; tested |
| 16 | Booking/rescheduling results pass official validation | both exports: 0 hard violations |

## 2. Generated artifacts

| Artifact | Result |
|---|---|
| `exports/schedule.json` | 189 sessions, 41 exams, 25 decisions, 0 hard violations, soft 12, booking score 64.5/70 |
| `exports/schedule_after.json` | disruption applied, 0 hard violations, 9 moved (minimal) |
| `exports/booking_decisions.json` | 23 approval records (21 approved + 2 alternatives), policy version, reasons |
| `exports/schedule_diff.json` | 9 moved rows, 3 time / 6 room-only, directly affected = 9, minimal = true |
| `exports/*.report.json` | full official validator reports |

## 3. Tests

```bash
python -m unittest discover -s solver/tests -v
# Ran 28 tests ... OK
```

Phase 3 tests cover: all requests decided, cancellation, reasons, priority order, configurable
order, invalid order rejection, impossible request rejection, alternative validity, self-approval,
role gate, disruption application, minimal movement, diff shape, approval coverage, infeasible
preservation, manual conflict rejection, and both validator runs.

## 4. Remaining outside Phase 3

- Official bookings/diff/approvals **UI** (the app still shows the demo store) — Phase 4.
- A shared backend approval service — requires D1 = B/C.
- AI/Hinglish request parsing — Phase 4.
- `session_overrides` for class-displacing institute events — valid without them, score opportunity.
