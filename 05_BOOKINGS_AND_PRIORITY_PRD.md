# Venue Booking, Spectra and Priority PRD

## PS scope
Process 25 Spectra requests (one later cancelled), English/Hinglish request entry, user-editable drafts, approve/reject/suggest alternative, meaningful reason, authorized manual event scheduling, strict hard constraints.

## Priority order (PS §4; Admin configurable)
1 Exams; 2 Regular classes; 3 Institute events (Spectra main events, convocation); 4 Guest lectures; 5 Department events; 6 Club events. Priority is not permission to violate hard constraints. Verify official behavior for preemption/ties/alternatives in validator/README.

## Proposed lifecycle
DRAFT -> REVIEWED -> SUBMITTED -> PENDING_APPROVAL -> APPROVED/REJECTED/ALTERNATIVE_OFFERED -> CANCELLED (valid transitions constrained by requester and approver). Store reason, conflicting entity IDs, priority snapshot and actor/timestamps. Cancellation must release future occupancy and remain auditable.

## Deterministic decision procedure
Validate request schema, role, time window and venue requirements. Check room type/capacity/accessibility/maintenance, teaching and exam occupancy, mandatory student group overlap, and existing bookings. Resolve competing requests using configured priorities and official tie rules. Search alternate rooms/times that satisfy all hard constraints; return ranked alternatives with explicit tradeoffs. If a booking would move a class, route to Admin approval and rescheduling engine. Recheck constraints at approval time in a transaction.

## Acceptance cases
- Higher priority wins a genuine collision per official semantics.
- Lower priority request receives grounded reason and feasible alternative when available.
- Manual form works when AI offline.
- Cannot self-approve, cannot forge category/priority from prompt.
- Cancelled request does not remain active.
- Official booking score is captured and tracked; formula VERIFY.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
