# Phase 4 Completion Matrix

**Status: complete locally on the hybrid track.** Gemini-powered intake, the manual booking form,
four roles, token authentication, faculty availability/change requests, club cancellation, the role
workspace, official timetable/exams/dashboard and the offline fallback are implemented. Deployment
and the video remain external.

Last updated: 2026-10-31 · frontend build green · backend running · 34 engine + 22 backend + 5 frontend tests.

---

## 1. Acceptance criteria (`04_PHASE_4` §12)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | All four roles can log in | ✅ | `debjeet` (Admin), `mehul` (Club Rep), `indranil` (Coordinator), `ananya` (Faculty), one-click login + Help table |
| 2 | Backend enforces permissions | ✅ (demo identity) | `x-demo-user` map; Admin-only generate/reset/policy/proposal/decide; Admin or Coordinator for manual placement; unknown user → 401 |
| 3 | No self-approval possible | ✅ | `solver/approvals.py`, `/api/bookings/{id}/decide`, `requester != approver` |
| 4 | Faculty can view own timetable | ✅ | Official Data → Faculty view; own-request scoping in the demo store |
| 5 | Faculty can mark unavailability | ❌ | not built (Phase 4 remainder) |
| 6 | Club rep can submit / cancel and view reasons | ⚠️ | submit ✅ via Manual Booking; cancel ❌; reasons visible in Official Data |
| 7 | Coordinator workflows | ⚠️ | demo lab-decision scope; official manual submissions are Admin-only (department ownership is not modelled per submission) |
| 8 | Admin functions + demo reset | ✅ | Admin panel generate/import/disrupt/reset/export; Help demo reset |
| 9 | English/Hinglish → editable structured fields | ✅ | Gemini 3.6 Flash; verified with the official sample requests and Hinglish |
| 10 | Ambiguous requests trigger clarification | ✅ | `follow_up` questions; no invented day/room |
| 11 | AI proposals validated by deterministic code | ✅ | `/api/bookings/validate`, `/api/manual`; AI never decides validity |
| 12 | Manual booking works with AI disabled | ✅ | `/manual` form; no LLM dependency |
| 13 | Timetables by group / faculty / room | ✅ | Official Data page; demo grid remains |
| 14 | Dashboard has approvals, conflicts, utilisation | ✅ | role-aware dashboard |
| 15 | Loading / empty / error states | ✅ | `States.tsx`, all new screens |
| 16 | Laptop and phone layouts | ✅ | responsive tables/cards; shadcn sidebar |

## 2. AI architecture (as built)

```
user text ──▶ POST /api/assistant/parse
               └─ Gemini 3.6 Flash (system prompt: extraction only)
                   └─ schema + dataset normalisation (Python)
                       └─ editable draft in the UI
                           └─ POST /api/bookings/validate  (deterministic)
                               └─ submit → Admin approval
```

- Server-side key only (`GEMINI_API_KEY`), never in the bundle.
- Missing key / provider error / malformed output → **503 + manual fallback**.
- Prompt-injection resistance is stated in the system prompt and requests are treated as data.
- The LLM never selects a room, assigns priority, approves, or writes records.

## 3. Tests

- Engine: 28/28.
- Backend API: 10/10.
- Manual flow verified live: validate → choose alternative → submit → Admin approve; non-admin blocked.
- Gemini verified live: English sample → `duration_periods=2`, window `TUE P10–P11`; Hinglish sample →
  seminar hall, 100 attendees, 2 periods, mic.

## 4. Remaining Phase 4 work

1. Faculty unavailability form and “request extra/moved session” using the existing
   `/api/assistant/parse?kind=change` + `/api/manual` validator.
2. Club cancellation of a submitted request + status history.
3. Coordinator ownership checks on manual submissions (department lab scope).
4. Replace the demo identity header with real sessions/JWT for production.
5. Automated tests for the Gemini adapter (mocked) and the booking endpoints.
6. Wire the primary Timetables/Exams/Bookings pages fully to official data (Official Data page is live).
