# Backend Architecture, API and Persistence PRD

## Proposed stack (DESIGN)
React + TypeScript frontend; Python FastAPI backend; OR-Tools CP-SAT solver; PostgreSQL database; optional Redis/background worker only if solving exceeds HTTP request budget. Stack is a recommendation, not required by PS. Use own LLM API key, manual fallback.

## Service boundaries
`imports`: starter data parsing and integrity. `solver`: initial sessions and exams. `validator`: independent hard checks and official-validator adapter. `bookings`: priority, conflicts, alternatives, cancellation. `changes`: disruption solver, diffs, approval. `assistant`: structured extraction and grounded explanations. `auth`: roles and approvals. `exports`: exact official JSON. `audit`: immutable event log.

## Suggested API contracts (DESIGN; not official)
- `POST /api/admin/imports` upload dataset; `GET /api/admin/imports/{id}` summary.
- `POST /api/schedules/generate` enqueue/execute solve; `GET /api/jobs/{id}` status.
- `GET /api/timetables?view=group|faculty|room&id=...` timetable.
- `GET /api/rooms?type=&min_capacity=&accessible=`; `GET /api/rooms/{id}/availability`.
- `POST /api/bookings/parse` untrusted AI draft; `POST /api/bookings` validated request; `POST /api/bookings/{id}/cancel`.
- `GET /api/bookings?week=spectra`; `POST /api/bookings/{id}/decision` role-gated.
- `POST /api/disruptions/preview` produce candidate; `POST /api/proposals/{id}/approve|reject` Admin only.
- `POST /api/faculty/assistant` extract faculty change; `GET /api/approvals` inbox.
- `GET /api/admin/exports/schedule`; `GET /api/admin/exports/schedule-after`; `POST /api/admin/reset`.

## Persistence (DESIGN)
Tables: users, departments, rooms, room_blocks, faculty, faculty_blocks, groups, courses, sessions, exams, assignments, booking_requests, booking_decisions, disruptions, schedule_versions, proposals, approvals, audit_events, import_runs, solve_jobs. Preserve official IDs and raw import payload. Use DB constraints for uniqueness, foreign keys and version integrity; cross-row interval conflicts enforced by service validator and transaction isolation.

## Data consistency
Treat schedule as versioned aggregate. All booking approvals and schedule changes run transactionally with revalidation. Use idempotency keys for submission/approval and a per-schedule version guard. Export from committed database state only.

## API errors
Standard shape `{code,message,details,request_id}`; validation errors include violated constraint codes and relevant entity IDs. Never return secrets or raw LLM prompts containing user data.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
