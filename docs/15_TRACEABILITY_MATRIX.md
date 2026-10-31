# Requirement Traceability Matrix

| PS section / requirement | Implementation document | Verification |
|---|---|---|
| §2.1 Weekly timetable | 03 | All 189 sessions once, official validator |
| §2.2 Midsems | 04 | All 41 exams, half-capacity |
| §2.3 NL/Hinglish booking | 07,05 | Editable structured draft and backend checks |
| §2.4 Spectra decisions | 05 | 25 requests, cancellation, reasons, booking score |
| §2.5 Last-minute changes | 06 | Sample/unseen disruption, minimal moved, approval |
| §2.6 Views/dashboard | 09 | Group/faculty/room, approvals/conflicts/utilisation |
| §2.7 Faculty AI | 07,06 | Validated alternative or unavailability |
| §2.8 Explainability | 03,05,07 | Fact-based reasons |
| §2.9 Import/export | 02,10 | Official format and `schedule.json` |
| §2.10 Manual scheduling | 05,08 | Role-gated, hard validation |
| §3 Hard constraints H01–H14 | 03,11 | Positive/negative tests each |
| §3 Soft constraints S01–S06 | 03,11 | Validator penalty |
| §4 Four roles/no self-approval | 08 | RBAC and approval tests |
| §4 Priority hierarchy | 05 | Collision tests |
| §5 Dataset/starter pack | 02 | Counts, import, checker |
| §6 AI declaration and guardrails | 07,12,17 | AI_USAGE.md; manual fallback |
| §6 Third-party and fresh repo | 12,17 | THIRD_PARTY.md; commit audit |
| §7 Repo, deployment, accounts, video | 12 | Pre-submit audit |
| §8 100-point judging | 11,13 | Score and UX tests |
| §9 Disqualification | 12 | Compliance checklist |


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
