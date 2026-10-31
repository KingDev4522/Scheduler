# Open Questions, Assumptions and Decision Log

## Blocking: starter pack not yet supplied
Q01 Exact input JSON and CSV field names/types/IDs? Q02 Exact `schedule.json` output structure and example? Q03 Official validator invocation and hard violation definitions? Q04 Exact soft penalty weights and counting? Q05 Booking score and tie-break rules? Q06 How are exams assigned (rooms, durations, group overlap, invigilators, dates)? Q07 How is odd exam room capacity rounded? Q08 What does "session moved" mean (room-only move counted?)? Q09 How are cancelled requests represented? Q10 Disruption schema, allowed change types and conflicts? Q11 What is event period policy outside P10–P13? Q12 How are elective baskets and combined sessions encoded? Q13 Which events require approvals besides class-moving and department-lab requests? Q14 Can institute events displace existing regular classes, and how does approval work? Q15 Does validator require ordering of bookings/decisions?

## Operational questions for organizers/team
Q16 Hackathon start/end and submission freeze timestamps? Q17 Team size and skills? Q18 Available deployment budget and compute? Q19 AI API provider/credits and privacy constraints? Q20 Expected simultaneous users and solve latency? Q21 Are multiple exam rooms permitted per exam? Q22 Are admin-configured priorities evaluated by validator? Q23 Are there specific date/time zones for relative-language requests?

## Decision record template
`DEC-### | Date | Question | Decision | Source (PS / README / validator / organizer / design) | Alternatives | Owner | Status | Impact`.

## Working assumptions (DESIGN, revise after starter pack)
Use Python/OR-Tools/FastAPI, React/TypeScript, PostgreSQL. Schedule versioning and transactional approvals. Explicitly avoid treating these as organizer-required.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
