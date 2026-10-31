# Phase 4 — AI Integration, Authentication & Complete Frontend

## 1. Purpose

Deliver the user-facing application for all four roles and integrate natural-language capabilities without allowing AI to determine scheduling validity.

**Phase outcome:** Users can operate the system through role-appropriate screens, use AI-assisted requests, review extracted details and complete manual workflows.

## 2. Official requirements

The platform must:
- Parse venue requests written in plain English or Hinglish.
- Convert them into structured bookings.
- Let the user check and edit before submission.
- Provide an AI assistant for faculty schedule-change requests.
- Produce an alternative proposal or explain unavailability.
- Validate every AI-generated schedule proposal using underlying code before application.
- Explain decisions when asked.
- Support four roles and their defined permissions.
- Continue to support manual booking if the LLM API fails.

Judges will test vague timings, conditions, priority abuse, Hinglish and attempts to bypass rules.

## 3. AI architecture

Keep AI as an interpretation and explanation layer.

Suggested flow:

```text
User message
   |
   v
LLM request parser
   |
   v
Schema-validated structured proposal
   |
   v
Clarification if information is missing/ambiguous
   |
   v
User reviews and edits
   |
   v
Deterministic backend validation / solver
   |
   v
Approval workflow
   |
   v
Database update after required approval
```

### Allowed AI responsibilities
- Extract venue, date, time, duration and purpose.
- Interpret English and Hinglish.
- Detect missing or ambiguous information.
- Ask follow-up questions.
- Convert faculty intent into a structured change request.
- Explain deterministic validation results in plain language.

### Prohibited AI responsibilities
- Decide whether a schedule is valid.
- Override hard constraints.
- Decide priority independently.
- Approve its own proposal.
- Directly write authoritative schedule or booking records.
- Fabricate availability or conflict explanations.

## 4. Structured output

Define Pydantic schemas for AI output. Validate:
- Required fields.
- Types and formats.
- Allowed enum values.
- Time ordering.
- Date resolution.
- Unknown or unsupported fields.

A schema-valid response is not necessarily a valid booking. It must still pass backend business rules and solver validation.

If date/time cannot be resolved safely, ask a follow-up instead of guessing. Use the application’s explicit timezone and date context.

## 5. AI provider resilience

- Keep provider calls behind an adapter interface.
- Store API keys only in server-side environment secrets.
- Set timeouts and handle rate limits.
- Handle malformed output.
- Log safe diagnostic metadata without exposing sensitive prompt content unnecessarily.
- Offer manual booking form independently of AI.
- Do not make core timetable viewing or booking validation depend on the LLM.

The problem statement requires the manual booking form to work when the LLM API fails or runs out of credits.

## 6. Authentication and roles

Implement four demo roles:
1. Admin
2. Department Coordinator
3. Faculty
4. Club Representative

Use secure password hashing and server-side role checks. JWT is a possible implementation, not a mandated technology.

Permission checks must happen on every protected backend action. Hiding UI controls is not authorization.

Enforce no self-approval in the service layer and database workflow.

## 7. Frontend information architecture

### Shared application shell
- Login
- Role-aware navigation
- User identity and role
- Notifications/status
- Loading/error handling

### Admin screens
- Overview dashboard
- Dataset import
- Generate timetable
- Timetable views
- Exam schedule
- Booking decisions
- Pending approvals
- Rescheduling proposal and diff
- Priority configuration
- Room utilization
- Demo data reset

### Department Coordinator screens
- Department timetable
- Department event requests
- Department lab booking approvals
- Department session change requests

### Faculty screens
- Personal timetable
- Mark unavailability
- Request extra/moved session
- AI scheduling assistant
- Proposal status and explanation

### Club Representative screens
- Natural-language booking input
- Editable structured booking form
- Submit/cancel request
- Booking history/status
- Decision reason

## 8. Timetable visualization

Provide views by:
- Student group
- Faculty
- Room

Display day, period/time, course/session, room and relevant status. Support multi-period sessions clearly.

Do not rely on color alone to communicate status. Provide labels and accessible contrast.

## 9. Dashboard and usability

Show:
- Pending approvals
- Current conflicts
- Room utilization
- Timetable access
- Booking statuses

Ensure a judge unfamiliar with the app can find a room, read a timetable and approve a change using only the README and demo accounts.

## 10. UI quality requirements

- Consistent design tokens and spacing.
- Responsive laptop and mobile layouts.
- Clear navigation.
- Search/filter where useful.
- Loading states.
- Empty states.
- Error states with actionable messages.
- Confirmation for destructive actions.
- Accessible labels and keyboard behavior.
- Clear distinction between draft, proposed, approved and published data.

## 11. Frontend/backend contract

- Use typed API responses.
- Handle authentication expiry.
- Display job progress for long solver tasks.
- Refresh relevant views after approved changes.
- Avoid optimistic UI for actions that require authoritative validation.
- Show validation errors from backend in understandable language.

## 12. Acceptance criteria

- [ ] All four roles can log in.
- [ ] Backend enforces permissions.
- [ ] No self-approval possible.
- [ ] Faculty can view own timetable and mark unavailability.
- [ ] Club representative can submit/cancel and view reasons.
- [ ] Department Coordinator workflows are implemented.
- [ ] Admin can access required administration functions and reset demo data.
- [ ] English and Hinglish requests produce editable structured fields.
- [ ] Ambiguous requests trigger clarification.
- [ ] AI proposals are validated by deterministic code.
- [ ] Manual booking works with AI provider disabled.
- [ ] Timetables display by group, faculty and room.
- [ ] Dashboard displays pending approvals, conflicts and room utilization.
- [ ] UI has loading, empty and error states.
- [ ] Laptop and phone layouts are usable.

## 13. Phase exit gate

All four roles can complete their required workflows through the frontend, and AI failure cannot disable manual booking or weaken validation.
