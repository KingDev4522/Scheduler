# Frontend Guide — read this before changing UI

Audience: another agent or engineer working on the frontend in parallel.
This file describes **where things live, how data flows, which files are shared, and the
conventions to follow**. If you only read one section, read "Shared files" and "Conventions".

---

## 1. Mental model

```
index.html → src/main.tsx
                │  ensureSeedUsers()
                ▼
              src/App.tsx
                │  <AuthProvider> + <BrowserRouter>
                ├── /login  → src/pages/Login.tsx
                └── <AppShell> (RequireAuth)
                      │  shadcn Sidebar: SidebarProvider → AppSidebar + SidebarInset
                      └── NAV.map(item => <RequireRole roles={item.roles}>{item.element}</RequireRole>)
```

- **Navigation is data, not JSX.** `src/lib/nav.tsx` is the single source of truth for the
  sidebar label, icon, group, route path, allowed roles and page element. Adding a page means
  adding one `NAV` entry.
- **Pages read data synchronously** from `localStorage` via `getData()`.
- **Mutations are explicit functions in `src/lib/store.ts`** that return `{ ok, data }` or
  `{ ok: false, error }`. Pages copy the returned data into local state:
  `setData({ ...result.data })`.
- **Derived data belongs in `src/lib/selectors.ts`**, never duplicated inside pages.
- **No backend, no network calls.** All state is browser-local (DEC-001).

Storage keys (`src/lib/storage.ts`):

| Key | Contents |
|---|---|
| `cit-scheduler:users` | demo users (seeded by `ensureSeedUsers`) |
| `cit-scheduler:session` | `{ username, loggedInAt }` |
| `cit-scheduler:data` | `AppData` (rooms, faculty, groups, sessions, bookings, proposals, audit) |
| `cit-scheduler:login-attempts` | lockout counter |
| `cit-scheduler:sidebar-open` | persisted sidebar expanded/collapsed preference |

Demo accounts: `debjeet/1234` (admin), `mehul/1234` (event manager), `indranil/1234`
(department coordinator).

---

## 2. File map

```
src/
├── App.tsx                  routes + RequireAuth / RequireRole
├── main.tsx                 React root + demo-user seeding
├── index.css                Tailwind import + global focus ring
├── lib/
│   ├── auth.tsx             roles, login, session, lockout
│   ├── nav.tsx              SHARED: sidebar + routes + role access
│   ├── store.ts             SHARED: domain types + localStorage mutations
│   ├── selectors.ts         SHARED: all derived reads
│   ├── time.ts              period/day model (single source of truth)
│   └── storage.ts           typed localStorage wrapper
├── engine/
│   ├── types.ts             solver/validator contracts
│   ├── input.ts             AppData → EngineInput adapter, legal windows
│   ├── solver.ts            solveTimetable + repairTimetable (backtracking, MRV)
│   ├── validate.ts          independent hard-constraint validator
│   ├── soft.ts              provisional soft-penalty weights
│   └── disruption.ts        disruption spec → repair constraints
├── components/
│   ├── AppShell.tsx         layout shell: shadcn SidebarProvider + header + <Outlet/>
│   ├── AppSidebar.tsx       sidebar nav (groups, roles, collapse, user menu)
│   ├── ui/                  shadcn primitives: sidebar, sheet, tooltip, dropdown-menu,
│   │                        button, input, separator, skeleton
│   ├── PageHeader.tsx       PageHeader + ModulePlaceholder
│   ├── StatCard.tsx         dashboard metric card
│   ├── States.tsx           EmptyState, ErrorState, LoadingState, StatusNotice
│   ├── Badges.tsx           BookingStatusBadge, PriorityBadge, RoomTypeBadge, SessionKindBadge
│   ├── DecisionDialog.tsx   reason-required approve/reject modal
│   └── TimetableGrid.tsx    desktop grid + mobile agenda
└── pages/
    ├── Login.tsx
    ├── Dashboard.tsx        role-aware overview + pending decision queue
    ├── Timetables.tsx       group/faculty/room views, URL state
    ├── Rooms.tsx            filters + availability
    ├── Bookings.tsx         25-request Spectra board + decisions
    ├── Changes.tsx          disruption repair + proposal submission
    ├── Approvals.tsx        pending queue + decision history
    ├── AdminImportExport.tsx data summary + demo solver + blocked official IO
    ├── Exams.tsx            placeholder
    ├── Assistant.tsx        placeholder
    └── Help.tsx             demo accounts, role scope, reset
```

---

## 3. Domain types (`src/lib/store.ts`)

| Type | Key fields |
|---|---|
| `Room` | `id, name, building, capacity, type, features, accessible, department?` |
| `Faculty` | `id, name, department, dailyLimit` |
| `StudentGroup` | `id, name, year, branch, size` |
| `Session` | `id, courseCode, courseName, facultyId, groupId, roomId, day, startPeriod, periods, kind` |
| `Booking` | `id, title, organizer, requester, roomId, day, startPeriod, periods, priority, status, expectedAttendees, note, decisionReason?` |
| `ChangeProposal` | `id, title, requester, disruption, before[], after[], movedCount, status, decidedBy?` |
| `AuditEvent` | `id, actor, action, at` |
| `AppData` | `version, rooms, faculty, groups, sessions, bookings, proposals, audit` |

`SEED_VERSION` is currently **4**. Bump it whenever the seeded shape changes, otherwise returning
users keep stale localStorage data. Demo shapes are **not** the official dataset schema
(DEC-002).

### Mutations you should call (never write localStorage directly)

| Function | Purpose |
|---|---|
| `decideBooking(id, 'approved' \| 'rejected', actor, reason)` | Audited booking decision; enforces no self-approval |
| `submitProposal(draft, actor)` | Stores a repair proposal; does **not** change the timetable |
| `decideProposal(id, decision, actor, reason)` | Admin-only; approval applies `after` placements |
| `applyPlacements(placements, actor)` | Writes a **full** validated timetable |
| `resetDemoData()` | Clears demo data; next read reseeds |

All return `{ ok: true, data }` or `{ ok: false, error }`. Show the error; never assume success.

### Selectors you should reuse (`src/lib/selectors.ts`)

`pendingDecisions`, `dashboardStats`, `derivedConflicts`, `visibleBookings`,
`bookingDecisionPermission`, `roomAvailability`, `roomUtilisation`, `averageUtilisation`,
`sessionsForView`, `conflictsForView`, `viewOptions`, `overlappingSessionPairs`,
`groupDailyLoad`, `roomById`, `facultyById`, `groupById`, `bookingLocation`.

Rule: if two pages need the same calculation, it goes in `selectors.ts` — not in both pages.

---

## 4. Conventions

### Role access
- Add the page to `NAV` with its allowed roles.
- Hidden nav **and** route-level enforcement happen automatically (`navForRole`, `RequireRole`).
- Never gate an action only in the UI. Store mutations re-check authorization
  (`canDecideBooking`, `decideProposal`).

### Styling
- Tailwind utilities only; no CSS modules.
- The app shell uses **shadcn/ui** primitives from `src/components/ui/`. Page content uses
  Tailwind directly plus the in-repo primitives (`States`, `Badges`, `DecisionDialog`,
  `StatCard`, `PageHeader`).
- Palette: `slate` for structure, `indigo` for primary actions, `emerald` success,
  `amber` pending/demo, `rose` errors/conflicts, `sky` alternatives.
- Cards: `rounded-xl border border-slate-200 bg-white p-5 shadow-sm`.
- **Responsive pattern:** desktop table (`hidden lg:block overflow-x-auto`) + mobile card list
  (`lg:hidden`). Do not make a desktop table the only view.
- Keep tables `min-w-[…]` and wrap in `overflow-x-auto`.

### Accessibility
- Every input has an associated `<label htmlFor>` (or `aria-label`).
- Toggle buttons use `aria-pressed`; modal uses `role="dialog" aria-modal="true"`.
- Never convey status by colour alone — use badge text and the legend.
- Global focus ring lives in `src/index.css`; do not remove it.
- Timetable blocks carry `aria-label` and a `title` fallback.

### States
Use `src/components/States.tsx`:
- `EmptyState` for no-data / no-filter-results with a recovery action.
- `ErrorState` for invalid route state (e.g. unknown timetable selection).
- `LoadingState` for skeleton work.
- `StatusNotice` for post-mutation success/error messages.

### Demo data honesty
Every screen that shows seeded data must say **demo data**. Never claim a demo schedule is
official or validator-passing. Hard constraints are documented in `docs/agent/BRIEFING.md`.

---

## 5. Adding a page (checklist)

1. Create `src/pages/YourPage.tsx`.
2. Start with `<PageHeader title subtitle />`.
3. Read data with `const [data] = useState(getData)` (read-only) or `useState<AppData>(getData)`
   plus a mutation if the page writes.
4. Derive everything through `selectors.ts`.
5. Add one `NAV` entry in `src/lib/nav.tsx` with `path`, `label`, `icon`, `group`, `roles`,
   `element`.
6. Handle empty + invalid states.
7. Run `npm run build` (type-check + production build) before handing back.

Sketch:

```tsx
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/States'
import { getData } from '../lib/store'
import { someSelector } from '../lib/selectors'

export default function YourPage() {
  const [data] = useState(getData)
  const rows = someSelector(data)
  return (
    <div>
      <PageHeader title="Your page" subtitle="What it does" />
      {rows.length === 0 ? (
        <EmptyState title="Nothing here yet" description="What the user can do next." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">{/* … */}</div>
      )}
    </div>
  )
}
```

---

## 6. Engine integration (only for timetable/change work)

- `buildEngineInput(data)` adapts `AppData` → solver contracts.
- `solveTimetable(input)` returns `{ status, placements, violations, metrics, message }`.
  `FEASIBLE` is only returned after the **independent** validator reports 0 violations.
- `repairTimetable(input, currentPlacements, affectedSessionIds)` keeps every unaffected session
  fixed and re-places only the affected ones.
- `planDisruption(data, spec)` turns faculty leave / room closure into engine constraints.
- Apply is allowed only when `status === 'FEASIBLE'` and `violations.length === 0`.
- `TIMEOUT` is **not** proof of infeasibility; copy the message as-is.

Soft weights are provisional (`src/engine/soft.ts`) and must never be labelled "official".

---

## 7. Shared files — coordinate before editing

These are imported by several pages. Another agent may be editing them at the same time:

| File | Why it is shared |
|---|---|
| `src/lib/nav.tsx` | routes + sidebar + roles |
| `src/lib/store.ts` | domain types + every mutation |
| `src/lib/selectors.ts` | every derived read |
| `src/lib/time.ts` | period model used by grids, engine, validation |
| `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/AppSidebar.tsx` | routing + shell |
| `src/components/ui/*` | shadcn primitives used by the shell |
| `src/components/States.tsx`, `Badges.tsx`, `DecisionDialog.tsx` | shared primitives |
| `src/engine/*` | solver + validator contracts |

Safer parallel work: page-level files, styling, copy, new presentational components that do not
change shared types.

If you must change a shared type, update every reference and run `npm run build`. Do not rename
`AppData` fields without bumping `SEED_VERSION` and migrating or reseeding stored data.

---

## 8. Do / don't

**Do**
- Keep `npm run build` green.
- Reuse `selectors.ts` and `States.tsx`.
- Label demo data.
- Keep decisions auditable: reason required, no self-approval, state unchanged until applied.
- Preserve URL state on filterable views (`useSearchParams`, as in Timetables/Bookings).

**Don't**
- Don't write to `localStorage` outside `store.ts`/`storage.ts`.
- Don't fabricate schedules, decisions or validator output.
- Don't add a fourth demo role or account without DEC-003 being resolved.
- Don't infer official dataset field names or export keys (DEC-002).
- Don't claim the demo engine's soft penalty is the official score.
- Don't edit `.commandcode/taste/**`.

---

## 9. Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit && vite build — required before handoff
npm run preview  # serve the production build
```

Related docs: `docs/agent/BRIEFING.md` (product rules), `DECISIONS.md` (open decisions),
`GAP_MAP.md` (what is built vs placeholder).
