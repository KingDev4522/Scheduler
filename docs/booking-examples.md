# Booking Examples & Ambiguity Contract

**Status: authoritative inputs, provisional handling.** The request examples below are copied from
`CrunchWeek_StarterPack/examples/sample_requests.md`. The dataset's own `raw_text` fields are also test
inputs; judges use a harder set. Sources: starter README §`booking_requests`, `validator.py`
`check_bookings`, `CrunchWeek_StarterPack/examples/sample_requests.md`.

For each request the app should produce an **editable structured booking**, or ask a follow-up when
something essential is missing.

---

## 1. Official sample requests

1. Need a room for 45 people on Tuesday 6 to 8 pm, projector please.
2. Book the auditorium for the CSE department farewell, Friday evening, around 400 people, need stage and mic.
3. Can I get a lab with computers for a 3-hour coding contest on Thursday afternoon? About 60 participants.
4. Our club meets every Monday and Wednesday 7 to 8 pm, 30 people, any small room is fine.
5. Mechanical third years need a 2 hour session with an industry speaker on Wednesday, it's compulsory for them.
6. seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye
7. I want SH-2 on Friday at 10 am for a wheelchair-accessible poster session, 60 people.
8. Need somewhere for the quiz finals after lunch on Thursday, maybe 150 people.

### Expected structured output (given in the pack)

Request 1:
```json
{"attendance": 45, "duration_periods": 2,
 "windows": [{"day": "TUE", "from_period": 10, "to_period": 11}],
 "needs": ["projector"], "room_types": ["classroom", "lecture_hall", "seminar_hall"],
 "mandatory_for_groups": [], "follow_up": null}
```

Request 6 (Hinglish — “seminar hall tomorrow 6 pm, 2 hours, 100 people, need a mic”):
```json
{"attendance": 100, "duration_periods": 2,
 "windows": [{"day": "<tomorrow's weekday>", "from_period": 10, "to_period": 11}],
 "needs": ["pa_system"], "room_types": ["seminar_hall"], "follow_up": null}
```
“Kal” can mean yesterday or tomorrow; in a booking it means tomorrow, and the app must resolve it to a
weekday.

Request 7: SH-2 is not wheelchair accessible. A good system notices the conflict between the named room
and the stated need and **offers SH-1**, rather than silently booking SH-2.

Request 8: “after lunch” means P6 onward; the time and size are vague, so either ask, or propose a
window and make the assumption visible in the editable form.

Note the 18:00–22:00 window (periods 10–13) in requests 1 and 6: evening events use periods 10+.

---

## 2. Structured draft (from the dataset schema)

Fields the parser must fill — names taken from `booking_requests` in the dataset:

| Field | Type | Required | Note |
|---|---|---|---|
| `attendance` | number | yes | capacity check |
| `duration_periods` | number | yes | must fit inside one window |
| `windows` | `{day, from_period, to_period}[]` | yes | approved time must be inside one window |
| `room_types` | string[] | yes | from the room `type` enum |
| `needs` | string[] | no | e.g. `projector`, `pa_system`, `stage`, `accessible` |
| `requested_room` | string \| null | no | a wish; may not exist |
| `mandatory_for_groups` | string[] | no | groups that must be free |
| `requested_category` | enum | yes | capped by role (§3) |
| `raw_text` | string | yes | original message, preserved |
| `follow_up` | string \| null | no | set when a required value is missing/ambiguous |

`requester`, `role`, `department`, `submitted_at` and the effective category are **system-owned** —
never taken from the prompt. A prompt that claims “institute event, highest priority” does not change
the requester's role cap (§3).

---

## 3. Priority, roles and ties (from the validator)

- `priority_order = [exam, regular_session, institute_event, guest_lecture, department_event, club_event]`.
- `role_category_cap = {admin: institute_event, faculty: guest_lecture, department_coordinator: department_event, club: club_event}`.
- `effective_category = priority_order[max(index(requested_category), index(cap))]` — a role can never
  claim a higher category than its cap.
- Ties break by **earlier `submitted_at`**.
- Category weights: institute 5, guest 4, department 3, club 2.

## 4. Decision output

```
{ request_id, status: approved|rejected|alternative_offered,
  day?, start_period?, end_period?, room_id?, reason }
```

- `reason` is required for `rejected` and `alternative_offered`.
- `approved` must sit fully inside one requested window; otherwise use `alternative_offered`.
- Alternatives may sit outside the window (half score).
- Cancelled requests (`cancellations`) must never be approved.
- A rejected request that outranks an approved one which it could have used is a **priority inversion**
  and is reported by the validator.

## 5. Deterministic checks after every draft

1. Room exists, allows `event`, matches `room_types`, `capacity ≥ attendance`, supplies every `needs`
   (plus `accessible` when the room is accessible).
2. Time valid, inside P1–P13, span equals `duration_periods`, inside a requested window for approval.
3. No clash with a room outage, another booking, or a mandatory group's class.
4. Role/category cap respected; approver ≠ requester.

A schema-valid draft is **not** a valid booking — only these checks decide validity.

## 6. Dataset facts

- 25 `booking_requests`; 1 `cancellations` entry (`BR-04`, cancelled by Robotics Club).
- `requested_room` may not exist (dataset has one such case, `LHC-5`), which is a wish, not an error.
- Every `raw_text` is a parser test input.

## 7. App status

| Capability | State |
|---|---|
| Manual booking form | not implemented |
| Language parser / follow-up | not implemented (Phase 4) |
| Decision board + reasons + no self-approval | implemented on the demo model |
| Official booking schema | imported and stored (`src/lib/dataset.ts`); not yet driving the board |
