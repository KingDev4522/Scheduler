# AI Usage Declaration

Required by the problem statement (`12_DEPLOYMENT_SUBMISSION_PRD.md` §AI_USAGE; failure to declare
AI use costs marks). This file lists every AI system used to build or run the project.

## 1. AI used during development

| Tool | Purpose | Where it helped |
|---|---|---|
| **Command Code** (agentic coding assistant) | Code generation and review during development | Scaffolded the React/Vite app shell and pages; implemented the TypeScript demo engine and the Python CP-SAT engine; wrote the Phase 1 contracts and tests; reviewed the official validator output. |
| Organizer starter pack | Authoritative specification and validator | **Not AI** — organizer-supplied files, unmodified. |

No other AI model or API was used to produce code, data, schedules or exports.

## 2. AI in the product at runtime

**None today.** There is no LLM API integration in the running app.

- The `AI Assistant` screen is a placeholder (Phase 4).
- No API keys are present in the repository or the browser bundle.
- All schedules, exam datesheets, booking decisions and exports are produced by deterministic code
  (CP-SAT + explicit rules) and checked by the official `validator.py`.

If an LLM is added in Phase 4, it will be used **only** to parse English/Hinglish into an editable
structured draft and to phrase explanations. It will never decide validity, priority, approval or
schedule changes; every proposal must pass the deterministic validator and the approval workflow.

## 3. Prohibited AI responsibilities (committed policy)

The LLM (if added) must not:

- decide whether a schedule or booking is valid;
- override hard constraints or invent availability;
- set priority or category from user text;
- approve its own or anyone's proposal;
- write authoritative schedule/booking records;
- fabricate conflict explanations.

Manual workflows must work with the AI provider disabled (`04_PHASE_4_AI_AUTH_FRONTEND.md` §5).

## 4. Prompts and keys

- No prompt files are shipped in the product.
- Provider keys belong in server-side environment variables only; `.env` is git-ignored and
  `.env.example` contains placeholders only.

## 5. Models / providers

None declared, because none are integrated. This section must be updated before submission if an
LLM provider is added (provider, model, purpose, base URL, and where prompts live).
