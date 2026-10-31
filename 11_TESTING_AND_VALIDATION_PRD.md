# Testing, Quality Gates and Official Validation PRD

## Testing pyramid
Unit: time arithmetic, lunch, duration, room eligibility, faculty/group occupancy, electives, capacity, permissions, priorities, export serialization. Integration: import->solve->validate->export, bookings->approval->commit, disruption->preview->approve->export. E2E: four-role demo flows on deployed site. Differential: compare own checker with unmodified official `validator.py`.

## Hard-constraint test matrix
H01 missing/duplicate session; H02 faculty double booking; H03 group overlap/combined/elective exception; H04 room double booking; H05 insufficient capacity; H06 wrong lab type; H07 unavailable faculty; H08 room maintenance; H09 lunch-crossing/3-hour lab invalid start; H10 inaccessible room; H11 elective basket misalignment; H12 faculty >4 daily hours; H13 booking overlaps room/mandatory group; H14 moved fixed slot. Each test needs one valid control and one intentionally invalid fixture.

## Additional tests
- Exams: 41 represented; half-capacity, odd capacity semantics VERIFY.
- Booking: 25 inputs, cancellation, priority ties VERIFY, reason/alternatives, class displacement.
- AI: ambiguous/conditional/Hinglish/prompt injection, invalid structured output, outage fallback.
- Rescheduling: faculty leave, room closure, added session, no-fix, timeout, stale approval, minimum moved.
- Security: self-approval, cross-department access, forged role, repeated approval, unauthorized reset.
- Deployment: mobile widths, cold start, DB persistence, fresh account logins, reset and export.

## Release gates
G1 import passes schema/count/reference checks. G2 baseline schedule official hard violations = 0. G3 exams and bookings validator compatible. G4 sample disruption applied with 0 hard violations and clear diff. G5 four demo accounts, reset, manual form during AI outage. G6 exports from app; no hardcoded output. G7 deployed live and video shows real workflows. G8 docs, repo timing, AI declarations and deadline freeze verified.

## Metrics
Track hard violations, soft penalty, booking score, moved sessions, solve duration, success/timeout rate, API errors and task completion. Never claim solver optimality without proof/status.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
