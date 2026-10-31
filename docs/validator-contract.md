# Validator Contract

**Status: authoritative.** Documented from `CrunchWeek_StarterPack/validator.py` (SHA-256 prefix
`f02733b382fa111e`) and `CrunchWeek_StarterPack/README.md` §"Running the validator". Python 3.8+,
standard library only.

The validator is the scoring authority. If it and the app disagree, **the validator wins**
(`validator.py` docstring).

---

## 1. Invocation

```
python validator.py --data data/cit_public.json --schedule schedule.json
python validator.py --data data/cit_public.json --schedule schedule.json --json report.json
python validator.py --data data/cit_public.json --schedule schedule_after.json \
                    --disruption examples/sample_disruption.json --baseline schedule.json
```

| Flag | Meaning |
|---|---|
| `--data` | the dataset (`cit_public.json`) |
| `--schedule` | the export to score |
| `--disruption` | a change file applied to the data **before** scoring |
| `--baseline` | the pre-change schedule; enables the stability (moved-session) section |
| `--json` | write the full report |
| `--quiet` | suppress the per-violation list |

It prints dataset id, schedule dataset id, hard violations by rule, soft penalty S1–S6, booking score
and priority inversions, exam soft penalty, and stability when a baseline is given.

## 2. Report shape (`--json`)

```json
{
  "dataset_id": "...", "schedule_dataset_id": "...", "team": "...",
  "soft_penalties": {"S1":0,"S2":0,"S3":0,"S4":0,"S5":0,"S6":0},
  "soft_total": 0,
  "bookings": {
    "booking_score": 0, "booking_score_max_if_all_approved": 0,
    "approved": 0, "alternatives": 0, "rejected": 0,
    "session_overrides": 0, "priority_inversions": []
  },
  "exam_soft_penalty": 0,
  "stability": {"sessions_moved":0,"time_changed":0,"room_only_changed":0,"moved_ids":[]},
  "hard_violations": [{"rule":"H4","where":"timetable","detail":"..."}],
  "hard_violation_count": 0,
  "hard_by_rule": {"H4": 1},
  "warnings": []
}
```

Violations are de-duplicated by `(rule, detail)` so the Spectra-week view does not double-count
base-timetable problems.

## 3. Hard rules (timetable — `check_timetable`)

| Rule | Check |
|---|---|
| `H1` | every session scheduled exactly once; known id; valid day; room exists |
| `H2` | no faculty teaching two sessions in the same slot |
| `H3` | no student group with two overlapping sessions; basket slots are keyed as one occupant so options do not clash |
| `H4` | no room with two overlapping occupants |
| `H5` | `room.capacity >= session.size` |
| `H6` | `room.type ∈ session.room_types` |
| `H7` | no session in a faculty `unavailable` (day, period) |
| `H8` | no session in a `room_unavailability` (day, period) |
| `H9` | `start + duration - 1 <= 9`; block must not span P5→P6 lunch; a `lab` must start at a `lab_start_periods` value (P2/P6) |
| `H10` | `needs_accessible` ⇒ room `accessible` |
| `H11` | every session sharing a `basket_slot` sits at the same `(day, start)` |
| `H12` | faculty daily hours ≤ `max_hours_per_day` |
| `H13` | booking checks (below) |
| `H14` | `fixed_slot` match |

## 4. Booking rules (`check_bookings`)

| Rule | Check |
|---|---|
| `B1` | exactly one decision per request; status ∈ `approved/rejected/alternative_offered`; rejected/alternative need a non-empty `reason` (missing reason is a **warning**) |
| `B2` | every `session_override` names a known session and an **approved** booking whose effective category is at most `institute_event`; only institute events may displace a regular session |
| `B3` | a cancelled request must not be `approved` or `alternative_offered` |
| `H13` | an approved/alternative booking must: name a room that allows `event`; have a valid day and `start ≤ end` within P1–P13; span exactly `duration_periods`; match a `room_type`; have `capacity ≥ attendance`; supply every `needs` entry (plus `accessible` when the room is accessible); not collide with a room outage, another booking, or a mandatory group’s classes. **Approved** must also sit fully inside one requested `window`; an **alternative** may sit outside (half score) |

`booking_score = Σ CAT_WEIGHT[effective_category] × (1.0 approved | 0.5 alternative)`; cancelled
requests are excluded from `max_score`. `CAT_WEIGHT = {institute_event:5, guest_lecture:4,
department_event:3, club_event:2}`.

**Priority inversions** are reported when a rejected request outranks an approved one
(`outranks`: lower `priority_order` index wins; ties broken by earlier `submitted_at`) and could have
used the approved request’s room/window without a clash.

`effective_category(req) = priority_order[max(index(requested_category), index(role_category_cap[role]))]`.

## 5. Soft penalties (`soft_score`)

| Code | Meaning | Weight | Source |
|---|---|---|---|
| `S1` | teaching hour inside a faculty `preferences.instead`/`avoid` day+period | 2 per hour | `soft_score` |
| `S2` | free period between two busy periods for a group on a day, lunch excluded | 1 per gap | same |
| `S3` | group teaches more than 6 hours in a day | 3 per hour over 6 | same |
| `S4` | same course twice in a day for a group (lectures; basket lectures counted separately) | 3 per extra | same |
| `S5` | `size / capacity < 0.40` | 1 per session | same |
| `S6` | session occupies P9 | 1 per session | same |

Exam soft penalty: 5 points per extra exam a group sits on the same day.

## 6. Exams (`check_exams`)

| Rule | Check |
|---|---|
| `E1` | every exam placed exactly once; valid day ∈ `calendar.exam_week.days`; valid session id ∈ `exam_week.sessions`; every exam present |
| `E2` | each room allows `exam` |
| `H5` | Σ(room capacity // 2) ≥ exam size |
| `H4` | no room hosting two exams in the same (day, session) |
| `H3` | no group sitting two exams in the same (day, session) |

`exams` is required in `schedule.json`; in `schedule_after.json` it is checked only when present.

## 7. Stability (`--baseline`)

`sessions_moved` = sessions whose `(day, start, room)` differs from the baseline;
`time_changed` = day or start differs; `room_only_changed` = same day/start, different room.

## 8. Role of the app's internal validator

`src/engine/validate.ts` is an independent check on the **demo** model (H01–H06, H08, H09, H12–H14).
It is not the scoring authority and does not model `H10`, `H11`, `B*`, `E*` yet.

Adoption rule: once the official pipeline exists, run `validator.py` unmodified on the export and keep
our validator as a differential oracle. Map our codes to the official rules in a table and record
every disagreement as a defect in ours. **No wrapper may patch the validator or its output.**

## 9. Checklist

- [x] CLI, inputs, outputs and report shape documented from source.
- [x] Hard rules H1–H14, B1–B3, E1–E2 documented from source.
- [x] Soft penalties S1–S6 and exam penalty documented with weights.
- [x] Booking score, priority order/caps and inversion rule documented.
- [x] Moved-session definition documented.
- [ ] Run the validator on a generated export (Phase 2).
- [ ] Differential mapping table between `H*` codes (Phase 2).
