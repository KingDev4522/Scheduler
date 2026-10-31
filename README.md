# CIT Scheduler

A role-aware campus scheduling and venue management web app — conflict-free timetables, exam scheduling, venue bookings with priority, disruption repair, and auditable approvals. Built for the CIT problem statement (189 teaching sessions, 41 midsems, 25 Spectra requests).

**Current state:** application shell is live — sidebar navigation, login with three demo roles, role-aware dashboard with working approvals (localStorage persistence). Modules below are scaffolded and land next.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Demo accounts

| Username | Password | Role |
|---|---|---|
| `debjeet` | `1234` | Administrator |
| `mehul` | `1234` | Event Manager |
| `indranil` | `1234` | Department Coordinator |

One-click sign-in buttons are available on the login screen. Credentials and all app data are stored **only in your browser's localStorage** — no backend, no network calls.

## Sidebar & roles

Navigation lives entirely in a sidebar, grouped as **Overview / Scheduling / Workflow / System**. Items a role cannot use are hidden *and* blocked at the route level.

| Section | Admin | Coord. | Event Mgr |
|---|:--:|:--:|:--:|
| Dashboard | ✅ | ✅ | ✅ |
| Timetables, Rooms | ✅ | ✅ | ✅ |
| Exams | ✅ | ✅ | — |
| Bookings | ✅ | ✅ | ✅ |
| Changes, AI Assistant, Approvals | ✅ | ✅ | — |
| Import / Exports | ✅ | — | — |
| Help | ✅ | ✅ | ✅ |

## Project structure

```
├── README.md                  ← you are here
├── docs/                      ← product & engineering documentation
│   ├── 00_START_HERE.md       ← documentation index (start here)
│   ├── 01_MASTER_PRODUCT_PRD.md
│   ├── 02_DATA_AND_VALIDATOR_CONTRACT.md
│   ├── …                      ← PRDs 03–17
│   └── 17_DOCUMENTATION_TEMPLATES.md
├── index.html                 ← Vite entry
├── vite.config.ts             ← React + Tailwind plugins
└── src/
    ├── main.tsx               ← bootstrap + demo-user seeding
    ├── App.tsx                ← routes + auth/role guards
    ├── lib/
    │   ├── auth.tsx           ← login, session, roles, rate-limiting
    │   ├── nav.tsx            ← single source of truth: sidebar + routes + access
    │   ├── store.ts           ← localStorage data layer (rooms, bookings, approvals, audit)
    │   └── storage.ts         ← typed localStorage helpers
    ├── components/            ← AppShell (sidebar/topbar), PageHeader, StatCard
    └── pages/                 ← Login, Dashboard, Help + module scaffolds
```

## Documentation

Full PRD set lives in [`docs/`](docs/00_START_HERE.md):

- [00_START_HERE.md](docs/00_START_HERE.md) — index and read order
- [01_MASTER_PRODUCT_PRD.md](docs/01_MASTER_PRODUCT_PRD.md) — scope, journeys, acceptance
- [09_FRONTEND_UX_PRD.md](docs/09_FRONTEND_UX_PRD.md) — screens and interaction rules
- [13_IMPLEMENTATION_PLAN.md](docs/13_IMPLEMENTATION_PLAN.md) — work breakdown and demo plan

## Roadmap

1. ✅ Shell: sidebar UI, auth (3 roles), role-aware dashboard
2. ⬜ Timetable grid + rooms finder with real dataset import
3. ⬜ Bookings + Spectra decision board (all 25 requests)
4. ⬜ Exams, change proposals and approvals inbox
5. ⬜ AI assistant (NL/Hinglish extraction) with deterministic validation
6. ⬜ Import/export, validator results, deployment
