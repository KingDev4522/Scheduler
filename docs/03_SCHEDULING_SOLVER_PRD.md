# Academic Timetable Solver PRD

## Scope
Assign one (day, start period, room) to every session, with given faculty and groups (PS §2, §5). Week Monday–Friday; P1 08–09, P2 09–10, P3 10–11, P4 11–12, P5 12–13, lunch 13–14, P6 14–15, P7 15–16, P8 16–17, P9 17–18. P10–P13 18–22 event-only. Three-hour labs may only start at P2 or P6.

## Hard constraints (PS §3)
H01 each session exactly once. H02 no overlapping faculty occupancy. H03 no group overlap, with combined lectures affecting every group and same elective-basket-slot exception. H04 no room overlap. H05 room capacity >= session size. H06 compatible room type (physics lab only physics lab). H07 faculty unavailability. H08 room maintenance/unavailability. H09 no lunch-crossing, restricted 3-hour lab blocks. H10 accessible room when required. H11 same elective basket slot simultaneous. H12 faculty teaching <= daily limit (CIT 4 hours). H13 approved bookings do not overlap room or mandatory group. H14 fixed-slot sessions remain fixed.

## Soft constraints (PS §3)
S01 faculty avoid-time preference; S02 group idle period between classes (exclude lunch); S03 group >6 class hours/day; S04 same course twice same day for group; S05 <40% room fill; S06 session in P9. **Weights and exact counting: VERIFY in validator.**

## Proposed algorithm
Use Python OR-Tools CP-SAT (DESIGN, subject to team proficiency and deployment limits). For each session, enumerate feasible (day,start,room) candidate placements respecting static eligibility; boolean decision x[s,d,p,r]. Exactly-one per session; occupancy constraints for room/faculty/group across each occupied period; model elective baskets with synchronized slots and special group occupancy semantics; daily faculty limits; fixed placements; approved bookings. Use lexicographic solving: hard feasibility first, then minimize official soft penalty if reconstructable. Set deterministic seed and time budget, report FEASIBLE/OPTIMAL/INFEASIBLE/UNKNOWN distinctly.

## Validation and explanations
Implement `validate_schedule(schedule, context)->violations[]` separately from solver. Each violation: code, entity IDs, day, periods, room, user-readable reason. Do not infer "why" solely from LLM; collect candidate exclusions and binding constraints. A solver timeout is not proof of infeasibility.

## Acceptance
- Every official session assigned exactly once.
- Every H01–H14 tested individually and in combinations.
- No hard violations under official validator.
- Soft penalty recorded and improved only after correctness established.
- Solver exposes duration, objective, status, violation count and reproducibility metadata.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
