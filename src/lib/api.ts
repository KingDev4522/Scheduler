/**
 * Client for the FastAPI backend (`backend/app.py`).
 * Leave `VITE_API_BASE_URL` empty for same-origin (Vite dev proxy, or FastAPI
 * serving the built SPA). Set it only when the API is on a different origin.
 */

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
/** Empty means same origin: the Vite dev proxy in dev, FastAPI in Docker. */
export const API_BASE = configuredBase ? configuredBase.replace(/\/$/, '') : ''

export interface AuthUser {
  username: string
  role: 'admin' | 'event_manager' | 'department_coordinator' | 'faculty'
  displayName: string
  department?: string | null
  initials: string
}

export interface OfficialCounts {
  rooms: number
  faculty: number
  student_groups: number
  courses: number
  sessions: number
  booking_requests: number
  exams: number
}

export interface OfficialRoom {
  id: string
  name: string
  building: string
  type: string
  capacity: number
  features: string[]
  accessible: boolean
  allowed_uses: string[]
}

export interface OfficialFaculty {
  id: string
  name: string
  department: string
  max_hours_per_day: number
  unavailable: { day: string; periods: number[] }[]
}

export interface OfficialGroup {
  id: string
  name: string
  year: number
  department: string
  size: number
}

export interface OfficialCourse {
  id: string
  title: string
  department: string
  year: number
}

export interface OfficialSession {
  id: string
  course_id: string
  kind: string
  groups: string[]
  faculty_id: string
  size: number
  duration: number
  room_types: string[]
  needs_accessible: boolean
  basket_slot: string | null
  fixed_slot: { day: string; start_period: number } | null
}

export interface OfficialRequest {
  id: string
  requester: string
  role: string
  requested_category: string
  title: string
  attendance: number
  duration_periods: number
  windows: { day: string; from_period: number; to_period: number }[]
  room_types: string[]
  needs: string[]
  requested_room: string | null
  raw_text: string
}

export interface OfficialExam {
  id: string
  course_ids: string[]
  groups: string[]
  size: number
  duration_hours: number
}

export interface OfficialEntities {
  rooms: OfficialRoom[]
  faculty: OfficialFaculty[]
  student_groups: OfficialGroup[]
  courses: OfficialCourse[]
  sessions: OfficialSession[]
  booking_requests: OfficialRequest[]
  exams: OfficialExam[]
  calendar: {
    days: string[]
    periods: { id: number; start: string; end: string; teaching?: boolean }[]
    lunch?: { after_period: number; start: string; end: string }
    lab_start_periods?: number[]
    event_only_periods?: number[]
    /** e.g. "Week 7 (Spectra '27)" — the dataset's only week-specific event label. */
    fest_week?: string | null
    exam_week?: { days: string[]; sessions: { id: string; start: string; end: string }[] }
  }
  room_unavailability?: RoomBlock[]
}

export interface RoomBlock {
  room_id: string
  day: string
  periods: number[]
  reason: string
}

export interface OccupancyEntry {
  kind: string
  title: string
  detail: string
  severity: 'blocked' | 'warning'
  periods: number[]
  owner?: string | null
  status?: string | null
  source_id?: string | null
}

export interface OccupancyCheck {
  date: string
  week: number | null
  day: string
  room_id?: string
  room_name?: string
  capacity?: number | null
  type?: string | null
  severity: 'free' | 'warning' | 'blocked'
  message: string
  entries: OccupancyEntry[]
  candidates?: {
    room_id: string
    room_name: string
    capacity: number | null
    type: string | null
    severity: 'free' | 'warning' | 'blocked'
    message: string
    entries: OccupancyEntry[]
  }[]
}

export interface AvailabilityResponse {
  checks: OccupancyCheck[]
}

export interface SessionAvailability {
  ok: boolean
  blocked: { rule: string; detail: string }[]
  warnings: string[]
  alternatives: BookingAlternative[]
  current?: [string, number, string] | null
}

export interface DatasetInfo {
  dataset_id: string
  institute: string
  source: string
  counts: OfficialCounts
  priority_order: string[]
  role_category_cap: Record<string, string>
  generated: boolean
  generated_at: string | null
  /** Derived display calendar (weeks 1–8). Null when the dataset has no dates. */
  semester: import('./semester').Semester | null
  entities: OfficialEntities
}

export interface OfficialSummary {
  hard_violation_count: number
  hard_by_rule: Record<string, number>
  soft_total: number
  soft_penalties: Record<string, number>
  bookings: {
    booking_score: number
    booking_score_max_if_all_approved: number
    approved: number
    alternatives: number
    rejected: number
    session_overrides: number
    priority_inversions: string[]
  } | null
  exam_soft_penalty: number | null
  stability: {
    sessions_moved: number
    time_changed: number
    room_only_changed: number
  } | null
}

export interface OfficialSchedule {
  team: string
  dataset_id: string
  sessions: { session_id: string; day: string; start_period: number; room_id: string }[]
  fest_week: { bookings: Record<string, unknown>[]; session_overrides: Record<string, unknown>[] }
  exams: { exam_id: string; day: string; session: string; rooms: string[] }[]
}

export interface OfficialDecision {
  request_id: string
  status: string
  day?: string
  start_period?: number
  end_period?: number
  room_id?: string
  reason?: string
}

export interface OfficialDiff {
  moved_count: number
  time_changed: number
  room_only_changed: number
  moved_minimal: boolean
  directly_affected: string[]
  added_sessions: string[]
  removed_sessions: string[]
  moved: {
    session_id: string
    before: { day: string; start_period: number; room_id: string }
    after: { day: string; start_period: number; room_id: string }
    time_changed: boolean
    room_only: boolean
  }[]
}

export interface ScheduleResponse {
  schedule: OfficialSchedule
  summary: OfficialSummary
  decisions: OfficialDecision[]
  approvals: Record<string, unknown>[]
  diff: OfficialDiff | null
  after: OfficialSchedule | null
  after_summary: OfficialSummary | null
  proposal_status: string | null
}

export interface GenerateResult {
  status: string
  generated_at: string
  sessions: number
  exams: number
  bookings: { approved: number; rejected: number; alternative: number }
  booking_score: number
  summary: OfficialSummary
  policy_version: string
}

/**
 * Background solve state. `POST /api/generate` returns 202 with `running` and
 * the client polls `/api/generate/status` until it settles.
 */
export interface GenerateJob {
  status: 'idle' | 'running' | 'complete' | 'error'
  started_at?: string | null
  finished_at?: string | null
  result?: GenerateResult | null
  error?: string | null
  generated?: boolean
  generated_at?: string | null
}

export interface DisruptionResult {
  status: string
  moved: number
  time_changed: number
  room_only_changed: number
  minimal: boolean
  diff: OfficialDiff
  bookings: { approved: number; rejected: number; alternative: number }
  summary: OfficialSummary
}

export interface Health {
  ok: boolean
  dataset_id: string | null
  source: string
  generated: boolean
  generated_at: string | null
  hard_violations: number | null
}

export interface BookingWindow {
  day: string
  from_period: number
  to_period: number
}

export interface BookingDraft {
  title: string
  /** Requester's stated why; separate from the approver's decision reason. */
  request_reason?: string
  attendance: number | null
  duration_periods: number | null
  windows: BookingWindow[]
  /** Concrete ISO dates chosen on the calendar (app-level context). */
  dates?: string[]
  room_types: string[]
  needs: string[]
  requested_room: string | null
  mandatory_for_groups: string[]
}

export interface BookingProposalPayload extends BookingDraft {
  requester?: string
  requested_category?: string | null
  day?: string | null
  start_period?: number | null
  room_id?: string | null
  raw_text?: string
}

export interface BookingAlternative {
  room_id: string
  day: string
  start_period: number
  end_period: number
  capacity: number
  type: string
}

export interface BookingValidation {
  ok: boolean
  violations: string[]
  alternatives: BookingAlternative[]
  category?: string
}

export interface MissingField {
  field: string
  question: string
  options?: string[]
}

export interface AssistantParseResult {
  source: string
  model: string
  draft: Partial<BookingDraft> & Record<string, unknown>
  follow_up: string[]
  /** Every unresolved field, in one pass. */
  missing?: MissingField[]
  /** Provider reason when the local-rules fallback ran (e.g. 429 quota). */
  fallback_reason?: string | null
}

export interface AvailabilityEntry {
  day: string
  periods: number[]
  reason?: string
}

export interface ChangeRequestRecord {
  id: string
  requester: string
  role: string
  text: string
  /** Why the requester asked for the change. */
  request_reason?: string | null
  draft: Record<string, unknown>
  follow_up: string[]
  alternatives?: {
    session_id?: string
    day: string
    start_period: number
    room_id: string
  }[]
  warnings?: string[]
  model: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  decided_by?: string | null
  decided_at?: string | null
  reason?: string | null
}

export interface BookingSubmission extends Record<string, unknown> {
  id: string
  title?: string
  requester?: string
  status: string
  submitted_at?: string
  day?: string
  start_period?: number
  end_period?: number
  room_id?: string
  /** Requester's stated why, retained after the decision. */
  request_reason?: string | null
  /** Approver's decision reason. */
  reason?: string | null
  decided_by?: string | null
  windows?: BookingWindow[]
  attendance?: number
  duration_periods?: number
  /** Concrete ISO dates for this request (app-level context). */
  dates?: string[]
  weeks?: number[]
}

async function request<T>(path: string, init: RequestInit = {}, user = 'debjeet'): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('x-demo-user', user)
  const token = localStorage.getItem('cit-scheduler:token')
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('cit-scheduler:token')
      localStorage.removeItem('cit-scheduler:session')
      window.dispatchEvent(new Event('cit-auth-expired'))
    }
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (body.detail?.errors) detail = body.detail.errors.join('; ')
      else if (body.detail) detail = JSON.stringify(body.detail)
    } catch {
      /* keep status text */
    }
    // The middleware's bare 401 is a dead session, not something the user did.
    if (response.status === 401 && detail === 'authentication required') {
      detail = 'Your session expired. Sign in again.'
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export const api = {
  base: API_BASE,
  login: (username: string, password: string) =>
    request<{ token: string; user: AuthUser }>(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      },
      username,
    ),
  me: (user = 'debjeet') => request<{ user: AuthUser }>('/api/auth/me', {}, user),
  health: (user = 'debjeet') => request<Health>('/api/health', {}, user),
  dataset: (user = 'debjeet') => request<DatasetInfo>('/api/dataset', {}, user),
  schedule: (user = 'debjeet') => request<ScheduleResponse>('/api/schedule', {}, user),
  generate: (user = 'debjeet') =>
    request<GenerateJob>('/api/generate', { method: 'POST' }, user),
  generateStatus: (user = 'debjeet') => request<GenerateJob>('/api/generate/status', {}, user),
  reset: (user = 'debjeet') => request<{ ok: boolean }>('/api/reset', { method: 'POST' }, user),
  approveProposal: (user = 'debjeet') =>
    request<{ ok: boolean; proposal_status: string }>(
      '/api/proposal/approve',
      { method: 'POST' },
      user,
    ),
  rejectProposal: (user = 'debjeet') =>
    request<{ ok: boolean; proposal_status: string }>(
      '/api/proposal/reject',
      { method: 'POST' },
      user,
    ),
  policy: (user = 'debjeet') =>
    request<{ priority_order: string[]; role_category_cap: Record<string, string>; version: string }>(
      '/api/policy',
      {},
      user,
    ),
  setPolicy: (priorityOrder: string[], user = 'debjeet') =>
    request<{ priority_order: string[]; role_category_cap: Record<string, string>; version: string }>(
      '/api/policy',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priority_order: priorityOrder }),
      },
      user,
    ),
  approve: (requestId: string, user = 'debjeet') =>
    request<{ ok: boolean }>(
      '/api/approve',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      },
      user,
    ),
  importDataset: (file: File, user = 'debjeet') => {
    const form = new FormData()
    form.append('file', file)
    return request<DatasetInfo>('/api/import', { method: 'POST', body: form }, user)
  },
  disruption: (file: File, user = 'debjeet') => {
    const form = new FormData()
    form.append('file', file)
    return request<DisruptionResult>('/api/disruption', { method: 'POST', body: form }, user)
  },
  exportUrl: (name: string) => `${API_BASE}/api/exports/${name}`,
  downloadExport: async (name: string, user = 'debjeet') => {
    const headers = new Headers({ 'x-demo-user': user })
    const token = localStorage.getItem('cit-scheduler:token')
    if (token) headers.set('authorization', `Bearer ${token}`)
    const response = await fetch(`${API_BASE}/api/exports/${name}`, { headers })
    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`
      try {
        const body = await response.json()
        if (typeof body.detail === 'string') detail = body.detail
      } catch {
        /* keep status text */
      }
      throw new Error(detail)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
  assistantStatus: (user = 'debjeet') =>
    request<{ configured: boolean; model: string; models?: string[]; fallback?: string }>(
      '/api/assistant/status',
      {},
      user,
    ),
  assistantParse: async (
    text: string,
    kind: 'booking' | 'change' = 'booking',
    user = 'debjeet',
    previousDraft?: Record<string, unknown> | null,
  ) => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 60_000)
    try {
      return await request<AssistantParseResult>(
        '/api/assistant/parse',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, kind, previous_draft: previousDraft ?? null }),
          signal: controller.signal,
        },
        user,
      )
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(
          'The assistant timed out. Try again or use the manual form; nothing was submitted.',
        )
      }
      throw error
    } finally {
      window.clearTimeout(timer)
    }
  },
  validateBooking: (payload: BookingProposalPayload, user = 'debjeet') =>
    request<BookingValidation>(
      '/api/bookings/validate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
      user,
    ),
  cancelBooking: (requestId: string, reason: string, user = 'debjeet') =>
    request<{ ok: boolean; status: string }>(
      `/api/bookings/${requestId}/cancel`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      },
      user,
    ),
  facultyAvailability: (facultyId: string | undefined, user = 'debjeet') =>
    request<{
      faculty_id: string
      name: string
      department: string
      unavailable: AvailabilityEntry[]
    }>(
      `/api/faculty/availability${facultyId ? `?faculty_id=${encodeURIComponent(facultyId)}` : ''}`,
      {},
      user,
    ),
  setFacultyAvailability: (
    unavailable: AvailabilityEntry[],
    user = 'debjeet',
    facultyId?: string,
  ) =>
    request<{
      faculty_id: string
      name: string
      department: string
      unavailable: AvailabilityEntry[]
    }>(
      '/api/faculty/availability',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ unavailable, faculty_id: facultyId }),
      },
      user,
    ),
  changeRequests: (user = 'debjeet') =>
    request<{ items: ChangeRequestRecord[] }>('/api/change-requests', {}, user),
  createChangeRequest: (
    text: string,
    user = 'debjeet',
    draft?: Record<string, unknown> | null,
    requestReason?: string | null,
  ) =>
    request<ChangeRequestRecord>(
      '/api/change-requests',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          draft: draft ?? null,
          request_reason: requestReason ?? (draft?.request_reason as string | undefined) ?? null,
        }),
      },
      user,
    ),
  changePreview: (
    text: string,
    user = 'debjeet',
    draft?: Record<string, unknown> | null,
  ) =>
    request<
      SessionAvailability & {
        draft: Record<string, unknown>
        follow_up: string[]
        model: string
      }
    >(
      '/api/change-requests/preview',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, draft: draft ?? null }),
      },
      user,
    ),
  availability: (
    payload: {
      dates: string[]
      from_period: number
      to_period: number
      room_id?: string | null
      room_types?: string[]
      attendance?: number | null
      needs?: string[]
      mandatory_for_groups?: string[]
    },
    user = 'debjeet',
  ) =>
    request<AvailabilityResponse>(
      '/api/availability',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
      user,
    ),
  sessionAvailability: (
    payload: { session_id: string; day: string; start_period: number; room_id: string },
    user = 'debjeet',
  ) =>
    request<SessionAvailability>(
      '/api/session-availability',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
      user,
    ),
  roomBlocks: (user = 'debjeet') =>
    request<{ items: RoomBlock[] }>('/api/room-blocks', {}, user),
  addRoomBlock: (block: RoomBlock, user = 'debjeet') =>
    request<{ ok: boolean; items: RoomBlock[] }>(
      '/api/room-blocks',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(block),
      },
      user,
    ),
  deleteRoomBlock: (index: number, user = 'debjeet') =>
    request<{ ok: boolean; items: RoomBlock[] }>(
      `/api/room-blocks/${index}`,
      { method: 'DELETE' },
      user,
    ),
  decideChangeRequest: (
    requestId: string,
    decision: 'approved' | 'rejected',
    reason: string,
    user = 'debjeet',
  ) =>
    request<{ ok: boolean; status: string }>(
      `/api/change-requests/${requestId}/decide`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      },
      user,
    ),
  submitBooking: (payload: BookingProposalPayload, user = 'debjeet') =>
    request<{ ok: boolean; status: string; request: BookingSubmission }>(
      '/api/bookings/submit',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
      user,
    ),
  listBookings: (user = 'debjeet') =>
    request<{ items: BookingSubmission[] }>('/api/bookings', {}, user),
  decideBookingSubmission: (
    requestId: string,
    decision: 'approved' | 'rejected',
    reason: string,
    user = 'debjeet',
  ) =>
    request<{ ok: boolean; status: string }>(
      `/api/bookings/${encodeURIComponent(requestId)}/decide`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      },
      user,
    ),
}
