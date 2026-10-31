# Phase 5 — Integration, Testing, Deployment & Submission

## 1. Purpose

Integrate the complete system, verify it against the official rules, deploy a stable live application and prepare every required submission artifact.

**Phase outcome:** A judge can access the public repository and live application, log in with all four demo roles, test core features and inspect genuine generated exports.

## 2. Submission requirements from the problem statement

### Public GitHub repository
Must contain:
- `README.md` with description, architecture diagram, stack, setup steps, demo accounts and known limitations.
- `.env.example` with every environment variable and no real keys.
- `AI_USAGE.md`.
- `THIRD_PARTY.md`.
- `exports/schedule.json`.
- `exports/schedule_after.json`.

### Live deployed link
Must remain available until results are announced.

### Demo accounts
All four roles must have working accounts listed in README. Admin must have a demo-data reset button.

### Video
Maximum five minutes, submitted as an unlisted YouTube link or Drive link with view access. Must show:
- Timetable generation.
- Plain-language request becoming a booking.
- Conflict being blocked.
- Spectra booking decisions.
- Rescheduling, changes and approval.
- Dashboard.

## 3. Integration test plan

Test end-to-end workflows, not just individual endpoints.

### Workflow A — Initial scheduling
1. Admin loads dataset.
2. Admin requests timetable generation.
3. Solver job runs.
4. Result is validated.
5. Valid schedule is saved.
6. Export is generated.
7. Official validator is run against export.

### Workflow B — Examination scheduling
1. Admin requests exam scheduling.
2. Exam solver uses official exam data.
3. Half-capacity rule is applied.
4. Output is validated and exported according to official contract.

### Workflow C — Natural-language booking
1. Club representative enters English or Hinglish request.
2. AI extracts structured fields.
3. User edits/confirms fields.
4. Backend validates request.
5. Request follows approval/decision workflow.
6. User sees status and reason.

### Workflow D — Conflict prevention
1. Create or load an existing reservation/session.
2. Submit overlapping request.
3. Backend rejects or proposes alternative according to rules.
4. Verify no invalid data is persisted.

### Workflow E — Spectra priority
1. Load the official 25 requests and cancellation.
2. Process requests according to official priority and constraints.
3. Verify decision and reason for every request.
4. Run official booking validator.

### Workflow F — Disruption and approval
1. Load current valid schedule.
2. Apply `sample_disruption.json`.
3. Generate a minimal-movement proposal.
4. Display exact differences.
5. Verify hard constraints.
6. Confirm proposal is not applied before Admin approval.
7. Admin approves.
8. New schedule version becomes active.
9. Export `schedule_after.json`.
10. Run official validator and moved-session score.

### Workflow G — Role and security
Test every role against allowed and forbidden actions, including self-approval attempts.

## 4. Official validator strategy

The official validator is the scoring authority. Do not replace it with a home-grown approximation.

For each run:
- Record input dataset/version.
- Record application commit/version.
- Record validator command and version.
- Save full validator output as an artifact.
- Track hard violations.
- Track soft penalty.
- Track booking score.
- Track moved-session count.
- Compare against previous run.

Target zero hard violations. Optimize soft penalty and booking score only after correctness is stable.

## 5. Adversarial AI test suite

Include prompts covering:
- Vague date/time.
- Ambiguous AM/PM.
- Missing venue.
- Missing duration.
- Hinglish.
- Conditional request.
- Priority manipulation.
- Request to ignore existing classes.
- Request to use unavailable room.
- Prompt injection.
- Malformed model output.
- Provider timeout/rate limit/no credits.

Expected behavior:
- Ask clarification where required.
- Never invent availability.
- Never bypass priority or hard constraints.
- Validate all proposals deterministically.
- Preserve manual workflow during provider failure.

## 6. Reliability and concurrency

Test:
- Two users booking same room/time concurrently.
- Duplicate submission.
- Approval against stale schedule version.
- Worker crash/retry.
- Solver timeout.
- Database connection failure.
- Redis unavailable.
- LLM provider unavailable.
- Admin demo reset while other sessions are active.

Use transactions and idempotency where appropriate. Ensure a failed task does not partially publish a schedule.

## 7. Deployment checklist

### Frontend
- Production build succeeds.
- Correct API base URL configured.
- No secrets embedded in browser bundle.
- Routes work on refresh.
- Responsive layouts checked.

### Backend
- Production server starts.
- Environment variables configured.
- CORS restricted to required origins.
- Health endpoint available.
- Database migrations applied.
- Logs and error handling enabled.

### Worker and Redis
- Worker starts and connects.
- Long-running solver jobs execute.
- Job status is observable.
- Retry behavior is safe.
- Worker has sufficient CPU and memory.

### Database
- Persistent managed database.
- Backups/export strategy understood.
- Demo reset is safe and repeatable.
- Connection limits tested.

### Availability
- Verify hosting plan does not sleep or suspend in a way that makes judges unable to use the app.
- Keep deployed link live until results are announced.
- Monitor application health during judging.

## 8. Documentation requirements

### README
Include:
- Project description.
- Features.
- Architecture diagram.
- Technology stack.
- Prerequisites.
- Local setup.
- Environment configuration.
- Database migration and seed/import instructions.
- How to run frontend/backend/worker.
- Demo accounts for all four roles.
- How to reset demo data.
- How to run tests.
- How to generate exports.
- Known limitations.

### AI_USAGE.md
Declare:
- Every model/API called by product.
- Purpose of each model/API.
- AI tools used during development and what they helped with.
- Where prompts are stored.
- What the LLM is prohibited from deciding.

Failure to declare AI use costs 10 marks according to the problem statement.

### THIRD_PARTY.md
List third-party libraries, frameworks and solvers.

## 9. Video walkthrough plan (maximum five minutes)

Suggested timing:
- 0:00–0:20 — Problem and product overview.
- 0:20–1:10 — Generate timetable and show timetable view.
- 1:10–1:50 — Natural-language booking and editable extraction.
- 1:50–2:20 — Demonstrate a conflict being blocked.
- 2:20–3:00 — Spectra booking decisions and reasons.
- 3:00–4:10 — Disruption, before/after diff and Admin approval.
- 4:10–4:45 — Dashboard and role experience.
- 4:45–5:00 — Brief closing.

The video must show the working website and genuine application-generated results.

## 10. Disqualification prevention

Before submission, verify:
- Repository is public and accessible.
- Repository was created after hackathon start.
- No prohibited old project, bought template or copied team code is used.
- Live link works.
- Four demo accounts work.
- Video is submitted and shows working website.
- Exported and video results are generated by the app, not hand-edited or hardcoded.
- No commits or deployed-app changes occur after deadline.
- Only registered team members and official mentors work on the project, with declared AI tools permitted.
- No interference with other teams, accounts, deployments, validator or organizer files.

## 11. Final acceptance checklist

- [ ] Public GitHub repository accessible.
- [ ] README complete.
- [ ] `.env.example` complete and secret-free.
- [ ] `AI_USAGE.md` complete.
- [ ] `THIRD_PARTY.md` complete.
- [ ] `schedule.json` generated by application.
- [ ] `schedule_after.json` generated by application after sample disruption.
- [ ] Official validator run on required outputs.
- [ ] Zero hard constraint violations targeted and verified.
- [ ] Booking decisions and reasons checked.
- [ ] Rescheduling moved-session count recorded.
- [ ] Live deployment accessible.
- [ ] All four demo accounts tested.
- [ ] Admin reset tested.
- [ ] Manual booking tested with LLM disabled.
- [ ] Five-minute video recorded and accessible.
- [ ] Submission frozen before deadline.

## 12. Phase exit gate

The project is submission-ready only when every organizer deliverable is present, the deployed application is usable, the official validator has been run, and the demo demonstrates genuine working functionality.
