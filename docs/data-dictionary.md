# Data Dictionary — Official Dataset (`cit-public-v1`)

**Status: authoritative.** Every field below is copied from the organizer starter pack and cites its
source. The pack is present at `CrunchWeek_StarterPack/`; nothing is inferred.

Sources:
- `CrunchWeek_StarterPack/README.md` — §"Time model", §"The dataset, field by field", §"What you export".
- `CrunchWeek_StarterPack/data/cit_public.json` — the dataset itself.
- `CrunchWeek_StarterPack/validator.py` — rule implementation that consumes these fields.

Dataset: `dataset_id = "cit-public-v1"`, `institute = "Chilika Institute of Technology (fictional)"`.
Top-level keys: `dataset_id, institute, calendar, priority_order, role_category_cap, rooms,
room_unavailability, faculty, student_groups, courses, sessions, booking_requests, cancellations, exams`.

---

## 1. Verified counts

| Collection | Count | README claim |
|---|---|---|
| `rooms` | 27 | 27 (incl. 7 labs) ✔ |
| `faculty` | 40 | 40 ✔ |
| `student_groups` | 14 | 14 ✔ |
| `courses` | 62 | 62 ✔ |
| `sessions` | 189 | 189 / 243 teaching hours ✔ |
| `booking_requests` | 25 | 25 ✔ |
| `cancellations` | 1 | one request cancelled ✔ |
| `exams` | 41 | 41 ✔ |
| `room_unavailability` | 2 | — |

Verified by `src/lib/dataset.ts` (`parseOfficialDataset`) and reported as count targets on every load.

---

## 2. Time model

| Concept | Value | Source |
|---|---|---|
| Days | `MON … FRI` (exam week also `SAT`) | README §Time model; `calendar.days` |
| Teaching periods | `1 … 9`, one hour each (P1 08:00 … P5 12:00, P6 14:00 … P9 17:00) | README |
| Lunch | after period 5 (13:00–14:00) | `calendar.lunch.after_period` |
| Event-only periods | `10 … 13` (18:00–22:00) | README |
| Occupancy | duration `d` at start `p` occupies `p … p+d-1`; may not span P5→P6 | README |
| Labs | `kind = "lab"`, 3 hours, start only at P2 or P6 | README; `calendar.lab_start_periods` |
| Exam sessions | `AM` 09:30–11:30, `PM` 14:00–16:00 | `calendar.exam_week.sessions` |

---

## 3. Collections

### 3.1 `rooms`
| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique, e.g. `AUD`, `LH-1`, `PHY-LAB` |
| `name`, `building` | string | |
| `type` | enum | `classroom`, `lecture_hall`, `auditorium`, `seminar_hall`, `outdoor`, `lab_cs`, `lab_elec`, `lab_phy`, `workshop`, `lab_civil` |
| `capacity` | number | Exams use half capacity (`validator.py` `r["capacity"] // 2`) |
| `features` | string[] | e.g. `projector`, `pa_system`, `stage`, `ac` |
| `accessible` | boolean | Counted as an extra feature for `needs` checks |
| `allowed_uses` | string[] | subset of `lecture`, `tutorial`, `lab`, `exam`, `event`; seminar halls and the outdoor theatre never take regular classes |

### 3.2 `room_unavailability`
`room_id`, `day`, `periods` (number[]), `reason`. Hard (validator rule `H8`).

### 3.3 `faculty`
| Field | Type | Notes |
|---|---|---|
| `id`, `name`, `department` | string | |
| `max_hours_per_day` | number | Hard daily limit (`H12`) |
| `needs_accessible` | boolean | |
| `unavailable` | `{day, periods[], reason?}[]` | Hard (`H7`) |
| `preferences` | `{type:"avoid", days[], periods[], note?}[]` | Soft S1: 2 points per teaching hour inside an avoided day+period |

### 3.4 `student_groups`
`id`, `name`, `year`, `department`, `size`, `needs_accessible`. 14 groups = Year 1 sections A–D plus
Years 2 and 3 across 5 branches.

### 3.5 `courses`
`id`, `title`, `department`, `year`, `lecture_hours`, `tutorial_hours`, `lab_blocks`. Reference only —
courses are not scheduled; **sessions** are.

### 3.6 `sessions` (the schedulable unit)
| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `MA101-AB-L1` |
| `course_id` | string | FK → `courses` |
| `kind` | enum | `lecture` \| `tutorial` \| `lab` |
| `groups` | string[] | every group that must attend |
| `faculty_id` | string | FK → `faculty` (already assigned) |
| `size` | number | head count for capacity checks |
| `duration` | number | periods |
| `room_types` | string[] | allowed room types |
| `needs_accessible` | boolean | |
| `basket_slot` | string \| null | e.g. `OEB-1`; all sessions sharing it must run at the same day+period in different rooms |
| `fixed_slot` | `{day, start_period}` \| null | must go exactly there (`H14`) |

### 3.7 `booking_requests` (Spectra week)
| Field | Type | Notes |
|---|---|---|
| `id` | string | `BR-01 …` |
| `submitted_at` | ISO-8601 string | Tie-break: earlier wins |
| `requester`, `role`, `department` | string / enum / string\|null | `role ∈ admin, department_coordinator, faculty, club` |
| `requested_category` | enum | capped by role (see §4) |
| `title` | string | |
| `attendance` | number | capacity check |
| `duration_periods` | number | must fit inside one window |
| `windows` | `{day, from_period, to_period}[]` | approved time must be inside a window |
| `room_types`, `needs` | string[] | `needs` may include `accessible` |
| `requested_room` | string \| null | a wish; may not exist |
| `mandatory_for_groups` | string[] | groups that must be free |
| `series_id` | string \| null | |
| `raw_text` | string | original message; doubles as parser test input |

### 3.8 `cancellations`
`request_id`, `cancelled_at`, `by`, `note`. Cancelled requests must never be approved (`B3`).

### 3.9 `exams`
`id`, `course_ids[]`, `groups[]`, `size`, `duration_hours`. Exam week `MON–SAT`, sessions `AM`/`PM`;
rooms seat half their capacity; an exam may use several rooms.

### 3.10 `calendar`, `priority_order`, `role_category_cap`
- `calendar`: `days`, `periods[{id,start,end,teaching}]`, `lunch{after_period,start,end}`,
  `lab_start_periods`, `exam_week{days,sessions[]}`.
- `priority_order`: `["exam","regular_session","institute_event","guest_lecture","department_event","club_event"]`.
- `role_category_cap`: `admin→institute_event`, `faculty→guest_lecture`,
  `department_coordinator→department_event`, `club→club_event`. A request's effective category is
  `priority_order[max(index(requested), index(cap))]` (`validator.py` `effective_category`).

---

## 4. Invariants the validator enforces (rule ids)

| Rule | Meaning |
|---|---|
| `H1` | every session scheduled exactly once; known session id, day, room |
| `H2` | no faculty double-booking |
| `H3` | no student-group double-booking (basket slots keyed so options don't clash) |
| `H4` | no room double-booking (timetable and exams) |
| `H5` | room capacity ≥ size; exams: Σ(half capacity) ≥ exam size |
| `H6` | room type ∈ session `room_types` |
| `H7` | faculty unavailability respected |
| `H8` | room unavailability respected |
| `H9` | within P1–P9, no lunch crossing, labs start at P2/P6 |
| `H10` | accessible room when `needs_accessible` |
| `H11` | all sessions of a basket slot share one (day, start) |
| `H12` | faculty daily hours ≤ `max_hours_per_day` |
| `H13` | approved booking fits a window, room may host events, type/capacity/features, no clash with sessions or mandatory groups |
| `H14` | fixed-slot sessions keep their slot |
| `B1`–`B3` | booking decision shape, override legitimacy, cancelled requests not approved |
| `E1`–`E2` | every exam placed once; exam rooms usable |

Soft: `S1` avoid-preference (×2/hour), `S2` group idle gaps, `S3` >6 h/day (×3/hour),
`S4` same course twice/day (×3), `S5` room fill <40%, `S6` session in P9. Exam soft: 5 per extra
same-day exam. Booking score: category weight × 1.0 approved / × 0.5 alternative, plus priority
inversions reported. Full contract: `docs/validator-contract.md`.

---

## 5. Mapping to the app's internal model

| Official | Internal (`src/lib/store.ts`, demo) | Action for the official pipeline |
|---|---|---|
| `MON…FRI` | `Mon…Fri` | normalise day codes |
| room `type` enum (10 values) | `lecture/lab/seminar/auditorium` | adopt official enum |
| `session.groups[]` | single `groupId` | adopt multi-group sessions |
| `room_types[]` | single `room.type` | adopt allowed-types list |
| `basket_slot`, `fixed_slot`, `needs_accessible` | not modelled | add |
| `max_hours_per_day`, faculty `unavailable`, `preferences` | `dailyLimit`, none | add |
| `booking_requests` windows/role/category/needs | 1–3 priority + day/period | adapt to categories + windows |
| `cancellations` | booking `status: "cancelled"` | keep both |
| `exams` | not modelled | add in Phase 2 |

The official dataset is stored separately (`cit-scheduler:dataset`) and validated by
`src/lib/dataset.ts`. The demo `AppData` remains a placeholder for the current screens until the
scheduler is wired to the official model (Phase 2).
