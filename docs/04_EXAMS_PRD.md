# Midsemester Examination Scheduler PRD

## PS requirement
Schedule 41 midsem examinations in the week following Spectra Week 7. All room-capacity checks for exams use half normal room capacity (PS §2–3). Exams have highest booking priority (PS §4).

## Known vs unknown
KNOWN: exam count 41, effective capacity halved, scheduling required. VERIFY: exam duration, permissible periods/days, group overlap semantics, multiroom exam allocation, invigilator data, fixed slots and precise output schema; do not invent rules.

## Functional workflow (DESIGN)
1. Import exams and applicable availability from starter data.
2. Compute effective room capacity per official rounding semantics (VERIFY).
3. Enumerate compatible exam placements and necessary rooms per schema.
4. Avoid room/group/faculty conflicts according to actual exam fields and validator.
5. Produce exam timetable and diagnostics; expose room/group views.
6. Include exam assignments in official export and run validator.

## Edge cases
Odd room capacities; oversized exam groups; accessible venue requirement; exam spanning lunch; exam room unavailable; competing exam and event; no feasible room; exam overlap across multiple student groups.

## Acceptance
All 41 exams represented, zero validator hard violations, no silent omission; report infeasibility honestly. Tests derive exact rules from starter pack.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
