# Frontend, Dashboard and Interaction PRD

## Navigation (DESIGN)
Global: Dashboard, Timetables, Rooms, Bookings, Changes, Exams, AI Assistant, Approvals, Admin Import/Exports, Help. Hide inaccessible actions but enforce permissions on backend.

## Required screens
1. Role-aware dashboard: summary, pending approvals, current conflicts, room utilisation, recent actions.
2. Timetable: filter by group/faculty/room; Monday–Friday grid P1–P9, lunch divider, event-only P10–P13 as applicable; duration blocks, overlap warnings, legends, accessible text.
3. Room finder: capacity/type/features/accessibility and availability by period; direct booking link.
4. Booking form: manual and AI-assisted tabs, extracted fields editable, conflict check, reason and alternatives, submission status.
5. Spectra decision board: 25 requests, cancelled state, priority, status, reason and alternatives.
6. Exams: exam timetable and filters; effective capacity details.
7. Change proposals: original vs proposed schedule, moved count, diff list, impacted entities, Admin approve/reject.
8. Faculty assistant: request input, clarifications, validated alternatives, explanation.
9. Admin import/export: file upload, data summary, generate, validator results, exports, demo reset.
10. Approvals inbox: pending, requester, conflicts, rationale, audit history.

## Interaction requirements
Readable on phone and laptop; keyboard accessible; proper focus, semantic labels, contrast; skeleton/loading, empty, error, success and offline-AI states. Never label a proposal as "approved" before server confirmation. Show solver progress and timeouts separately from infeasibility.

## Acceptance
Unfamiliar judge using README/demo accounts can find a room, read timetable, approve a change. Timetable grid stays legible at 375px viewport (stack/filter view acceptable). Every major action has visible outcome and error recovery.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
