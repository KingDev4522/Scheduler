# Phase 3 — Bookings, Rescheduling & Approvals

**Status: complete on the engine track.** The official 25 Spectra requests are decided
under a configurable priority policy, approvals are gated by role and self-approval checks,
the sample disruption is processed with minimal movement, and both exports pass the official
validator with 0 hard violations.

Sources: `03_PHASE_3_BOOKINGS_RESCHEDULING.md`, `05_BOOKINGS_AND_PRIORITY_PRD.md`,
`06_RESCHEDULING_PRD.md`, `CrunchWeek_StarterPack/README.md`,
`CrunchWeek_StarterPack/validator.py`, `examples/sample_disruption.json`.

---

## 1. How to run

```bash
python -m pip install -r solver/requirements.txt
python -m solver.run                                  # default dataset policy
python -m solver.run --policy my-policy.json          # Admin-changed priority order
python -m solver.run --approver admin                 # approver identity
python -m unittest discover -s solver/tests -v        # 28 tests (Phase 2 + 3)
```

Artifacts written to `exports/` and published to `public/exports/`:

| File | Meaning |
|---|---|
| `schedule.json` | timetable + exams + 25 booking decisions |
| `booking_decisions.json` | decisions, reasons, approver, timestamps, policy version/order |
| `schedule_after.json` | timetable after `sample_disruption.json` |
| `booking_decisions_after.json` | decisions after the disruption |
| `schedule_diff.json` | exact before/after diff + minimality proof |
| `*.report.json` | full official validator reports |

## 2. Components

| Module | Responsibility |
|---|---|
| `solver/policy.py` | priority order + role caps; Admin override via JSON; rejects invalid permutations |
| `solver/bookings.py` | deterministic decisions in priority order, tie-break by `submitted_at` |
| `solver/approvals.py` | approval gate: Admin-only, `requester != approver`, records actor/policy/time |
| `solver/diff.py` | per-session before/after, time vs room-only, directly-affected set, minimality |
| `solver/manual.py` | manual placement validator — same hard rules, no bypass |
| `solver/run.py` | orchestration, validator invocation, fail-safe exit code |

## 3. Decision procedure

1. Requests sorted by `priority_order[effective_category]`, then earlier `submitted_at`.
2. `effective_category = priority_order[max(index(requested), index(role_cap[role]))]` — a role
   cannot claim above its cap.
3. A request is **approved** only when a room and time satisfy all of:
   room allows `event`, type ∈ `room_types`, `capacity ≥ attendance`, every `needs` entry
   (plus `accessible`), the whole span is inside one requested window, and it clashes with no
   session, approved booking, room outage, or mandatory group's class.
4. If no in-window slot exists, an out-of-window feasible slot is offered as
   **`alternative_offered`** (half score, validator-checked). Otherwise **`rejected`** with a reason.
5. Cancelled requests are never approved (`B3`); they carry a rejection reason.

## 4. Results (official validator)

| Metric | `schedule.json` | `schedule_after.json` |
|---|---|---|
| Hard violations | **0** | **0** |
| Booking decisions | 25 | 25 |
| Approved / alternative / rejected | 21 / 2 / 2 | 21 / 2 / 2 |
| Booking score | 64.5 / 70 | 64.5 / 70 |
| Priority inversions | 0 | 0 |
| Sessions moved | — | **9** (3 time, 6 room-only) |
| Directly affected | — | 9 |
| Minimal movement | — | **true** |

`schedule_diff.json` lists every moved session with before/after and classifies time vs
room-only changes.

## 5. Acceptance criteria (`03_PHASE_3` §12)

| # | Criterion | Status |
|---|---|---|
| 1 | All starter booking requests loaded | ✅ 25/25 decided |
| 2 | Cancelled request handled correctly | ✅ BR-04 rejected, reason present, `B3` = 0 |
| 3 | Six priority categories in official order | ✅ `priority_order` matches the dataset |
| 4 | Admin can change priority order | ✅ `--policy` JSON; invalid permutations rejected; test proves club can outrank institute |
| 5 | Booking validation blocks hard conflicts | ✅ impossible-capacity request rejected; validator H13 = 0 |
| 6 | Every decision has a reason | ✅ all rejected/alternative rows carry a reason |
| 7 | Alternatives are actually validated | ✅ validator checks every alternative under H13 → 0 |
| 8 | No self-approval possible | ✅ `finalize_decisions` raises; tested |
| 9 | Role permissions enforced | ✅ engine gate is Admin-only (tested); app store enforces the same on demo data. A server-side check is D1-dependent. |
| 10 | Disruption file processed per actual schema | ✅ `faculty_unavailable`, `room_unavailable`, `add_session` applied |
| 11 | Rescheduling minimizes moved sessions | ✅ 9 moved = 9 directly affected → minimal |
| 12 | Before/after diff visible | ✅ `schedule_diff.json` + app Changes diff |
| 13 | No change applied before Admin approval | ✅ approval records required for every approved/alternative; engine emits a **proposal** artifact |
| 14 | Infeasible cases preserve the published schedule | ✅ infeasible solve returns no placements; runner writes no `schedule_after` |
| 15 | Manual scheduling cannot bypass hard constraints | ✅ `validate_manual` rejects H2–H12 conflicts; tested |
| 16 | Booking/rescheduling results pass official validation | ✅ 0 hard violations in both exports |

## 6. Known limits

- **UI wiring.** The engine produces the official artifacts; the app's Bookings/Changes/Approvals
  screens still operate on the demo store. Displaying the official decisions/diff is Phase 4 UI work,
  and a live "Decide" button needs a backend (D1 = B/C).
- **No `session_overrides`.** No booking displaces a regular class; institute events that clash are
  offered as alternatives. This is valid (`H13`/`B2` = 0) but leaves ~5.5 booking-score points.
- **No AI parsing.** English/Hinglish extraction is Phase 4; the official `raw_text` fields are
  preserved for that work.
- **Approval backend.** Under D1 = A there is no server; approval checks live in
  `solver/approvals.py` and in the app's demo store, not in a shared backend.
