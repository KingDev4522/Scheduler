# Third-Party Dependencies

Required by the problem statement (`12_DEPLOYMENT_SUBMISSION_PRD.md`). Listed from `package.json`,
`solver/requirements.txt` and the bundled starter pack. Declare anything added later.

## 1. Frontend (npm)

| Package | Version | Purpose | License |
|---|---|---|---|
| `react`, `react-dom` | ^19.3.1 | UI runtime | MIT |
| `react-router-dom` | ^7.18.5 | Routing and route guards | MIT |
| `lucide-react` | ^1.66.0 | Icons | ISC |
| `radix-ui` | ^1.8.1 | Accessible primitives (shadcn/ui) | MIT |
| `class-variance-authority` | ^0.7.1 | Variant styling | Apache-2.0 |
| `clsx` | ^2.1.1 | Conditional class names | MIT |
| `tailwind-merge` | ^3.7.0 | Tailwind class merging | MIT |
| `framer-motion` | ^14.9.0 | UI motion | MIT |
| `tw-animate-css` | ^1.4.0 | Tailwind animation utilities | MIT |
| `tailwindcss`, `@tailwindcss/vite` | ^4.3.3 | Styling | MIT |
| `vite`, `@vitejs/plugin-react` | ^8.3.5 / ^6.1.2 | Build tooling | MIT |
| `typescript` | ^7.0.2 | Type checking | Apache-2.0 |
| `@types/react`, `@types/react-dom` | ^19.3.0 | Type definitions | MIT |

No purchased templates or third-party UI kits beyond the MIT/Apache libraries above.

## 2. Engine (Python)

| Package | Version | Purpose | License |
|---|---|---|---|
| `ortools` | >= 9.10 | CP-SAT solver for timetable and exams | Apache-2.0 |
| Python standard library | 3.8+ | JSON, CLI, unittest | PSF |

Install: `python -m pip install -r solver/requirements.txt`.

## 3. Organizer starter pack (bundled, unmodified)

`CrunchWeek_StarterPack/` contains:

- `README.md`, `validator.py`, `data/cit_public.json`, `data/csv/*.csv`, `examples/*`.
- The official validator is the scoring authority and is **not modified**.
- The dataset and examples are organizer-supplied; the app reads a copy at
  `public/data/cit_public.json`.

## 4. Reference used for design only

<https://github.com/spearb0lt/CP-SAT-Based-Timetabling-and-Exam-Arrangement>

No source code was copied. The repository has no `LICENSE` file, so it was used only as a design
reference for CP-SAT modelling ideas (optional intervals, lexicographic objectives, independent
verifier). See `docs/agent/CP_SAT_REFERENCE_ANALYSIS.md`.

## 5. Declarations to verify before submission

- Confirm each package's license text if the submission requires full license copies.
- Add any LLM provider SDK when Phase 4 integrates one (and update `AI_USAGE.md`).
- No secrets or API keys are included in this repository.
