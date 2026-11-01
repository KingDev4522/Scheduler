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
| `gsap` | ^3.15.0 | Landing-page scroll choreography | Standard GSAP license |
| `lenis` | ^1.3.26 | Smooth scrolling on the landing page | MIT |
| `metal-fx` | ^2.0.11 | WebGL liquid-metal assistant launcher (Libraries.dev) | MIT |
| `border-beam` | ^1.4.1 | Animated login-card border beam (Libraries.dev) | MIT |
| `tw-animate-css` | ^1.4.0 | Tailwind animation utilities | MIT |
| `tailwindcss`, `@tailwindcss/vite` | ^4.3.3 | Styling | MIT |
| `vite`, `@vitejs/plugin-react` | ^8.3.5 / ^6.1.2 | Build tooling | MIT |
| `typescript` | ^7.0.2 | Type checking | Apache-2.0 |
| `vitest` | ^4.1.12 | Frontend unit tests | MIT |
| `@types/react`, `@types/react-dom` | ^19.3.0 | Type definitions | MIT |

No purchased templates or third-party UI kits beyond the MIT/Apache libraries above.

`src/components/Particles.tsx` is adapted from Bencho (<https://bencho.dev>), MIT licensed
(<https://bencho.dev/licence>). Comments are preserved; React event typing and responsive canvas
sizing were adapted for this project.

The `design-taste-frontend` development skill (`skills-lock.json`, source `Leonxlnx/taste-skill`)
was used as a visual-direction reference during the landing-page work. It is development tooling,
not a runtime dependency of the Scheduler.

## 2. Engine and backend (Python)

| Package / service | Version | Purpose | License / terms |
|---|---|---|---|
| `ortools` | >= 9.10 | CP-SAT solver for timetable and exams | Apache-2.0 |
| `fastapi` | >= 0.115 | HTTP API | MIT |
| `uvicorn` | >= 0.30 | ASGI server | BSD-3-Clause |
| `python-multipart` | >= 0.0.9 | File uploads | Apache-2.0 |
| `python-dotenv` | >= 1.0 | Load `.env` secrets | BSD-3-Clause |
| `httpx` | >= 0.27 | Gemini HTTP client + API tests | BSD-3-Clause |
| `pydantic` | via FastAPI | Draft schema validation | MIT |
| `pytest` | >= 8.0 | Backend tests | MIT |
| **Google Gemini API** | `gemini-2.5-flash` | Natural-language request extraction (server-side) | Google Gemini API terms; key not committed |

Python standard library (3.8+) provides JSON, CLI, SQLite and `unittest`.

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
