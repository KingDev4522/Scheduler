/**
 * Client for the FastAPI backend (`backend/app.py`).
 * Set `VITE_API_BASE_URL` for deployment; defaults to localhost:8000.
 */

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8000'

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
  calendar: { days: string[]; periods: { id: number; start: string; end: string }[] }
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

async function request<T>(path: string, init: RequestInit = {}, user = 'debjeet'): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('x-demo-user', user)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (body.detail?.errors) detail = body.detail.errors.join('; ')
      else if (body.detail) detail = JSON.stringify(body.detail)
    } catch {
      /* keep status text */
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export const api = {
  base: API_BASE,
  health: (user = 'debjeet') => request<Health>('/api/health', {}, user),
  dataset: (user = 'debjeet') => request<DatasetInfo>('/api/dataset', {}, user),
  schedule: (user = 'debjeet') => request<ScheduleResponse>('/api/schedule', {}, user),
  generate: (user = 'debjeet') =>
    request<GenerateResult>('/api/generate', { method: 'POST' }, user),
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
}
