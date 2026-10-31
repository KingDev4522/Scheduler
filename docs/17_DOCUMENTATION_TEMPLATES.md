# Required Repository Documentation Templates

## README.md skeleton
- Project name and short description.
- Architecture diagram (frontend -> API -> solver/validator -> DB; AI extraction as non-authoritative service).
- Tech stack and versions.
- Local setup: prerequisites, install, env vars, migrations, seed/import, start frontend/backend/worker, run tests/validator.
- Demo role credentials for Admin, Coordinator, Faculty, Club Rep (actual credentials only after seeded).
- Live URL, API docs URL, usage walkthrough, Admin reset, exports generation.
- Known limitations, solver timeouts, fallback behavior.

## .env.example skeleton (adapt to actual implementation)
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
APP_SECRET=REPLACE_ME
CORS_ORIGINS=http://localhost:5173
LLM_API_KEY=REPLACE_ME
LLM_MODEL=REPLACE_ME
SOLVER_TIME_LIMIT_SECONDS=60
```
Never put real keys in repository.

## AI_USAGE.md skeleton
| AI model/tool | Provider/version | In product or development | Purpose | Files/features assisted | Prompt location | Allowed decisions | Forbidden decisions |
|---|---|---|---|---|---|---|---|
| Fill each actual tool used | | | | | | Parse/clarify/explain | Schedule validity, approval, priority bypass |

## THIRD_PARTY.md skeleton
| Dependency | Version | License | Purpose | Source URL |
|---|---|---|---|---|
| Fill from actual lockfiles | | | | |

## Exports checklist
`exports/schedule.json` from app-generated original dataset schedule; `exports/schedule_after.json` from app after applying sample disruption and approval. Run official validator; record hard violations, soft penalty, booking score and moved count. Do not manually edit exports.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
