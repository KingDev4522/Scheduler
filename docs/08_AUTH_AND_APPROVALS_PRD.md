# Authentication, Authorization and Approval PRD

## Official roles (PS §4)
Admin: all, generates timetable, approves changes/class-displacing bookings, changes priority. Coordinator: department session changes/events, approves own department lab bookings. Faculty: own timetable/unavailability/extra or moved sessions. Club rep: submit/cancel bookings and see status/reason. Nobody may approve their own request.

## Proposed access model
Role claims come from authenticated server-side identity, not user-submitted payload. Department/resource ownership verified server-side. Use explicit permission functions, deny by default, log denied attempts. Admin demo account must expose data reset action; reset restores seed state, not fabricated generated outputs.

## Approval matrix
- Timetable changes: Admin approval (PS).
- Bookings moving classes: Admin approval (PS).
- Department lab booking: coordinator of that department (PS), except self-approval.
- Other bookings: exact approval routing VERIFY against starter README/organizer clarification; implement configurable policy rather than guessing.

## Approval invariants
Requester ID != approver ID; approval requires current authorized role; approval is single-use; proposal and schedule versions match; backend revalidates hard constraints and priority immediately before commit; audit who/when/what/why.

## Demo accounts
Provide working, isolated seeded accounts for all four roles; document credentials in README as organizer requires. Keep credentials distinct from production secrets and rate-limit login. Test all roles on deployed site.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
