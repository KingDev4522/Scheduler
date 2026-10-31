# Security, Reliability and Operations PRD

## Threat model (DESIGN supporting PS)
Attack surfaces: user-submitted natural language, uploaded JSON/change files, login/roles, approval endpoints, scheduling races, exported files, LLM API, admin reset. Key risks: prompt injection, priority spoofing, IDOR, self-approval, race condition, stale proposals, denial of service through huge solve jobs, secret leakage.

## Controls
- Authenticate every write; server-side RBAC and department ownership; deny self-approval.
- Treat AI text and structured output as untrusted; schema validate; no LLM direct DB writes.
- Validate upload size/type/schema; cap solver resources and request rates; never execute uploaded code.
- Lock/version schedule during approvals; revalidate under transaction.
- Secret env vars only; `.env.example` contains names and placeholders, no credentials.
- Restrict CORS and apply HTTPS; secure cookie/session handling; audit sensitive actions.
- Protect reset endpoint to Admin demo role; require confirmation and clearly distinguish demo from live user data.
- Keep manual booking usable without LLM; show retryable failures and job status.
- Back up persistent DB; verify restore/reset and deployment persistence.

## Operational observability
Structured logs with request_id and solve_id; metrics for solve time, solver status, validation failures, API error rates, LLM fallback, import failures, booking decisions and approval outcomes. Do not log secrets or unnecessary personal data.

## Reliability acceptance
API/LLM outage does not corrupt committed schedule; concurrent approvals cannot double-book a room; solver timeout does not masquerade as impossible; failed import leaves previous state intact; exported files correspond to committed schedule version.


## Requirement provenance and decision policy
- **PS** = explicit requirement from the supplied six-page problem statement.
- **DESIGN** = proposed implementation, not an organizer mandate.
- **VERIFY** = unresolved until `cit_public.json`, starter-pack README, `validator.py`, and `sample_disruption.json` are inspected.
- Never fabricate or hand-edit generated schedules, booking decisions, exports, or demo outputs. Do not modify organizer validator files.
- All schedule/booking writes must pass deterministic hard-constraint and authorization checks. LLM output is untrusted input, never a validity oracle.
- Repository must be created after the hackathon starts; no pre-hackathon project code, purchased templates, or non-team developers. Declared AI tooling is allowed. No commits or deployment modifications after submission deadline.
