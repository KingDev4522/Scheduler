# AI Usage Declaration

Required by the problem statement (§6 — Implementation Rules, §7 — Submission
Requirements). This file lists **every AI system** used to build or run this project:
every model/API the product calls and what it is used for, every AI tool used during
development and which parts it helped with, where the prompts are kept, and what the LLM
is **not** allowed to decide in the system.

---

## 1. AI in the product at runtime

| Provider | Models | Purpose | Where |
|---|---|---|---|
| **Google Gemini API** | `gemini-3.5-flash` (preferred), fallback chain `gemini-3.6-flash` → `gemini-3.8-flash` | The **AI brain** of the app: converts a plain-English / Hinglish venue request into a structured, **editable** booking draft, and a natural-language schedule-change request into a structured change draft. | `backend/assistant.py`, called via `POST /api/assistant/parse` |

**Configuration (server-side only):**

```
GEMINI_API_KEY=<server-side secret, never shipped to the browser>
GEMINI_MODEL=gemini-3.5-flash
GEMINI_MODELS=gemini-3.5-flash,gemini-3.6-flash,gemini-3.8-flash
```

> `gemini-2.5-flash` was retired by the provider (404) during development and is no
> longer used. `gemini-3.8-flash` can return 503 under high demand, so 3.5 answers first.

**Boundaries enforced in code:**

- The model runs **server-side only**. `GEMINI_API_KEY` lives in the git-ignored `.env`
  (or the deployment secret store); it is never bundled into the frontend bundle.
- The model is an **extractor, not a validator**. Its output is schema-checked in Python
  (`BookingDraftModel` / `ChangeDraftModel`), normalised against the official dataset,
  then passed to the deterministic validators (`solver/booking_validation.py`,
  `solver/manual.py`). The model can never approve, prioritise, select a room, or bypass
  a hard constraint.
- Request text is treated as **untrusted input** — the system prompt instructs the model
  to ignore instructions embedded in the request (prompt-injection resistance).
- **Graceful degradation:** if the key is missing, every model in the chain errors, or
  the output is malformed, a **deterministic local-rules parser** produces the draft and
  marks it `source: local-rules`. The Manual Booking form and every other workflow keep
  working with AI fully disabled (a problem-statement requirement the judges test). The
  API returns 503 only if the provider chain *and* the local parser both fail.
- The user reviews and edits every extracted field before submission — a schema-valid
  draft is **not** a valid booking.

## 2. Where the prompts are kept

All prompts live in server-side code, versioned with the repository — nothing is shipped
to the browser:

- `backend/assistant.py` → `SYSTEM_PROMPT`, `BOOKING_PROMPT`, `CHANGE_PROMPT`

No external prompt files, no prompt management service.

## 3. What the LLM is NOT allowed to decide

Per the problem statement ("If your validity checks depend on an LLM, you get 0 for
scheduling correctness"), the LLM must never:

- decide whether a schedule or booking is **valid**;
- override hard constraints or invent availability;
- set priority or category from user text;
- approve its own or anyone's proposal;
- write authoritative schedule/booking records;
- fabricate conflict explanations.

All validity, priority, approval and scheduling decisions are made by deterministic
Python code (OR-Tools CP-SAT + the unmodified official `validator.py`). LLM output is
untrusted input, never a validity oracle.

## 4. AI tools used during development

| Tool | Type | Which parts it helped with |
|---|---|---|
| **VS Code** | Development environment (IDE) | Primary editor for the entire project; host for the AI tooling below. Not an AI model itself. |
| **Command Code** (agentic coding assistant, VS Code extension / CLI) | AI coding assistant | Code generation, refactoring and review across the repo: React/Vite frontend scaffolding, TypeScript demo engine, Python CP-SAT solver, FastAPI backend, tests, documentation, and UI redesign iterations. |
| **design-taste-frontend** (`Leonxlnx/taste-skill`) | Frontend design-direction skill (local) | Landing-page and app visual direction: typography, layout, palette guidance and design audits. Runs locally; makes no external model calls of its own. |
| **Freebuff** (`.freebuff/` local workspace metadata) | Local tooling metadata | Workspace identifier only — no model calls, no runtime behavior, not committed to git. |

**Not AI:** the organizer starter pack (`CrunchWeek_StarterPack/`) is authoritative,
organizer-supplied material and is used **unmodified**.

## 5. Keys

- `GEMINI_API_KEY` is provided via environment only; `.env` is git-ignored and
  `.env.example` ships a blank placeholder.
- Own API keys are used, as required. Any key shared during development is rotated before
  submission.

## 6. Future providers

Any future AI provider (OpenAI-compatible, local models, etc.) must be declared in this
file — with its model, purpose and key location — **before** it is used in the product.
