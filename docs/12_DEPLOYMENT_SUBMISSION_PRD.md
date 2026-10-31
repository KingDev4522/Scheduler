# Deployment, Submission and Compliance PRD

## Mandatory artifacts (PS §7)
Public GitHub repo with `README.md` (description, architecture diagram, tech stack, setup, demo accounts, limitations), `.env.example` (all variables, no secrets), `AI_USAGE.md`, `THIRD_PARTY.md`, `exports/schedule.json`, `exports/schedule_after.json`. Live deployed app accessible until results announced. Four working demo role accounts and Admin reset. Video <=5 minutes via unlisted YouTube or viewable Drive link.

## Video script (target ~4:30; DESIGN)
0:00 login/dashboard; 0:30 Admin generates and validates timetable; 1:15 student/faculty/room views; 1:40 English/Hinglish draft->edit->submit; 2:15 conflict blocked with reason; 2:45 Spectra booking decisions and cancellation; 3:15 disruption->diff->Admin approval; 4:00 exams, exports, utilisation; 4:25 wrap. Verify actual duration and include all PS-required actions.

## Deployment plan (DESIGN)
Use a stable frontend/backend/database hosting arrangement with persistent storage and worker-compatible CPU/memory. Run solver with job timeouts and status polling; ensure CORS, HTTPS, env configuration, migration and health checks. Do not rely on LLM service for core scheduling. Test clean redeploy and real live domain.

## Disqualification prevention (PS §9)
- Repo created **after** hackathon start, public and never inaccessible.
- App working when judged; all demo credentials in README and functional.
- Working-site video present.
- No old code, bought templates, other-team copying, or non-team code authors (official mentors/declared AI excepted).
- No commits or deployed app modifications after deadline.
- No hand-edited/hardcoded exported results or fake demo data/results.
- No tampering with official validator, organizer files, or other teams.

## Final pre-submit audit
Run official validator on both exports; test fresh deployment from README; open live link in incognito; login each role; reset seed data; AI offline manual booking; apply sample disruption; re-export; check secrets not in git; verify declarations; check video sharing; record final commit and deployment version; submit before cutoff and freeze.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
