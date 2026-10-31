# CP-SAT Reference Analysis (Weekly Timetable Only)

**Purpose:** analyse how the reference repository builds a proper weekly timetable with constraints,
and what of that approach applies to the CIT PRD.
**Not in scope:** examination scheduling, seating, invigilation, minor/backlog streams, chapter
modules, staffing swaps, dated calendars, the reference's LLM layer and its data model. Those are
either explicitly out of this note or belong to other phases. They are **not** adopted here.

Reference: <https://github.com/spearb0lt/CP-SAT-Based-Timetabling-and-Exam-Arrangement>
Sources read: `README.md`, `DESIGN.md` (§1–§5, §9), `app/cpmodel.py`. `app/exams.py` was opened only
to confirm it is a separate problem and is deliberately excluded.
**Licence:** the repository contains no `LICENSE` file. No source code is copied. This note records
design ideas only, re-expressed for our project.

---

## 1. How the reference actually solves a timetable

### 1.1 Model shape

It is not "one boolean per (event × day × period × room)". That encoding produced ~280,000
auxiliary booleans and could not find a first solution. The working shape is:

- **`x[event, slot]`** — one boolean per event and each legal start slot (≈250 events × 50 slots).
- **Integer `start[event]`** — channelled to those booleans, so interval constraints can use it.
- **Optional interval variables + `NoOverlap`** per person and per student-atom, instead of
  `AtMostOne` over every (resource, slot) pair. ~4,000 intervals instead of 280,000 booleans.
- **Rooms are not in the main model** (see §1.2).

`app/cpmodel.py` also pre-filters slots at model-build time: breaks, day-boundary overruns,
availability, restricted evening slots and reserved columns never get a variable at all.

### 1.2 Two-stage decomposition

| Stage | Decides | How |
|---|---|---|
| 1 | day/period per event | CP-SAT with people/student intervals |
| 2 | concrete room per event | bipartite matching per slot, outside CP-SAT |

Room capacity appears in stage 1 only as **per-slot counting by capacity tier** — not by room kind
alone, because two rooms of a kind may not both fit a 55-student cohort. An event needing a
co-booked pair consumes two units. Stage 2 then matches events to rooms; Hall's condition gives a
precise infeasibility certificate ("slot Tue-3 needs 7 rooms of ≥100 seats; 6 exist").

This is the part that makes the model scale: including rooms in stage 1 multiplies the search space
by the room count for no optimisation benefit.

### 1.3 Hard constraints

Encoded as resource exclusivity (person, student atom, room), exact demand (`ExactlyOne` per event),
contiguity (forbid starts whose block crosses a break or day end), capacity/type filters at build
time, fixed slots/pins, faculty quota, and approved-booking blocks. Each hard rule is a model
constraint, not a post-check.

### 1.4 Objective: lexicographic tiers, not one weighted sum

The reference solves tier by tier, freezes each optimum as a constraint, and moves to the next. Its
stated reason is explainability: with one weighted sum, changing a weight silently reorders
unrelated preferences; with tiers, "why was this broken?" has a mechanical answer ("it lost at tier
3"). It also seeds each tier with `AddHint` from the previous solution and gives the ladder an
adaptive time budget.

### 1.5 Independent verifier

A separate module receives `(instance, schedule)` and returns violations. It shares **no** constraint
code with the solver — not the builders, not the predicates — only the read-only domain model. The
design states the reason plainly: if both are wrong in the same way, the verifier is worthless.
This matches our existing `src/engine/validate.ts` split and is worth preserving.

### 1.6 Repair

Repair is not a fresh solve:

1. Freeze unaffected events (hints from the committed schedule).
2. Apply the disruption as a new hard constraint.
3. Add a tier above the soft tiers: minimise **perturbation** (moved slots, changed people, changed
   rooms, cancellations, people affected).
4. Cap the blast radius; if the cap makes repair impossible, say so rather than exceed it.
5. Return ranked **proposals**, never a commit.

Our `repairTimetable()` already follows the freeze-unaffected-sessions + proposal pattern. The
reference adds perturbation **ranking** and blast-radius caps, which we do not have.

### 1.7 Determinism and status vocabulary

- Recorded random seed; same input + same seed ⇒ same output.
- Distinct outcomes: `OPTIMAL`, `FEASIBLE`, `INFEASIBLE`, `UNKNOWN`.
- A timeout is **not** proof of infeasibility and is reported separately.

Our engine already distinguishes `FEASIBLE / INFEASIBLE / TIMEOUT`; it does not report optimality
because backtracking does not prove it.

### 1.8 Rules as data, import never guesses

Constraints (course ordering, person unavailable, group max/day, fixed slot) are typed rows applied
by both generation and repair. The importer reports ambiguity and refuses to guess. Our app has the
"never invent" rule already; it does not yet have a constraint-rule layer.

---

## 2. Mapping to the CIT PRD (weekly timetable)

| CIT requirement | Reference technique worth borrowing | Current CIT state |
|---|---|---|
| H01 every session exactly once | `ExactlyOne` over placements | done (backtracking) |
| H02 no faculty overlap | interval `NoOverlap` per faculty | done, boolean occupancy |
| H03 no group overlap | interval `NoOverlap` per group/atom | done, boolean occupancy |
| H04 no room overlap | room intervals / stage-2 matching | done, boolean occupancy |
| H05 capacity | filter candidates by group size | done |
| H06 room type | filter candidates by kind | done |
| H07 faculty unavailable | pre-filter slots at build time | engine supports, demo data none |
| H08 room maintenance/closure | pre-filter room-slot pairs | done for closures |
| H09 lunch / 3-hour lab windows | legal-window pre-filter | done |
| H10 accessibility | filter by room feature | not modelled |
| H11 elective basket sync | force shared start across options | not modelled |
| H12 faculty daily limit | linear sum per person/day | done |
| H13 approved bookings | remove blocked room-slot pairs | done |
| H14 fixed slots | pins/`ExactlyOne` to one slot | validator supports, no demo data |
| S01–S06 soft preferences | lexicographic tiers with reported optima | one provisional weighted score |

The reference reinforces the *shape* of the solution, not a different problem definition. It does
not replace the CIT hard constraints.

---

## 3. What we should adopt — and what we should not

### Adopt (fits the CIT PRD, browser-only track)

1. **Pre-filter before search.** Never generate a placement for a blocked room-slot, an unavailable
   faculty window, or an illegal lunch/lab window. We already do most of this; make it explicit and
   measured.
2. **Separate room assignment from time assignment.** Our current search chooses day/period/room
   jointly. Splitting rooms into a matching stage would reduce branching and produce a precise
   infeasibility certificate. This is the single biggest algorithmic improvement available.
3. **Lexicographic soft tiers.** Replace the single weighted score with ordered tiers:
   hard feasibility → admin rules → student idle gaps → day compaction → fairness → P9 → low fill.
   Report each tier's achieved value. Weights remain `VERIFY`, but ordering is explainable.
4. **Infeasibility diagnosis / relaxation.** When infeasible, re-solve with one constraint family
   relaxed at a time (quota, room type, capacity, bookings, group overlap) and report which
   relaxation restores feasibility. This is the "de-constraining" behaviour the reference implements
   via assumption literals. Our current engine only prints a failure message.
5. **Perturbation-ranked repair proposals.** Keep the freeze-unaffected-sessions guarantee, then
   rank proposals by moved sessions / changed rooms, and expose the blast radius.
6. **Statistically honest statuses.** Keep `TIMEOUT ≠ INFEASIBLE`; add achieved soft values to the
   result so the UI can explain the trade-off.

### Do not adopt now

- **CP-SAT itself.** It requires a Python service; D1 is still browser-only (DEC-001). Adding a
  backend is an architectural decision the user has not made.
- **The reference's data model.** It models people, atoms, programmes, batches, minors, backlogs,
  modules, rooms pairs, etc. for a different institution. CIT's starter pack defines our fields.
- **Exams, seating, invigilation, modules, staffing, dated calendars, LLM rules, SQLite, FastAPI,
  vanilla-JS UI.** Explicitly outside this analysis and this phase.
- **Copying code.** No licence file; design ideas only.

---

## 4. Gap between our engine and the reference

| Capability | Reference | CIT today |
|---|---|---|
| Search | CP-SAT, optional intervals | backtracking + MRV |
| Scalability | interval encoding, stage split | fine for 25 demo sessions; not proven at 189 |
| Objective | lexicographic tiers, reported optima | one provisional weighted score |
| Room choice | stage-2 matching + Hall certificate | joint search, no certificate |
| Infeasibility | minimal conflicting set + relaxation | message only |
| Repair | hints, perturbation tier, ranked proposals, caps | freeze-unaffected, single proposal |
| Verifier | independent module | independent `validatePlacements` |
| Determinism | seed recorded | deterministic ordering, no explicit seed |
| Status | OPTIMAL/FEASIBLE/INFEASIBLE/UNKNOWN | FEASIBLE/INFEASIBLE/TIMEOUT |

---

## 5. Recommended next step (when Phase 2 starts)

**Do not change Phase 1.** Phase 1 is the foundation: schema, import, contracts, UI. The engine work
belongs to Phase 2.

When Phase 2 starts, in this order:

1. **Decide D1.** Browser-only or backend. This determines whether CP-SAT is even available.
2. **Browser-only (D1 = A):** port techniques 1–5 into `src/engine/` in TypeScript. Keep the
   independent validator. No Python, no OR-Tools.
3. **Backend (D1 = B/C):** implement only the weekly CP-SAT model, using the reference's interval and
   stage-2 ideas, and keep the existing TypeScript validator as the differential oracle. Do not bring
   over the reference's data model or exam module.
4. **Measure before rewriting:** generate the official 189-session instance and compare runtime and
   violation counts of the current backtracking engine. If it holds, the cheapest correct path is to
   keep it and add tiers + diagnosis.

The reference is valuable as a *design pattern*: pre-filter, separate rooms from time, order
objectives lexicographically, verify independently, repair with hints. It is not a drop-in
replacement for the CIT model.
