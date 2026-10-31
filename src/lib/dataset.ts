import { KEYS, readJSON, removeKey, writeJSON } from './storage'

/**
 * Official Crunch Week dataset loader.
 *
 * Reads `CrunchWeek_StarterPack/data/cit_public.json` (copied to
 * `public/data/cit_public.json` so the app can fetch it) and validates it
 * against the field definitions in the starter README.
 *
 * Source of truth: `CrunchWeek_StarterPack/README.md` §"The dataset, field by field"
 * and `CrunchWeek_StarterPack/validator.py` (rule ids H1–H14, B1–B3, E1–E2).
 * Nothing here is inferred: every field name comes from the pack.
 *
 * This is separate from the demo `AppData` store. The demo seed keeps the
 * existing screens working; this dataset is the real input for the scheduler.
 */

export const DATASET_ID = 'cit-public-v1'

/** Where the app fetches the bundled copy of the official dataset. */
export const BUNDLED_DATASET_URL = '/data/cit_public.json'

export interface CalendarPeriod {
  id: number
  start: string
  end: string
  teaching: boolean
}

export interface Calendar {
  days: string[]
  periods: CalendarPeriod[]
  lunch: { after_period: number; start: string; end: string }
  lab_start_periods: number[]
  exam_week: { days: string[]; sessions: { id: string; start: string; end: string }[] }
}

export interface Room {
  id: string
  name: string
  building: string
  type: string
  capacity: number
  features: string[]
  accessible: boolean
  allowed_uses: string[]
}

export interface RoomUnavailability {
  room_id: string
  day: string
  periods: number[]
  reason: string
}

export interface FacultyPreference {
  type: string
  days?: string[]
  periods?: number[]
  note?: string
}

export interface Faculty {
  id: string
  name: string
  department: string
  max_hours_per_day: number
  needs_accessible: boolean
  unavailable: { day: string; periods: number[]; reason?: string }[]
  preferences: FacultyPreference[]
}

export interface StudentGroup {
  id: string
  name: string
  year: number
  department: string
  size: number
  needs_accessible: boolean
}

export interface Course {
  id: string
  title: string
  department: string
  year: number
  lecture_hours: number
  tutorial_hours: number
  lab_blocks: number
}

export interface FixedSlot {
  day: string
  start_period: number
}

export interface Session {
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
  fixed_slot: FixedSlot | null
}

export interface BookingWindow {
  day: string
  from_period: number
  to_period: number
}

export interface BookingRequest {
  id: string
  submitted_at: string
  requester: string
  role: string
  department: string | null
  requested_category: string
  title: string
  attendance: number
  duration_periods: number
  windows: BookingWindow[]
  room_types: string[]
  needs: string[]
  requested_room: string | null
  mandatory_for_groups: string[]
  series_id: string | null
  raw_text: string
}

export interface Cancellation {
  request_id: string
  cancelled_at: string
  by: string
  note: string
}

export interface Exam {
  id: string
  course_ids: string[]
  groups: string[]
  size: number
  duration_hours: number
}

export interface OfficialDataset {
  dataset_id: string
  institute: string
  calendar: Calendar
  priority_order: string[]
  role_category_cap: Record<string, string>
  rooms: Room[]
  room_unavailability: RoomUnavailability[]
  faculty: Faculty[]
  student_groups: StudentGroup[]
  courses: Course[]
  sessions: Session[]
  booking_requests: BookingRequest[]
  cancellations: Cancellation[]
  exams: Exam[]
}

export interface DatasetIssue {
  path: string
  message: string
}

export interface DatasetCountLine {
  entity: string
  expected: number
  actual: number
  ok: boolean
}

export interface DatasetSummary {
  ok: boolean
  datasetId: string
  institute: string
  sourceHash: string
  sourceLabel: string
  counts: DatasetCountLine[]
  errors: DatasetIssue[]
  warnings: DatasetIssue[]
}

export interface ParsedDataset {
  summary: DatasetSummary
  dataset?: OfficialDataset
}

/** Expected counts, straight from the starter README. */
const EXPECTED: { entity: string; key: keyof OfficialDataset; expected: number }[] = [
  { entity: 'rooms', key: 'rooms', expected: 27 },
  { entity: 'faculty', key: 'faculty', expected: 40 },
  { entity: 'student_groups', key: 'student_groups', expected: 14 },
  { entity: 'courses', key: 'courses', expected: 62 },
  { entity: 'sessions', key: 'sessions', expected: 189 },
  { entity: 'booking_requests', key: 'booking_requests', expected: 25 },
  { entity: 'exams', key: 'exams', expected: 41 },
]

function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item))
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

const REQUIRED_TOP_LEVEL: (keyof OfficialDataset)[] = [
  'dataset_id',
  'institute',
  'calendar',
  'priority_order',
  'role_category_cap',
  'rooms',
  'room_unavailability',
  'faculty',
  'student_groups',
  'courses',
  'sessions',
  'booking_requests',
  'cancellations',
  'exams',
]

/**
 * Validate and load the official dataset. Returns a summary on every path; the
 * typed dataset is present only when there are no errors.
 */
export function parseOfficialDataset(rawText: string, sourceLabel = 'cit_public.json'): ParsedDataset {
  const errors: DatasetIssue[] = []
  const warnings: DatasetIssue[] = []
  const sourceHash = hashText(rawText)

  const summaryWith = (
    datasetId: string,
    institute: string,
    counts: DatasetCountLine[],
  ): DatasetSummary => ({
    ok: errors.length === 0,
    datasetId,
    institute,
    sourceHash,
    sourceLabel,
    counts,
    errors,
    warnings,
  })

  let root: unknown
  try {
    root = JSON.parse(rawText)
  } catch (error) {
    errors.push({
      path: '$',
      message: `Invalid JSON: ${error instanceof Error ? error.message : 'could not parse'}`,
    })
    return { summary: summaryWith('', '', []) }
  }
  if (!isRecord(root)) {
    errors.push({ path: '$', message: 'Dataset root must be a JSON object.' })
    return { summary: summaryWith('', '', []) }
  }

  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in root)) {
      errors.push({ path: String(key), message: `Missing required top-level field "${String(key)}".` })
    }
  }
  if (errors.length > 0) return { summary: summaryWith('', '', []) }

  for (const key of ['rooms', 'room_unavailability', 'faculty', 'student_groups', 'courses', 'sessions', 'booking_requests', 'cancellations', 'exams'] as const) {
    if (!Array.isArray(root[key])) {
      errors.push({ path: key, message: `"${key}" must be an array.` })
    }
  }
  if (!isRecord(root.calendar)) errors.push({ path: 'calendar', message: 'calendar must be an object.' })
  if (!isStringArray(root.priority_order)) {
    errors.push({ path: 'priority_order', message: 'priority_order must be an array of strings.' })
  }
  if (!isRecord(root.role_category_cap)) {
    errors.push({ path: 'role_category_cap', message: 'role_category_cap must be an object.' })
  }
  if (errors.length > 0) return { summary: summaryWith('', '', []) }

  const datasetId = isNonEmptyString(root.dataset_id) ? root.dataset_id : ''
  const institute = isNonEmptyString(root.institute) ? root.institute : ''

  // -- calendar --------------------------------------------------------
  const calendarRaw = root.calendar as Record<string, unknown>
  const days = isStringArray(calendarRaw.days) ? calendarRaw.days : []
  if (days.length === 0) errors.push({ path: 'calendar.days', message: 'calendar.days is required.' })
  const periods = Array.isArray(calendarRaw.periods)
    ? calendarRaw.periods.filter(
        (period): period is CalendarPeriod =>
          isRecord(period) &&
          isInt(period.id) &&
          isNonEmptyString(period.start) &&
          isNonEmptyString(period.end) &&
          typeof period.teaching === 'boolean',
      )
    : []
  if (periods.length === 0) errors.push({ path: 'calendar.periods', message: 'calendar.periods is required.' })
  const lunchRaw = calendarRaw.lunch
  if (!isRecord(lunchRaw) || !isInt(lunchRaw.after_period)) {
    errors.push({ path: 'calendar.lunch', message: 'calendar.lunch.after_period is required.' })
  }
  const labStarts = isNumberArray(calendarRaw.lab_start_periods) ? calendarRaw.lab_start_periods : []
  if (labStarts.length === 0) {
    errors.push({ path: 'calendar.lab_start_periods', message: 'calendar.lab_start_periods is required.' })
  }
  const examWeekRaw = isRecord(calendarRaw.exam_week) ? calendarRaw.exam_week : null
  if (!examWeekRaw) {
    errors.push({ path: 'calendar.exam_week', message: 'calendar.exam_week is required.' })
  }

  // -- collections -----------------------------------------------------
  const rooms: Room[] = []
  const roomIds = new Set<string>()
  for (const [index, raw] of (root.rooms as unknown[]).entries()) {
    const path = `rooms[${index}]`
    if (!isRecord(raw)) { errors.push({ path, message: 'Room must be an object.' }); continue }
    if (!isNonEmptyString(raw.id)) { errors.push({ path: `${path}.id`, message: 'room id is required.' }); continue }
    if (roomIds.has(raw.id)) { errors.push({ path: `${path}.id`, message: `Duplicate room id "${raw.id}".` }); continue }
    if (!isNonEmptyString(raw.name) || !isNonEmptyString(raw.building) || !isNonEmptyString(raw.type)) {
      errors.push({ path, message: 'room name, building and type are required.' }); continue
    }
    if (!isInt(raw.capacity) || raw.capacity <= 0) {
      errors.push({ path: `${path}.capacity`, message: 'capacity must be a positive integer.' }); continue
    }
    if (!isStringArray(raw.allowed_uses) || raw.allowed_uses.length === 0) {
      errors.push({ path: `${path}.allowed_uses`, message: 'allowed_uses must be a non-empty string array.' }); continue
    }
    roomIds.add(raw.id)
    rooms.push({
      id: raw.id,
      name: raw.name,
      building: raw.building,
      type: raw.type,
      capacity: raw.capacity,
      features: isStringArray(raw.features) ? raw.features : [],
      accessible: raw.accessible === true,
      allowed_uses: raw.allowed_uses,
    })
  }

  const roomUnavailability: RoomUnavailability[] = []
  for (const [index, raw] of (root.room_unavailability as unknown[]).entries()) {
    const path = `room_unavailability[${index}]`
    if (!isRecord(raw) || !isNonEmptyString(raw.room_id) || !isNonEmptyString(raw.day) || !isNumberArray(raw.periods)) {
      errors.push({ path, message: 'room_unavailability needs room_id, day and periods.' }); continue
    }
    if (!roomIds.has(raw.room_id)) {
      errors.push({ path: `${path}.room_id`, message: `Unknown room "${raw.room_id}".` }); continue
    }
    roomUnavailability.push({
      room_id: raw.room_id,
      day: raw.day,
      periods: raw.periods,
      reason: isNonEmptyString(raw.reason) ? raw.reason : '',
    })
  }

  const faculty: Faculty[] = []
  const facultyIds = new Set<string>()
  for (const [index, raw] of (root.faculty as unknown[]).entries()) {
    const path = `faculty[${index}]`
    if (!isRecord(raw) || !isNonEmptyString(raw.id) || !isNonEmptyString(raw.name)) {
      errors.push({ path, message: 'faculty id and name are required.' }); continue
    }
    if (facultyIds.has(raw.id)) { errors.push({ path: `${path}.id`, message: `Duplicate faculty id "${raw.id}".` }); continue }
    if (!isInt(raw.max_hours_per_day) || raw.max_hours_per_day <= 0) {
      errors.push({ path: `${path}.max_hours_per_day`, message: 'max_hours_per_day must be a positive integer.' }); continue
    }
    facultyIds.add(raw.id)
    faculty.push({
      id: raw.id,
      name: raw.name,
      department: isNonEmptyString(raw.department) ? raw.department : '',
      max_hours_per_day: raw.max_hours_per_day,
      needs_accessible: raw.needs_accessible === true,
      unavailable: Array.isArray(raw.unavailable)
        ? raw.unavailable.filter(
            (entry): entry is { day: string; periods: number[]; reason?: string } =>
              isRecord(entry) && isNonEmptyString(entry.day) && isNumberArray(entry.periods),
          )
        : [],
      preferences: Array.isArray(raw.preferences)
        ? raw.preferences.filter((entry): entry is FacultyPreference => isRecord(entry) && isNonEmptyString(entry.type))
        : [],
    })
  }

  const groups: StudentGroup[] = []
  const groupIds = new Set<string>()
  for (const [index, raw] of (root.student_groups as unknown[]).entries()) {
    const path = `student_groups[${index}]`
    if (!isRecord(raw) || !isNonEmptyString(raw.id) || !isNonEmptyString(raw.name)) {
      errors.push({ path, message: 'group id and name are required.' }); continue
    }
    if (groupIds.has(raw.id)) { errors.push({ path: `${path}.id`, message: `Duplicate group id "${raw.id}".` }); continue }
    if (!isInt(raw.size) || raw.size <= 0) {
      errors.push({ path: `${path}.size`, message: 'group size must be a positive integer.' }); continue
    }
    groupIds.add(raw.id)
    groups.push({
      id: raw.id,
      name: raw.name,
      year: isInt(raw.year) ? raw.year : 0,
      department: isNonEmptyString(raw.department) ? raw.department : '',
      size: raw.size,
      needs_accessible: raw.needs_accessible === true,
    })
  }

  const courses: Course[] = []
  const courseIds = new Set<string>()
  for (const [index, raw] of (root.courses as unknown[]).entries()) {
    const path = `courses[${index}]`
    if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
      errors.push({ path, message: 'course id is required.' }); continue
    }
    if (courseIds.has(raw.id)) { errors.push({ path: `${path}.id`, message: `Duplicate course id "${raw.id}".` }); continue }
    courseIds.add(raw.id)
    courses.push({
      id: raw.id,
      title: isNonEmptyString(raw.title) ? raw.title : '',
      department: isNonEmptyString(raw.department) ? raw.department : '',
      year: isInt(raw.year) ? raw.year : 0,
      lecture_hours: isInt(raw.lecture_hours) ? raw.lecture_hours : 0,
      tutorial_hours: isInt(raw.tutorial_hours) ? raw.tutorial_hours : 0,
      lab_blocks: isInt(raw.lab_blocks) ? raw.lab_blocks : 0,
    })
  }

  const sessions: Session[] = []
  const sessionIds = new Set<string>()
  for (const [index, raw] of (root.sessions as unknown[]).entries()) {
    const path = `sessions[${index}]`
    if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
      errors.push({ path, message: 'session id is required.' }); continue
    }
    if (sessionIds.has(raw.id)) { errors.push({ path: `${path}.id`, message: `Duplicate session id "${raw.id}".` }); continue }
    if (!isNonEmptyString(raw.course_id) || !courseIds.has(raw.course_id)) {
      errors.push({ path: `${path}.course_id`, message: `Unknown course "${String(raw.course_id)}".` }); continue
    }
    if (!isNonEmptyString(raw.faculty_id) || !facultyIds.has(raw.faculty_id)) {
      errors.push({ path: `${path}.faculty_id`, message: `Unknown faculty "${String(raw.faculty_id)}".` }); continue
    }
    if (!isStringArray(raw.groups) || raw.groups.length === 0) {
      errors.push({ path: `${path}.groups`, message: 'groups must be a non-empty string array.' }); continue
    }
    const unknownGroup = raw.groups.find((group) => !groupIds.has(group))
    if (unknownGroup) {
      errors.push({ path: `${path}.groups`, message: `Unknown group "${unknownGroup}".` }); continue
    }
    if (!isInt(raw.duration) || raw.duration < 1) {
      errors.push({ path: `${path}.duration`, message: 'duration must be a positive integer.' }); continue
    }
    if (!isStringArray(raw.room_types) || raw.room_types.length === 0) {
      errors.push({ path: `${path}.room_types`, message: 'room_types must be a non-empty string array.' }); continue
    }
    if (!isInt(raw.size) || raw.size <= 0) {
      errors.push({ path: `${path}.size`, message: 'session size must be a positive integer.' }); continue
    }
    if (raw.kind === 'lab' && raw.duration !== 3) {
      warnings.push({ path: `${path}.duration`, message: `lab "${raw.id}" has duration ${raw.duration}; the README says labs are 3 hours.` })
    }
    sessionIds.add(raw.id)
    sessions.push({
      id: raw.id,
      course_id: raw.course_id,
      kind: isNonEmptyString(raw.kind) ? raw.kind : 'lecture',
      groups: raw.groups,
      faculty_id: raw.faculty_id,
      size: raw.size,
      duration: raw.duration,
      room_types: raw.room_types,
      needs_accessible: raw.needs_accessible === true,
      basket_slot: isNonEmptyString(raw.basket_slot) ? raw.basket_slot : null,
      fixed_slot:
        isRecord(raw.fixed_slot) && isNonEmptyString(raw.fixed_slot.day) && isInt(raw.fixed_slot.start_period)
          ? { day: raw.fixed_slot.day, start_period: raw.fixed_slot.start_period }
          : null,
    })
  }

  const bookingRequests: BookingRequest[] = []
  const bookingIds = new Set<string>()
  for (const [index, raw] of (root.booking_requests as unknown[]).entries()) {
    const path = `booking_requests[${index}]`
    if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
      errors.push({ path, message: 'booking id is required.' }); continue
    }
    if (bookingIds.has(raw.id)) { errors.push({ path: `${path}.id`, message: `Duplicate booking id "${raw.id}".` }); continue }
    if (!isNonEmptyString(raw.submitted_at) || !isNonEmptyString(raw.requester) || !isNonEmptyString(raw.role)) {
      errors.push({ path, message: 'submitted_at, requester and role are required.' }); continue
    }
    if (!isNonEmptyString(raw.requested_category) || !isNonEmptyString(raw.title)) {
      errors.push({ path, message: 'requested_category and title are required.' }); continue
    }
    if (!isInt(raw.attendance) || raw.attendance <= 0) {
      errors.push({ path: `${path}.attendance`, message: 'attendance must be a positive integer.' }); continue
    }
    if (!isInt(raw.duration_periods) || raw.duration_periods < 1) {
      errors.push({ path: `${path}.duration_periods`, message: 'duration_periods must be a positive integer.' }); continue
    }
    const windows = Array.isArray(raw.windows)
      ? raw.windows.filter(
          (window): window is BookingWindow =>
            isRecord(window) &&
            isNonEmptyString(window.day) &&
            isInt(window.from_period) &&
            isInt(window.to_period) &&
            window.from_period <= window.to_period,
        )
      : []
    if (windows.length === 0) {
      errors.push({ path: `${path}.windows`, message: 'windows must be a non-empty array.' }); continue
    }
    if (!isStringArray(raw.room_types) || raw.room_types.length === 0) {
      errors.push({ path: `${path}.room_types`, message: 'room_types must be a non-empty string array.' }); continue
    }
    if (isNonEmptyString(raw.requested_room) && !roomIds.has(raw.requested_room)) {
      warnings.push({ path: `${path}.requested_room`, message: `Requested room "${raw.requested_room}" does not exist; it is a wish only.` })
    }
    bookingIds.add(raw.id)
    bookingRequests.push({
      id: raw.id,
      submitted_at: raw.submitted_at,
      requester: raw.requester,
      role: raw.role,
      department: isNonEmptyString(raw.department) ? raw.department : null,
      requested_category: raw.requested_category,
      title: raw.title,
      attendance: raw.attendance,
      duration_periods: raw.duration_periods,
      windows,
      room_types: raw.room_types,
      needs: isStringArray(raw.needs) ? raw.needs : [],
      requested_room: isNonEmptyString(raw.requested_room) ? raw.requested_room : null,
      mandatory_for_groups: isStringArray(raw.mandatory_for_groups) ? raw.mandatory_for_groups : [],
      series_id: isNonEmptyString(raw.series_id) ? raw.series_id : null,
      raw_text: isNonEmptyString(raw.raw_text) ? raw.raw_text : '',
    })
  }

  const cancellations: Cancellation[] = []
  for (const [index, raw] of (root.cancellations as unknown[]).entries()) {
    const path = `cancellations[${index}]`
    if (!isRecord(raw) || !isNonEmptyString(raw.request_id)) {
      errors.push({ path, message: 'cancellation request_id is required.' }); continue
    }
    if (!bookingIds.has(raw.request_id)) {
      errors.push({ path: `${path}.request_id`, message: `Cancellation for unknown request "${raw.request_id}".` }); continue
    }
    cancellations.push({
      request_id: raw.request_id,
      cancelled_at: isNonEmptyString(raw.cancelled_at) ? raw.cancelled_at : '',
      by: isNonEmptyString(raw.by) ? raw.by : '',
      note: isNonEmptyString(raw.note) ? raw.note : '',
    })
  }

  const exams: Exam[] = []
  const examIds = new Set<string>()
  for (const [index, raw] of (root.exams as unknown[]).entries()) {
    const path = `exams[${index}]`
    if (!isRecord(raw) || !isNonEmptyString(raw.id)) {
      errors.push({ path, message: 'exam id is required.' }); continue
    }
    if (examIds.has(raw.id)) { errors.push({ path: `${path}.id`, message: `Duplicate exam id "${raw.id}".` }); continue }
    const courseRefs = isStringArray(raw.course_ids) ? raw.course_ids : []
    const unknownCourse = courseRefs.find((course) => !courseIds.has(course))
    if (unknownCourse) {
      errors.push({ path: `${path}.course_ids`, message: `Unknown course "${unknownCourse}".` }); continue
    }
    if (!isStringArray(raw.groups) || raw.groups.length === 0) {
      errors.push({ path: `${path}.groups`, message: 'exam groups must be a non-empty string array.' }); continue
    }
    if (!isInt(raw.size) || raw.size <= 0) {
      errors.push({ path: `${path}.size`, message: 'exam size must be a positive integer.' }); continue
    }
    examIds.add(raw.id)
    exams.push({
      id: raw.id,
      course_ids: courseRefs,
      groups: raw.groups,
      size: raw.size,
      duration_hours: isInt(raw.duration_hours) ? raw.duration_hours : 2,
    })
  }

  const counts: DatasetCountLine[] = EXPECTED.map((target) => {
    const actual = (root[target.key] as unknown[]).length
    return { entity: target.entity, expected: target.expected, actual, ok: actual === target.expected }
  })

  const summary = summaryWith(datasetId, institute, counts)
  if (errors.length > 0) return { summary }

  const dataset: OfficialDataset = {
    dataset_id: datasetId,
    institute,
    calendar: {
      days,
      periods,
      lunch: {
        after_period: (lunchRaw as Record<string, unknown>).after_period as number,
        start: isNonEmptyString((lunchRaw as Record<string, unknown>).start) ? ((lunchRaw as Record<string, unknown>).start as string) : '',
        end: isNonEmptyString((lunchRaw as Record<string, unknown>).end) ? ((lunchRaw as Record<string, unknown>).end as string) : '',
      },
      lab_start_periods: labStarts,
      exam_week: {
        days: examWeekRaw && isStringArray(examWeekRaw.days) ? examWeekRaw.days : [],
        sessions:
          examWeekRaw && Array.isArray(examWeekRaw.sessions)
            ? examWeekRaw.sessions.filter(
                (session): session is { id: string; start: string; end: string } =>
                  isRecord(session) && isNonEmptyString(session.id) && isNonEmptyString(session.start) && isNonEmptyString(session.end),
              )
            : [],
      },
    },
    priority_order: root.priority_order as string[],
    role_category_cap: root.role_category_cap as Record<string, string>,
    rooms,
    room_unavailability: roomUnavailability,
    faculty,
    student_groups: groups,
    courses,
    sessions,
    booking_requests: bookingRequests,
    cancellations,
    exams,
  }

  return { summary, dataset }
}

/* ------------------------------------------------------------------ */
/* Persistence                                                          */
/* ------------------------------------------------------------------ */

export interface StoredDataset {
  dataset: OfficialDataset
  summary: DatasetSummary
  loadedAt: number
  loadedBy: string
}

export function saveStoredDataset(
  dataset: OfficialDataset,
  summary: DatasetSummary,
  loadedBy: string,
): StoredDataset {
  const record: StoredDataset = { dataset, summary, loadedAt: Date.now(), loadedBy }
  writeJSON(KEYS.dataset, record)
  return record
}

export function readStoredDataset(): StoredDataset | null {
  return readJSON<StoredDataset | null>(KEYS.dataset, null)
}

export function clearStoredDataset(): void {
  removeKey(KEYS.dataset)
}
