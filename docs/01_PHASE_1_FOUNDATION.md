# Phase 1 — Foundation, Research & Project Setup

## 1. Purpose

Establish a reproducible development environment, understand the official starter pack and create the technical foundation for the CIT Campus Scheduling and Venue Management application.

**Phase outcome:** The project boots locally, imports the official dataset into a understood domain model, and has documented API, database and solver boundaries.

## 2. Official requirements this phase prepares for

The problem statement says the starter pack contains:
- `cit_public.json`
- Equivalent CSV files
- `validator.py`
- A README explaining fields and export format
- `sample_disruption.json`
- Sample English and Hinglish booking requests

It also states that every session already has its faculty and student groups assigned. The application assigns day, start period and room.

The dataset counts are 27 rooms, 40 faculty, 14 student groups, 62 courses, 189 sessions, 243 weekly teaching hours, 25 Spectra booking requests (one later cancelled) and 41 midsem exams.

## 3. Scope

### In scope
- Starter-pack inventory and inspection.
- Requirements and data dictionary.
- Validator and export contract investigation.
- Architecture and repository setup.
- Local development environment.
- Database design based on verified source fields.
- Dataset import and validation.
- Initial backend and frontend skeleton.
- Team conventions and decision log.

### Out of scope
- Final scheduling algorithm.
- Final booking decision engine.
- AI-powered request processing.
- Production deployment.
These are handled in later phases.

## 4. Workstream A — Starter-pack investigation

### Tasks
1. Confirm all starter-pack files are present and readable.
2. Read the starter README completely.
3. Inspect `cit_public.json` structure and record every top-level collection and field.
4. Compare JSON and CSV data for consistency.
5. Inspect `validator.py`:
   - command-line interface and input arguments
   - expected JSON schema
   - hard-constraint checks
   - soft-penalty calculation
   - booking score calculation
   - moved-session calculation
   - examination validation behavior
6. Inspect `sample_disruption.json` and document its exact semantics.
7. Review sample booking requests and identify ambiguity patterns.
8. Record all uncertainties in `14_OPEN_QUESTIONS_AND_DECISIONS.md` or the team decision log.

### Required outputs
- `docs/data-dictionary.md`
- `docs/validator-contract.md`
- `docs/disruption-contract.md`
- `docs/booking-examples.md`
- A verified starter-pack inventory.

**Rule:** Do not infer field names, enum values, penalty weights or export keys. Copy them from the supplied source and cite the file/field in the internal documentation.

## 5. Workstream B — Architecture and repository

### Proposed architecture
Use a modular monolith:
- React frontend.
- FastAPI backend.
- PostgreSQL system of record.
- OR-Tools solver module.
- Celery worker for long-running jobs, with Redis as broker.
- AI provider adapter isolated from scheduling validity logic.

Avoid microservices unless a demonstrated technical need arises.

### Repository proposal

```text
cit-campus-management/
├── frontend/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── scheduling/
│   │   ├── examinations/
│   │   ├── bookings/
│   │   ├── rescheduling/
│   │   ├── ai/
│   │   ├── validation/
│   │   └── workers/
│   ├── migrations/
│   └── tests/
├── data/
├── docs/
├── exports/
├── scripts/
├── docker-compose.yml
├── .env.example
├── AI_USAGE.md
├── THIRD_PARTY.md
└── README.md
```

The exact module layout may be adjusted, but responsibilities must remain separated.

### Repository rules
- Create the GitHub repository after the hackathon starts.
- Use meaningful commits and feature branches.
- Do not reuse prohibited pre-hackathon project code or bought templates.
- Keep secrets out of Git.
- Maintain `.env.example` with variable names and safe placeholders only.
- Declare every AI tool/model and third-party library actually used.

## 6. Workstream C — Local environment

### Backend
- Python environment with pinned dependencies.
- FastAPI application with health endpoint.
- Pydantic settings loaded from environment.
- SQLAlchemy connection.
- Alembic migrations.
- Pytest configured.

### Frontend
- React + TypeScript + Vite.
- Tailwind CSS and component library.
- Router and shared layout.
- API client with configurable backend URL.
- Type checking and linting.

### Infrastructure
- PostgreSQL local service.
- Redis local service if Celery is adopted.
- Docker Compose for repeatable startup.
- Health checks for services.

Pin versions after compatibility testing; do not blindly use floating latest versions during the hackathon.

## 7. Workstream D — Domain model and data import

Create an internal data model from the official fields. Expected conceptual entities include:
- Room
- Faculty
- Student group
- Course
- Teaching session
- Exam
- Booking request
- Availability/unavailability
- Schedule assignment
- Disruption
- User and role
- Approval
- Audit event

These are conceptual entities; actual fields and relationships must follow the starter pack.

### Import requirements
- Validate required fields and types.
- Preserve source identifiers.
- Detect duplicate identifiers.
- Check foreign-key references.
- Report malformed rows with actionable errors.
- Make imports repeatable and safe.
- Keep original source files unchanged.
- Record dataset version/hash for reproducibility.

## 8. API and interface contracts

Before parallel development, agree on:
- API naming/versioning convention.
- Error response shape.
- Pagination conventions.
- Time/date representation and timezone policy.
- IDs and enum representation.
- Job status contract for long-running tasks.
- Frontend TypeScript types generated or maintained from API schemas.

Do not finalize schedule export DTOs until the official README and validator have been inspected.

## 9. Acceptance criteria

Phase 1 is complete when:
- [ ] All starter-pack files are inventoried.
- [ ] Data dictionary is complete for fields used by the app.
- [ ] Validator invocation and expected input/output are documented.
- [ ] Disruption file semantics are documented.
- [ ] Official export schema is documented from source.
- [ ] Repository is created after hackathon start.
- [ ] Frontend starts locally.
- [ ] Backend starts locally.
- [ ] Database starts and migrations run.
- [ ] Dataset import succeeds and produces a clear summary.
- [ ] Invalid input produces useful errors.
- [ ] `.env.example` exists and contains no secrets.
- [ ] Team architecture and API contracts are documented.

## 10. Risks and controls

| Risk | Control |
|---|---|
| Misreading a dataset field | Verify against starter README and validator |
| Designing database before understanding source | Complete data dictionary first |
| Different team members invent different API shapes | Agree contracts before parallel work |
| Secrets committed to Git | Environment variables and secret scanning |
| Unrepeatable local setup | Docker Compose and setup instructions |
| Reusing prohibited prior code | Build in the new repository and maintain honest commit history |

## 11. Phase exit gate

Do not begin full solver implementation until the team can explain the dataset, official validator contract, time model, session representation, export format and disruption input format.
