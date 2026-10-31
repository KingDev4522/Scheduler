# Implementation Roadmap and Work Breakdown

## Workstream A — Foundation
A1 fresh public repo after start, AI/third-party log. A2 inspect starter schema and official validator. A3 typed domain model/import. A4 export adapter. A5 CI lint/unit tests. **Exit:** dataset parses, sample export validates structurally.

## Workstream B — Core scheduling
B1 period/calendar model. B2 room eligibility and occupancy. B3 faculty/group/elective/fixed constraints. B4 CP-SAT feasible solve. B5 independent validator. B6 soft objective and score telemetry. **Exit:** 189 sessions, zero official hard violations.

## Workstream C — Exams and booking
C1 exam model/solver, effective half capacity. C2 Spectra request ingestion and cancellation. C3 priority engine, alternatives, explanations. C4 manual form and approvals. **Exit:** official export covers exams and booking decisions.

## Workstream D — Changes and AI
D1 disruption importer and repair solver. D2 moved-count objective and diff. D3 Admin approval/versioning. D4 LLM extraction and clarification. D5 faculty assistant and offline fallback. **Exit:** sample and unseen disruption workflows; AI adversarial tests.

## Workstream E — Product and delivery
E1 role login and permissions. E2 timetable grids and room finder. E3 dashboard, approvals and utilisation. E4 deployment and demo reset. E5 docs, exports, official validation, video. **Exit:** live, judge-testable app and compliant submission.

## Parallelization guidance
Backend/solver owner: A2/B/C/D. Frontend owner: E2/E3 with typed API fixtures. Integration owner: A3/A4/E1/E4. QA/docs owner: official validator, AI declarations, E5. Adapt to actual team size. Prioritize shared contracts before parallel code.

## Suggested build sequence
Milestone 0: inspect starter pack and confirm repo compliance. Milestone 1: generated timetable and validator. Milestone 2: exams/bookings. Milestone 3: disruptions/approvals. Milestone 4: AI and full UX. Milestone 5: production test/freeze. No invented duration commitments without hackathon end time and team size.

## Critical path
Official schema -> export -> solver correctness -> validator -> disruption -> approvals -> deployment -> video. If time becomes tight, protect this path over animations, analytics extras or additional chatbot features.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
