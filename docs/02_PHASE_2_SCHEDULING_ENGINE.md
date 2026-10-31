# Phase 2 — Core Scheduling & Optimization Engine

## 1. Purpose

Build the deterministic scheduling engine that assigns every teaching session a day, start period and room, and schedules the midsem examinations.

**Phase outcome:** The application generates timetable and exam results that pass the official validator's hard constraints.

## 2. Official scheduling model

The problem statement specifies:
- Teaching week: Monday to Friday.
- Nine one-hour periods, P1 through P9.
- P1 starts at 08:00 and P9 at 17:00.
- Lunch: 13:00–14:00 between P5 and P6.
- P10–P13, 18:00–22:00, are for events only.
- Every session is assigned exactly once.
- Every session already has faculty and student groups assigned.
- The application chooses day, start period and room.

Three-hour labs can only be placed in P2–P4 or P6–P8.

The dataset contains 189 teaching sessions and 243 weekly teaching hours. The application must schedule 41 midsem exams in the following week.

## 3. Recommended solver

Use Google OR-Tools CP-SAT as the initial solver candidate because the problem is a discrete constraint optimization problem and the backend is Python.

This is an engineering recommendation, not an organizer requirement. Verify installation, runtime and validator compatibility.

## 4. Solver architecture

Separate the solver into these layers:

1. **Input adapter:** Converts verified dataset records into internal typed objects.
2. **Candidate generator:** Creates feasible day/period/room candidates using safe prefilters.
3. **Model builder:** Creates decision variables and hard constraints.
4. **Objective builder:** Encodes soft-constraint penalties using official weights/semantics.
5. **Solver runner:** Applies time limits, status handling and deterministic configuration where appropriate.
6. **Result decoder:** Converts solver assignments into the official schedule representation.
7. **Independent validator:** Runs deterministic application checks and the official validator.
8. **Persistence/export:** Stores only validated results and generates the required export.

## 5. Decision-variable design

A conceptual assignment variable may represent whether session `s` uses day `d`, start period `p` and room `r`.

The exact encoding must account for:
- Session duration.
- Multi-period occupancy.
- Lunch.
- Lab restrictions.
- Room compatibility.
- Faculty and group conflicts.
- Fixed slots.
- Availability windows.

Do not assume every session lasts one hour. Read durations from the starter data.

## 6. Hard constraints

Implement and test each rule from the problem statement.

### H1 — Every session exactly once
Every required teaching session receives exactly one valid assignment.

### H2 — Faculty non-overlap
A faculty member cannot be assigned overlapping sessions.

### H3 — Student-group non-overlap
A student group cannot be assigned overlapping sessions.
- Combined lectures count for every group included.
- Sessions in the same elective basket slot do not clash with each other because a student attends only one.
- All sessions in the same elective basket slot must run at the same day and period.

### H4 — Room non-overlap
A room cannot host two overlapping activities.

### H5 — Capacity
Room capacity must be at least session size.
For exams, effective capacity is half normal room capacity for all capacity validation checks.

### H6 — Room type
Room type must match session requirement.

### H7 — Faculty unavailability
No session during unavailable periods.

### H8 — Room unavailability
No use during maintenance or other unavailable windows.

### H9 — Lunch and duration
No session may cross lunch. Three-hour labs only in P2–P4 or P6–P8.

### H10 — Accessibility
Sessions requiring an accessible room must receive one.

### H11 — Faculty daily limit
Respect the CIT data daily limit (four hours in the supplied problem statement).

### H12 — Fixed slots
A fixed-slot session stays in its specified slot.

### H13 — Booking interactions
An approved booking must not overlap a session or another booking in the same room, or clash with a group for whom it is mandatory. Coordinate this with the booking module.

## 7. Soft constraints

The problem statement lists:
- Faculty scheduled at a time they asked to avoid.
- Student-group free period between two classes on the same day (lunch excluded).
- Student group has more than six hours of class in a day.
- Two lectures of the same course for a group on the same day.
- Session uses less than 40% of room capacity.
- Session scheduled in P9.

Read the official validator to determine exact penalty weights, counting rules and edge-case semantics. Do not invent weights.

## 8. Objective and solve strategy

Use a lexicographic or weighted objective only after verifying the official scoring model.

Recommended priority:
1. Find a feasible assignment satisfying every hard constraint.
2. Improve the official soft penalty.
3. Return a valid incumbent if the configured solve limit is reached, but clearly label solver status and never claim optimality unless proven.
4. Validate independently before persistence.

Do not trade a hard constraint violation for a better soft score.

## 9. Examination scheduling

Implement exam scheduling as a distinct problem using the exam data and official rules.

Must include:
- All 41 exams.
- Student-group conflict handling.
- Room availability and room compatibility.
- Half-capacity rule.
- Any exam-specific duration, invigilation or timing fields actually present in the starter pack.

The problem statement does not fully enumerate all exam-specific constraints. Resolve them from the starter README, dataset and validator before coding.

## 10. Job execution

Scheduling may take longer than an ordinary API request. Recommended flow:
1. Admin requests generation.
2. API creates a job.
3. Worker runs solver.
4. Worker validates result.
5. Valid result is persisted as a draft or generated schedule version.
6. UI polls job status or receives updates.
7. Admin can inspect and publish according to application workflow.

Use Celery/Redis only if required by runtime. A simpler background task can be used during local prototyping, but production behavior must be reliable.

## 11. Error and status handling

Distinguish:
- Optimal
- Feasible, not proven optimal
- Infeasible
- Unknown/time limit without solution
- Invalid input
- Solver/internal error

If infeasible, provide useful diagnostics. Do not invent a conflict explanation unsupported by solver diagnostics or validation evidence.

## 12. Testing strategy

- Unit test each hard constraint.
- Create small synthetic cases with known feasible/infeasible outcomes.
- Test overlapping multi-period sessions.
- Test combined groups.
- Test elective basket synchronization and non-clash behavior.
- Test fixed slots.
- Test lunch and lab windows.
- Test room capacity/type/accessibility.
- Test faculty daily limit.
- Run official validator against generated output.
- Regression-test every solver change.

## 13. Acceptance criteria

- [ ] All 189 sessions are assigned exactly once.
- [ ] All hard constraints pass the official validator.
- [ ] All six soft constraints are represented according to official semantics.
- [ ] No unsupported penalty weights are hardcoded.
- [ ] Exam scheduler handles all 41 exams.
- [ ] Half-capacity exam rule is enforced.
- [ ] Result status is accurately reported.
- [ ] Invalid or infeasible results are not published as valid.
- [ ] `exports/schedule.json` is generated by the application.
- [ ] Tests cover all listed constraints.

## 14. Phase exit gate

The initial teaching timetable and examination output must be generated by the application and checked against the official validator. Target zero hard-constraint violations.
