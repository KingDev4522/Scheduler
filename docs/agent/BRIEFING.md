# Agent Briefing — CIT Campus Scheduling & Venue Management

One-page synthesis of the PRD and phase series for an agent starting work.
**Rule:** every line below cites its source. `VERIFY` means the source is silent or the
starter pack is required — do not invent a value.

---

## 1. Product outcome

Unified web app that (a) generates conflict-free academic and midsem schedules, (b) prioritises
venue requests, (c) repairs disruptions, and (d) explains decisions. Scope is exactly the ten
functional requirements in `01_MASTER_PRODUCT_PRD.md` §"Functional requirements (PS §2)".
Explicitly out of scope: attendance, fees, student registration, payments, messaging, analytics
beyond room utilisation, and any autonomous AI authority (`01_MASTER_PRODUCT_PRD.md` §"Explicit
exclusions").

## 2. Roles

| Role in demo | PRD role | Demonstrates |
|---|---|---|
| `admin` (debjeet) | Administrator | Import, generate, approve, export, reset (`01_MASTER_PRODUCT_PRD.md` §"Users and jobs") |
| `department_coordinator` (indranil) | Department coordinator | Departmental change/event requests, lab approvals, never own requests |
| `event_manager` (mehul) | Club representative | Submit/cancel requests, track status and reason |
| — | Faculty | Own timetable, unavailability, extra/moved session requests — **not implemented** (`14_OPEN_QUESTIONS_AND_DECISIONS.md` D3) |

Enforced rule: **no self-approval, ever** — `requester != approver` in code paths, not just the UI
(`AGENT_IMPLEMENTATION_PLAN.md` §2; `08_AUTH_AND_APPROVALS_PRD.md`).

## 3. Domain entities

Conceptual entities from `02_DATA_AND_VALIDATOR_CONTRACT.md` §"Internal entity candidates":
Room, Faculty, StudentGroup, Course, Session, Exam, Booking, Disruption, Assignment, Approval.
**Field names, types and IDs are `VERIFY`** — they must come from the starter pack
(`01_PHASE_1_FOUNDATION.md` §4 rule). The TypeScript interfaces in `src/lib/store.ts` are
**demo-only shapes**, not the official schema.

Known dataset counts (verify at import, report mismatches rather than dropping rows):
27 rooms incl. 7 labs · 40 faculty · 14 student groups · 62 courses · 189 sessions / 243 weekly
hours · 25 Spectra requests (one later cancelled) · 41 midsem exams
(`02_DATA_AND_VALIDATOR_CONTRACT.md` §"Dataset counts").

## 4. Time model

Monday–Friday. P1 08–09, P2 09–10, P3 10–11, P4 11–12, P5 12–13, lunch 13–14, P6 14–15,
P7 15–16, P8 16–17, P9 17–18. P10–P13 18–22 are event-only. A three-hour lab may start only at
P2 or P6 (`03_SCHEDULING_SOLVER_PRD.md` §"Scope"). Implemented in `src/lib/time.ts`.

## 5. Hard constraints (never violated)

| ID | Constraint | Source |
|---|---|---|
| H01 | Every session scheduled exactly once | `03_SCHEDULING_SOLVER_PRD.md` §"Hard constraints" |
| H02 | No overlapping faculty occupancy | same |
| H03 | No student-group overlap (combined lectures affect every group; same elective-basket slot is an exception) | same |
| H04 | No room overlap | same |
| H05 | Room capacity ≥ session size | same |
| H06 | Compatible room type (e.g. physics lab only in a physics lab) | same |
| H07 | Faculty unavailability respected | same |
| H08 | Room maintenance/unavailability respected | same |
| H09 | No lunch-crossing; restricted 3-hour lab blocks | same |
| H10 | Accessible room when required | same |
| H11 | Same elective basket sits in simultaneous slots | same |
| H12 | Faculty teaching ≤ daily limit (CIT: 4 hours) | same |
| H13 | Approved bookings do not overlap room or mandatory group | same |
| H14 | Fixed-slot sessions remain fixed | same |

## 6. Soft constraints (penalties, weights `VERIFY`)

S01 faculty avoid-time · S02 group idle periods between classes (lunch excluded) · S03 group >6
class hours/day · S04 same course twice in one day for a group · S05 room fill < 40% · S06 session
in P9. Exact weights and counting are **`VERIFY` in the official validator**
(`03_SCHEDULING_SOLVER_PRD.md` §"Soft constraints"; `02_DATA_AND_VALIDATOR_CONTRACT.md`
§"Validator integration").

## 7. Booking priority tiers

1 Exams · 2 Regular classes · 3 Institute events (Spectra main events, convocation) · 4 Guest
lectures · 5 Department events · 6 Club events. Admin-configurable per the PS. **Priority never
permits a hard-constraint violation.** Preemption, tie-breaking and alternative-offer semantics
are `VERIFY` against the validator/README (`05_BOOKINGS_AND_PRIORITY_PRD.md` §"Priority order").

Booking lifecycle (`05_BOOKINGS_AND_PRIORITY_PRD.md` §"Proposed lifecycle", DESIGN):
DRAFT → REVIEWED → SUBMITTED → PENDING_APPROVAL → APPROVED / REJECTED /
ALTERNATIVE_OFFERED → CANCELLED. A cancelled request must release future occupancy and stay
auditable.

## 8. Exports and validator

Required: `exports/schedule.json` (initial generated result) and `exports/schedule_after.json`
(after a genuinely applied `sample_disruption.json`) (`02_DATA_AND_VALIDATOR_CONTRACT.md`
§"Export contract"). The official `validator.py` is the authority for correctness and scoring;
invoke it unmodified as a separate process and keep our own validation independent
(`02_DATA_AND_VALIDATOR_CONTRACT.md` §"Validator integration"). **Export schema is `VERIFY`** —
do not add fields the official README does not specify.

## 9. Acceptance gates

Phase 1 (`01_PHASE_1_FOUNDATION.md` §9): starter pack inventoried · data dictionary complete ·
validator invocation documented · disruption semantics documented · export schema documented ·
repo created after hackathon start · frontend **and** backend start locally · database migrations
run · import succeeds with a summary · invalid input gives useful errors · `.env.example` has no
secrets · architecture and API contracts documented.

Definition of project completion (`00_ROADMAP_INDEX.md` §"Definition of project completion"):
official dataset imported; schedules generated (never hand-authored); validator accepts both
exports with zero hard violations; bookings, priority, disruption repair and approvals work; AI
fails safely and manual workflows remain usable; four role accounts on the live deployment;
repo/exports/docs/video satisfy the organizer checklist.

## 10. Working guardrails

Stop rather than fabricate schedules, exam results, booking decisions or validator output
(`AGENT_IMPLEMENTATION_PLAN.md` §2). The LLM never decides validity — every proposal passes
deterministic validation first. Hide inaccessible nav **and** enforce at route/service level.
`npm run build` stays green. No secrets in git. Do not push to `main` without explicit approval.
Do not modify organizer files when they arrive.
