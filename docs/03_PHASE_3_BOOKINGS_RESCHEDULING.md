# Phase 3 — Booking, Rescheduling & Approval Systems

## 1. Purpose

Implement venue booking management for Spectra and other events, priority-based decisions, manual scheduling, disruption handling and controlled timetable changes.

**Phase outcome:** Requests are evaluated consistently, changes are proposed with minimal disruption, and changes are applied only after authorized approval.

## 2. Official requirements

The platform must:
- Accept venue requests in plain English or Hinglish (AI parsing is integrated in Phase 4).
- Let users review and edit extracted booking details before submission.
- Approve, reject or suggest an alternative for each Spectra-week request.
- Follow priority rules and give a reason for every decision.
- Handle faculty leave, room closure and new session additions.
- Propose a fixed timetable moving as few sessions as possible.
- Show exactly what changed.
- Apply timetable changes only after Admin approval.
- Explain conflicts when no valid fix exists.
- Support manual scheduling by authorized roles while enforcing hard constraints.
- Prevent anyone from approving their own request.

There are 25 Spectra booking requests, one later cancelled.

## 3. Booking domain

Create a booking lifecycle. Suggested states:
- Draft
- Submitted
- Pending review
- Approved
- Rejected
- Alternative proposed
- Cancelled
- Expired (only if the product defines expiry)

Confirm state transitions and ownership rules with the team. Store requester, event category, venue, start/end time, purpose, status, decision reason, reviewer and timestamps.

Do not add unsupported mandatory fields; follow actual starter request schema and role requirements.

## 4. Priority policy

Official priority order:
1. Exams
2. Regular classes
3. Institute events (Spectra main events, convocation)
4. Guest lectures
5. Department events
6. Club events

Admin can change the priority order.

Implement priority as configurable policy data, not scattered hardcoded conditionals.

Important:
- Priority does not override physical feasibility or hard constraints.
- A higher-priority request does not make an unavailable room usable.
- Tie-breaking behavior is not specified in the problem statement; inspect starter data/README or document an explicit, auditable engineering policy.
- Preserve request history if Admin changes priority configuration.

## 5. Booking validation

Before a booking can be approved, deterministic backend logic must check:
- Room exists and is eligible.
- Requested time is valid.
- Room is available.
- No overlap with another approved booking in the same room.
- No overlap with teaching sessions in the same room.
- No mandatory student-group clash.
- Room capacity and type requirements where relevant to the request.
- Requester's role and approval authority.
- Priority conflicts.
- The approver is not the requester.

The exact event-specific capacity/type rules should be based on the request data and official validator.

## 6. Decision engine

For each submitted request, return one of:
- Approve
- Reject
- Suggest alternative

Every decision must include a reason grounded in actual checks.

Suggested structured decision:
- decision
- request identifier
- selected venue/time if applicable
- reason code(s)
- human-readable explanation
- conflicting resource/event identifiers where safe to expose
- policy version used

The reason generator may phrase deterministic facts, but must not invent conflicts.

## 7. Alternative suggestions

Generate alternatives by searching candidate venues and time windows that satisfy all relevant hard constraints.

Rank alternatives using transparent criteria such as:
- Exact requested venue preference where possible.
- Minimal time displacement.
- Suitable room type/features.
- Sufficient capacity.
- Availability.
- Priority compatibility.

These are proposed ranking criteria. Confirm with the team and official validator; do not represent them as organizer-defined weights.

## 8. Rescheduling

### Trigger types
- Faculty becomes unavailable.
- Room is closed or under maintenance.
- New session is added.

### Required workflow
1. Receive disruption input.
2. Validate disruption schema.
3. Load current published schedule.
4. Identify directly affected assignments.
5. Lock unaffected/fixed assignments where required.
6. Build a revised optimization model.
7. Preserve as many original assignments as possible.
8. Enforce every hard constraint.
9. Validate proposed schedule.
10. Produce a diff showing old and new day/period/room.
11. Explain why moved sessions were affected.
12. Submit proposal for Admin review.
13. Apply only after Admin approval.
14. Record version, approver and audit history.

### Objective
Minimize the number of sessions moved, consistent with the official validator's definition of a moved session. Verify whether the validator counts changes in day, period, room or any assignment field.

### No-feasible-solution behavior
- Do not alter the published schedule.
- Return infeasible status.
- Show known conflicting constraints/resources.
- Avoid fabricated explanations.
- Provide diagnostic details from the model/validation process.

## 9. Approval and role policy

Official roles:
- Admin: everything; generates timetable; approves timetable changes and bookings that move a class; can change priority order.
- Department Coordinator: requests changes to department sessions; books rooms for department events; approves bookings of their department's labs.
- Faculty: views own timetable; marks unavailability; requests extra or moved sessions.
- Club Representative: submits/cancels venue requests; sees status and reason.

The problem statement says nobody can approve their own request.

Implement server-side authorization for every action. The exact authority for any unlisted approval case must be clarified rather than assumed.

## 10. Manual scheduling

Manual assignment is a user interface for proposing a slot/room, not a bypass.

Every manual change must:
- Check authorization.
- Run the same deterministic hard-constraint validation.
- Check current version to prevent stale updates.
- Require approval where the role/workflow requires it.
- Write an audit event.

## 11. Concurrency and data integrity

Prevent two simultaneous approvals from reserving the same room/time.

Use database transactions and appropriate locking or exclusion/uniqueness strategies based on the final time representation. Revalidate inside the approval transaction; do not rely only on a previous UI availability check.

Use schedule versioning so a proposal based on an outdated timetable cannot overwrite a newer published version.

## 12. Acceptance criteria

- [ ] All starter booking requests can be loaded.
- [ ] Cancelled request is handled correctly.
- [ ] Six priority categories are represented in the official order.
- [ ] Admin can change priority order.
- [ ] Booking validation blocks hard conflicts.
- [ ] Every approve/reject/alternative decision has a reason.
- [ ] Alternatives are actually validated.
- [ ] No self-approval is possible.
- [ ] Role permissions are enforced by backend.
- [ ] Disruption file is processed according to its actual schema.
- [ ] Rescheduling minimizes moved sessions according to validator semantics.
- [ ] Before/after diff is visible.
- [ ] No change is applied before Admin approval.
- [ ] Infeasible cases preserve the published schedule.
- [ ] Manual scheduling cannot bypass hard constraints.
- [ ] Booking and rescheduling results pass official validation.

## 13. Phase exit gate

The application can process Spectra requests, make explainable decisions, process the sample disruption, show a validated minimal-change proposal and apply it only after authorized Admin approval.
