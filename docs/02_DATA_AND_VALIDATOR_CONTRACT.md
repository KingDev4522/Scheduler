# Dataset, Import, Export and Validator PRD

## Known inputs (PS §5)
`cit_public.json`: rooms (capacity/type/features/accessibility), maintenance windows, faculty (unavailability/preferences/daily limit), student groups, courses, sessions, Spectra requests with original text and cancellations, midsems. CSV mirrors. `validator.py` checks hard violations, soft penalty, booking score, moved count. Starter README defines field meanings and exact `schedule.json` schema. `sample_disruption.json` provides change example.

## Dataset counts
27 rooms including 7 labs; 40 faculty; 14 groups; 62 courses; 189 sessions / 243 weekly hours; 25 booking requests (one later cancelled); 41 midsem exams. Verify counts at import, report mismatches rather than silently discarding records.

## Import pipeline (DESIGN)
1. Read JSON/CSV without mutating originals; compute source hash and import timestamp.
2. Validate syntax and required entity IDs, references, types, durations, unique IDs and periods using **actual** starter schema.
3. Build normalized in-memory entities; preserve original IDs, original booking text, cancellation state and unknown fields needed for export.
4. Validate referential integrity (faculty, group, room, course, elective basket).
5. Produce import summary with warnings and fatal errors; block solving on fatal errors.
6. Keep original source and parsed version for traceability.

## Internal entity candidates (DESIGN; field names VERIFY)
Room(id,capacity,type,features,accessible,maintenance); Faculty(id,daily_limit,unavailable,avoid); Group(id,size); Course(id); Session(id,faculty_ids,group_ids,duration,room_requirements,fixed_slot,elective_basket); Exam(id,groups,duration,requirements); Booking(id,requester,category,venue,day,start,duration,mandatory_groups,status,reason); Disruption(id,type,target,window/payload); Assignment(session_id,day,start_period,room_id); Approval(id,requester_id,approver_id,proposal_id,status).

## Export contract
- Serialize **exactly** as starter README sample requires; avoid adding fields to official export if validator rejects them.
- Write `exports/schedule.json` from current initial generated result.
- Write `exports/schedule_after.json` from a genuinely applied `sample_disruption.json`.
- Include exams and booking decisions as specified by official schema.
- Validate exported JSON by reloading it and invoking unmodified official validator.

## Validator integration
Run validator as a separate test command/process using its documented interface; capture exit code, machine-readable output if available, stdout/stderr and metrics. Keep own runtime validation independent and ensure equivalence through differential tests. Do not infer unspecified penalty/booking-score formulas.

## Acceptance tests
- Import official dataset with expected entity counts and no broken references.
- Invalid JSON, duplicate IDs, unknown references, impossible capacity and bad periods yield actionable errors.
- Roundtrip export/reimport preserves every required ID and assignment.
- Official validator runs on both exports and judge-generated schedules; zero hard violations target.
- Cancelled booking is handled according to actual dataset semantics (VERIFY).


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
