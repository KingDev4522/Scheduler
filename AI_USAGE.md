# AI Usage Declaration

Required by the problem statement (`12_DEPLOYMENT_SUBMISSION_PRD.md` §AI_USAGE). Every AI system
used to build or run the project is listed here.

## 1. AI used during development

| Tool | Purpose | Where it helped |
|---|---|---|
| **Command Code** (agentic coding assistant) | Code generation and review during development | Scaffolded the React/Vite app, implemented the TypeScript demo engine and the Python CP-SAT engine, wrote the Phase 1 contracts, backend API, tests and documentation. |
| Organizer starter pack | Authoritative specification and validator | **Not AI** — organizer-supplied files, unmodified. |

## 2. AI in the product at runtime

| Provider | Model | Purpose | Where |
|---|---|---|---|
| Google Gemini API | `gemini-3.6-flash` (overridable with `GEMINI_MODEL`) | Converts an English/Hinglish venue request into a structured, editable booking draft, and a schedule-change request into a structured change draft. | `backend/assistant.py`, called by `POST /api/assistant/parse` |

**Boundaries enforced in code:**

- The model runs **server-side only**. `GEMINI_API_KEY` lives in the git-ignored `.env` (or the
  deployment secret store); it is never bundled into the frontend.
- The model is an **extractor, not a validator**. Its output is schema-checked in Python
  (`BookingDraftModel` / `ChangeDraftModel`), normalised against the official dataset, and then passed
  to the deterministic validator (`solver/booking_validation.py` / `solver/manual.py`). The model can
  never approve, prioritise, select a room or bypass a hard constraint.
- Requests are treated as untrusted data. The system prompt explicitly instructs the model to ignore
  instructions embedded in the request text (prompt-injection resistance).
- If the key is missing, the provider errors, every model in the fallback chain fails, or the output
  is malformed, a **deterministic local rules parser** produces the booking/change draft and marks it
  `source: local-rules`; the Manual Booking form and every other workflow keep working. The API only
  returns 503 if both the provider chain and the local parser fail.
- The user reviews and edits every extracted field before submission. A schema-valid draft is not a
  valid booking.

The system prompt is stored in `backend/assistant.py` (`SYSTEM_PROMPT`, `BOOKING_PROMPT`,
`CHANGE_PROMPT`) and is versioned with the code.

## 3. Prohibited AI responsibilities

The LLM must not:

- decide whether a schedule or booking is valid;
- override hard constraints or invent availability;
- set priority or category from user text;
- approve its own or anyone's proposal;
- write authoritative schedule/booking records;
- fabricate conflict explanations.

Manual workflows must work with the AI provider disabled (`04_PHASE_4_AI_AUTH_FRONTEND.md` §5).

## 4. Keys and prompts

- `GEMINI_API_KEY` is provided via environment; `.env` is git-ignored and `.env.example` contains a
  blank placeholder only.
- No prompt files are shipped to the browser; prompts live in server code.
- **Operational note:** the key used during this build was shared in chat and should be rotated before
  submission.

## 5. Provider configuration

```
GEMINI_API_KEY=<server-side only>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_MODELS=gemini-3.6-flash,gemini-3.8-flash,gemini-3.5-flash,gemini-2.5-flash
```

Any future provider (OpenAI-compatible, etc.) must be declared here with its model, purpose and key
location before use.
