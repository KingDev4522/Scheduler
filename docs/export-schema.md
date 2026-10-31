# Export Schema — `schedule.json` / `schedule_after.json`

**Status: authoritative.** Copied from `CrunchWeek_StarterPack/README.md` §"What you export:
schedule.json" and the shape of `examples/schedule.example.json`. The example is explicitly *not* a
valid solution.

Both files must be produced by the application. Hand-made or hand-edited files lead to
disqualification (README; `05_PHASE_5_TEST_DEPLOY_SUBMISSION.md` §10).

---

## 1. `exports/schedule.json` (initial timetable)

```json
{
  "team": "Your team name",
  "dataset_id": "cit-public-v1",
  "sessions": [
    {"session_id": "MA101-AB-L1", "day": "MON", "start_period": 2, "room_id": "LH-1"}
  ],
  "fest_week": {
    "bookings": [
      {"request_id": "BR-01", "status": "approved", "day": "MON",
       "start_period": 4, "end_period": 5, "room_id": "AUD", "reason": "Institute event"},
      {"request_id": "BR-09", "status": "rejected", "reason": "No venue seats 1,200"},
      {"request_id": "BR-07", "status": "alternative_offered", "day": "THU",
       "start_period": 10, "end_period": 12, "room_id": "AUD", "reason": "SH-1 taken by an earlier request"}
    ],
    "session_overrides": [
      {"session_id": "ID101-ALL-L1", "day": "WED", "start_period": 4,
       "room_id": "AUD", "displaced_by": "BR-01"}
    ]
  },
  "exams": [
    {"exam_id": "EX-MA101", "day": "MON", "session": "AM", "rooms": ["AUD", "LH-1", "LH-2"]}
  ]
}
```

## 2. `exports/schedule_after.json` (after the sample disruption)

Same shape, produced by applying `examples/sample_disruption.json` starting from `schedule.json`.
`exams` becomes optional here; the validator checks exams only when present.

## 3. Field rules

### `sessions`
| Field | Rule |
|---|---|
| `session_id` | must match a dataset session id |
| `day` | `MON`–`FRI` |
| `start_period` | 1–9; `start + duration − 1 ≤ 9`; must not span the P5→P6 lunch; labs at P2/P6 |
| `room_id` | must exist and satisfy type/capacity/accessibility and `allowed_uses` |

Every dataset session appears exactly once (validator `H1`).

### `fest_week.bookings`
| Field | Rule |
|---|---|
| `request_id` | one decision per request; cancelled requests must not be approved |
| `status` | `approved` \| `rejected` \| `alternative_offered` |
| `day`, `start_period`, `end_period` | `end_period` is **inclusive**; span must equal `duration_periods`; `1 ≤ start ≤ end ≤ 13` |
| `room_id` | must exist, allow `event`, match `room_types`, satisfy `capacity ≥ attendance` and every `needs` entry |
| `reason` | required for `rejected` and `alternative_offered` (missing reason is a validator warning) |

- `approved` must sit **fully inside one requested window**; if it cannot, use
  `alternative_offered` — alternatives may sit outside the window and are scored at half weight.
- Higher priority never overrides room physics, capacity or features (validator `H13`).

### `fest_week.session_overrides`
| Field | Rule |
|---|---|
| `session_id` | known session |
| `day`, `start_period`, `room_id` | the Week-7 placement |
| `displaced_by` | an **approved** booking whose effective category is at most `institute_event` |

Only an approved institute event may displace a regular session, and the session must be **moved, not
dropped** (README; validator `B2`).

### `exams`
| Field | Rule |
|---|---|
| `exam_id` | must match a dataset exam |
| `day` | one of `calendar.exam_week.days` (`MON`–`SAT`) |
| `session` | one of `calendar.exam_week.sessions` ids (`AM`, `PM`) |
| `rooms` | each must allow `exam`; Σ(room capacity // 2) ≥ exam size; no room or group used twice in the same slot |

`exams` is **required** in `schedule.json`; a missing exam schedule counts every exam as unscheduled.

## 4. Scoring summary (validator)

- Hard violations by rule (`H*`, `B*`, `E*`) — target **zero**.
- Soft penalty `S1`–`S6` (see `docs/validator-contract.md` §5).
- Booking score, priority inversions.
- Exam soft penalty.
- Stability (moved sessions) when `--baseline` is passed.

## 5. App status

| Item | State |
|---|---|
| Export writer | **not implemented** — the app has no `exports/schedule.json` yet |
| Internal snapshot export | exists (Admin page) but is **not** the official format |
| Official export is blocked until the scheduler runs on the official dataset | Phase 2 |

Do not hand-write these files: the disqualification rule is explicit. The export must be serialized
from a validated, app-generated schedule.
