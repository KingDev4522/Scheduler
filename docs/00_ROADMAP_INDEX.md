# CIT Campus Scheduling & Venue Management
## Five-Phase Development Documentation

**Purpose:** This folder is the execution guide for building the hackathon submission from an empty repository to a deployed, judge-ready application.

**Source of truth:** The six-page CIT problem statement supplied by the organizers. Where a detail is not specified in that statement, this documentation marks it as an engineering proposal or an item requiring verification against the starter pack and `validator.py`.

## Recommended technology baseline

| Area | Recommended technology | Responsibility |
|---|---|---|
| Frontend | React, TypeScript, Vite | User interface |
| UI | Tailwind CSS, shadcn/ui, Lucide | Styling and components |
| API/backend | Python, FastAPI, Pydantic | Application and API logic |
| Database | PostgreSQL, SQLAlchemy, Alembic | Persistent system of record |
| Solver | Google OR-Tools CP-SAT | Constraint-based scheduling and optimization |
| Background jobs | Celery + Redis | Long-running solver jobs |
| AI | Provider-adapter around an LLM API | Natural-language parsing and explanations |
| Testing | Pytest, HTTPX, Vitest, Playwright | Unit, API and end-to-end testing |
| Packaging | Docker, Docker Compose | Reproducible local environment |
| Hosting proposal | Vercel + Render + managed PostgreSQL/Redis | Deployment |

These are recommendations, not organizer-mandated technologies. Verify hosting plan limits, solver runtime and starter-pack compatibility before finalizing.

## Five phases

1. **Foundation, research and project setup** — understand the dataset, validator and rules; initialize repository, environment and database.
2. **Core scheduling and optimization engine** — generate the weekly timetable and midsem schedule while satisfying hard constraints and minimizing soft penalties.
3. **Booking, rescheduling and approvals** — manage venue requests, priority rules, disruptions, alternatives and approval workflows.
4. **AI integration, authentication and frontend** — add natural-language workflows, four role-based experiences and dashboards.
5. **Integration, testing, deployment and submission** — verify with the official validator, deploy, document and prepare the required video.

## How to use these documents

- Read this index first.
- Execute phases in order, while allowing UI scaffolding and backend work to overlap when interfaces are agreed.
- Do not mark a phase complete until its exit criteria pass.
- Keep a decision log for unresolved details.
- Do not invent the official JSON schema, validator scoring weights or disruption semantics. Inspect the supplied starter pack.
- The official validator is the authority for schedule correctness and scoring.

## Global non-negotiable requirements from the problem statement

- Every teaching session is scheduled exactly once.
- All hard constraints must be respected.
- The LLM must not decide schedule or booking validity.
- Every LLM-generated proposal must be validated by deterministic code before data changes.
- Manual booking must work if the LLM API is unavailable.
- No user can approve their own request.
- Manual scheduling must obey hard constraints.
- Schedule changes require Admin approval before application.
- Required exports: `exports/schedule.json` and `exports/schedule_after.json`.
- Public GitHub repository, live deployed application, four demo accounts, Admin demo reset and a maximum five-minute working-site walkthrough are required.
- AI usage and third-party dependencies must be declared.
- Respect repository creation, team participation, deadline and no-hardcoded-results disqualification rules.

## Definition of project completion

The project is ready only when:
1. The application imports the official dataset.
2. The app generates schedules rather than displaying hand-authored results.
3. The official validator accepts the required exports with zero hard violations.
4. The app supports bookings, priority decisions, disruption rescheduling and approval.
5. AI features fail safely and manual workflows remain usable.
6. Four role accounts work on the live deployment.
7. The submission repository, exports, documentation and video satisfy the organizer checklist.
