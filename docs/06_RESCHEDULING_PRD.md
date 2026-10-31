# Dynamic Rescheduling and Approval PRD

## PS scope
Handle faculty leave, room closure and new session additions; propose valid timetable moving fewest sessions; show exact diff; apply only after Admin approval; explain conflicting constraints if no fix. Judges will supply an unseen change file (PS §8).

## Workflow
1. Admin or authorized faculty/coordinator submits disruption, or Admin uploads official-format file.
2. Validate file and permission; persist change request, not committed schedule.
3. Snapshot current schedule/version and disruption context.
4. Solve repair: preserve all unchanged placements as far as possible; hard constraints mandatory.
5. Validate proposed schedule using own validator and official validator where feasible.
6. Present changed sessions: before/after day/start/room, count moved, reason, affected faculty/groups/rooms.
7. Admin approves or rejects; revalidate against latest schedule version before atomic apply.
8. Audit action and produce revised export.

## Objective (DESIGN)
Primary: zero hard violations. Secondary: minimize number of original sessions whose (day,start,room) changes; compare with official moved-session definition (VERIFY). Tertiary: soft penalty. Preserve fixed slots. New sessions do not count as "moved" unless official checker says otherwise (VERIFY).

## Infeasibility handling
Differentiate proven INFEASIBLE from timeout/UNKNOWN. Report concrete blocking constraints or minimal conflict explanation when supported by solver; never invent unsatisfiable cores. Offer safe alternatives only after validation.

## Concurrency
Use schedule version optimistic lock and transaction; stale proposals cannot overwrite newer bookings/changes. Approval must be from an authorized Admin who did not submit request.

## Acceptance
Process `sample_disruption.json` and unseen valid changes; no hard violations; no state mutation before approval; exact before/after diff; validator moved count recorded; generate `schedule_after.json` from applied result.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
