import {
  SEED_VERSION,
  type AppData,
  type AuditEvent,
  type Booking,
  type BookingPriority,
  type BookingStatus,
  type ChangeProposal,
  type Faculty,
  type ProposedPlacement,
  type Room,
  type RoomType,
  type Session,
  type SessionKind,
  type StudentGroup,
} from './store'
import { DAYS, spansLunch, validateAcademicWindow, type Day } from './time'

/**
 * Provisional dataset import.
 *
 * The official starter pack is absent (DEC-002), so this validates the app's
 * internal demo schema only. It exists to satisfy the Phase 1 requirement that
 * imports are repeatable and that malformed input produces actionable errors.
 * Official field names and counts remain VERIFY.
 */

export interface ImportIssue {
  path: string
  message: string
}

export interface ImportCounts {
  rooms: number
  faculty: number
  groups: number
  sessions: number
  bookings: number
  proposals: number
}

export const IMPORT_COLLECTIONS = ['rooms', 'faculty', 'groups', 'sessions', 'bookings'] as const
export type ImportCollection = (typeof IMPORT_COLLECTIONS)[number]

export interface CountTarget {
  entity: string
  expected: number
  actual: number
  ok: boolean
  /** False when the official dataset carries this collection but our model does not. */
  modelled: boolean
}

/**
 * Expected counts from `02_DATA_AND_VALIDATOR_CONTRACT.md`. Reported on every
 * import, never enforced: the importer must not drop rows to match a target.
 */
export const OFFICIAL_COUNT_TARGETS: { entity: string; expected: number; modelled: boolean }[] = [
  { entity: 'rooms', expected: 27, modelled: true },
  { entity: 'faculty', expected: 40, modelled: true },
  { entity: 'groups', expected: 14, modelled: true },
  { entity: 'sessions', expected: 189, modelled: true },
  { entity: 'bookings', expected: 25, modelled: true },
  { entity: 'courses', expected: 62, modelled: false },
  { entity: 'exams', expected: 41, modelled: false },
]

export interface ImportSummary {
  ok: boolean
  fileName: string
  sourceHash: string
  /** How the document was read. */
  sourceFormat: 'json' | 'csv'
  /** Set when a single CSV collection was merged into the current dataset. */
  collection?: ImportCollection
  counts: ImportCounts
  countTargets: CountTarget[]
  errors: ImportIssue[]
  warnings: ImportIssue[]
}

export interface ParsedImport {
  summary: ImportSummary
  data?: AppData
}

const ROOM_TYPES: RoomType[] = ['lecture', 'lab', 'seminar', 'auditorium']
const SESSION_KINDS: SessionKind[] = ['lecture', 'lab']
const BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'approved',
  'rejected',
  'alternative_offered',
  'cancelled',
]
const PRIORITIES: BookingPriority[] = [1, 2, 3]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isDay(value: unknown): value is Day {
  return typeof value === 'string' && (DAYS as readonly string[]).includes(value)
}

/** FNV-1a, used only to record which source text produced an import. */
function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function countTargetsFor(counts: ImportCounts, distinctCourses: number): CountTarget[] {
  const actualByEntity: Record<string, number> = {
    rooms: counts.rooms,
    faculty: counts.faculty,
    groups: counts.groups,
    sessions: counts.sessions,
    bookings: counts.bookings,
    courses: distinctCourses,
    exams: 0,
  }
  return OFFICIAL_COUNT_TARGETS.map((target) => {
    const actual = actualByEntity[target.entity] ?? 0
    return {
      entity: target.entity,
      expected: target.expected,
      actual,
      ok: actual === target.expected,
      modelled: target.modelled,
    }
  })
}

export function parseImportDocument(rawText: string, fileName = 'pasted.json'): ParsedImport {
  const errors: ImportIssue[] = []
  const warnings: ImportIssue[] = []
  const emptyCounts: ImportCounts = {
    rooms: 0,
    faculty: 0,
    groups: 0,
    sessions: 0,
    bookings: 0,
    proposals: 0,
  }

  const fail = (message: string): ParsedImport => ({
    summary: {
      ok: false,
      fileName,
      sourceHash: hashText(rawText),
      sourceFormat: 'json',
      counts: emptyCounts,
      countTargets: countTargetsFor(emptyCounts, 0),
      errors: [{ path: '$', message }, ...errors],
      warnings,
    },
  })

  let root: unknown
  try {
    root = JSON.parse(rawText)
  } catch (error) {
    return fail(`Invalid JSON: ${error instanceof Error ? error.message : 'could not parse file.'}`)
  }

  if (!isRecord(root)) return fail('The document root must be a JSON object.')

  for (const key of ['rooms', 'faculty', 'groups', 'sessions', 'bookings']) {
    if (!Array.isArray(root[key])) {
      errors.push({ path: key, message: `"${key}" must be an array.` })
    }
  }
  if (errors.length > 0) return fail('Missing required top-level collections.')

  const rooms: Room[] = []
  const roomIds = new Set<string>()
  for (const [index, raw] of (root.rooms as unknown[]).entries()) {
    const path = `rooms[${index}]`
    if (!isRecord(raw)) {
      errors.push({ path, message: 'Room must be an object.' })
      continue
    }
    let ok = true
    if (!isNonEmptyString(raw.id)) {
      errors.push({ path: `${path}.id`, message: 'Room id is required.' })
      ok = false
    } else if (roomIds.has(raw.id)) {
      errors.push({ path: `${path}.id`, message: `Duplicate room id "${raw.id}".` })
      ok = false
    }
    if (!isNonEmptyString(raw.name)) {
      errors.push({ path: `${path}.name`, message: 'Room name is required.' })
      ok = false
    }
    if (!isNonEmptyString(raw.building)) {
      errors.push({ path: `${path}.building`, message: 'Room building is required.' })
      ok = false
    }
    if (!isInteger(raw.capacity) || raw.capacity <= 0) {
      errors.push({ path: `${path}.capacity`, message: 'Capacity must be a positive integer.' })
      ok = false
    }
    if (typeof raw.type !== 'string' || !ROOM_TYPES.includes(raw.type as RoomType)) {
      errors.push({ path: `${path}.type`, message: `Type must be one of ${ROOM_TYPES.join(', ')}.` })
      ok = false
    }
    const features = Array.isArray(raw.features)
      ? raw.features.filter((feature): feature is string => typeof feature === 'string')
      : []
    if (!Array.isArray(raw.features)) {
      errors.push({ path: `${path}.features`, message: 'Features must be an array of strings.' })
      ok = false
    }
    if (typeof raw.accessible !== 'boolean') {
      errors.push({ path: `${path}.accessible`, message: 'Accessible must be a boolean.' })
      ok = false
    }
    if (raw.department !== undefined && typeof raw.department !== 'string') {
      errors.push({ path: `${path}.department`, message: 'Department must be a string when present.' })
      ok = false
    }
    if (!ok) continue
    roomIds.add(raw.id as string)
    rooms.push({
      id: raw.id as string,
      name: raw.name as string,
      building: raw.building as string,
      capacity: raw.capacity as number,
      type: raw.type as RoomType,
      features,
      accessible: raw.accessible as boolean,
      ...(typeof raw.department === 'string' ? { department: raw.department } : {}),
    })
  }

  const faculty: Faculty[] = []
  const facultyIds = new Set<string>()
  for (const [index, raw] of (root.faculty as unknown[]).entries()) {
    const path = `faculty[${index}]`
    if (!isRecord(raw)) {
      errors.push({ path, message: 'Faculty must be an object.' })
      continue
    }
    let ok = true
    if (!isNonEmptyString(raw.id)) {
      errors.push({ path: `${path}.id`, message: 'Faculty id is required.' })
      ok = false
    } else if (facultyIds.has(raw.id)) {
      errors.push({ path: `${path}.id`, message: `Duplicate faculty id "${raw.id}".` })
      ok = false
    }
    if (!isNonEmptyString(raw.name)) {
      errors.push({ path: `${path}.name`, message: 'Faculty name is required.' })
      ok = false
    }
    if (!isNonEmptyString(raw.department)) {
      errors.push({ path: `${path}.department`, message: 'Faculty department is required.' })
      ok = false
    }
    if (!isInteger(raw.dailyLimit) || raw.dailyLimit <= 0) {
      errors.push({ path: `${path}.dailyLimit`, message: 'Daily limit must be a positive integer.' })
      ok = false
    }
    if (!ok) continue
    facultyIds.add(raw.id as string)
    faculty.push({
      id: raw.id as string,
      name: raw.name as string,
      department: raw.department as string,
      dailyLimit: raw.dailyLimit as number,
    })
  }

  const groups: StudentGroup[] = []
  const groupIds = new Set<string>()
  for (const [index, raw] of (root.groups as unknown[]).entries()) {
    const path = `groups[${index}]`
    if (!isRecord(raw)) {
      errors.push({ path, message: 'Student group must be an object.' })
      continue
    }
    let ok = true
    if (!isNonEmptyString(raw.id)) {
      errors.push({ path: `${path}.id`, message: 'Group id is required.' })
      ok = false
    } else if (groupIds.has(raw.id)) {
      errors.push({ path: `${path}.id`, message: `Duplicate group id "${raw.id}".` })
      ok = false
    }
    if (!isNonEmptyString(raw.name)) {
      errors.push({ path: `${path}.name`, message: 'Group name is required.' })
      ok = false
    }
    if (!isInteger(raw.year) || raw.year <= 0) {
      errors.push({ path: `${path}.year`, message: 'Year must be a positive integer.' })
      ok = false
    }
    if (!isNonEmptyString(raw.branch)) {
      errors.push({ path: `${path}.branch`, message: 'Branch is required.' })
      ok = false
    }
    if (!isInteger(raw.size) || raw.size <= 0) {
      errors.push({ path: `${path}.size`, message: 'Group size must be a positive integer.' })
      ok = false
    }
    if (!ok) continue
    groupIds.add(raw.id as string)
    groups.push({
      id: raw.id as string,
      name: raw.name as string,
      year: raw.year as number,
      branch: raw.branch as string,
      size: raw.size as number,
    })
  }

  const sessions: Session[] = []
  const sessionIds = new Set<string>()
  for (const [index, raw] of (root.sessions as unknown[]).entries()) {
    const path = `sessions[${index}]`
    if (!isRecord(raw)) {
      errors.push({ path, message: 'Session must be an object.' })
      continue
    }
    let ok = true
    if (!isNonEmptyString(raw.id)) {
      errors.push({ path: `${path}.id`, message: 'Session id is required.' })
      ok = false
    } else if (sessionIds.has(raw.id)) {
      errors.push({ path: `${path}.id`, message: `Duplicate session id "${raw.id}".` })
      ok = false
    }
    for (const field of ['courseCode', 'courseName', 'facultyId', 'groupId', 'roomId'] as const) {
      if (!isNonEmptyString(raw[field])) {
        errors.push({ path: `${path}.${field}`, message: `${field} is required.` })
        ok = false
      }
    }
    if (!isDay(raw.day)) {
      errors.push({ path: `${path}.day`, message: `Day must be one of ${DAYS.join(', ')}.` })
      ok = false
    }
    if (!isInteger(raw.startPeriod) || !isInteger(raw.periods)) {
      errors.push({ path: `${path}.startPeriod`, message: 'startPeriod and periods must be integers.' })
      ok = false
    } else {
      const window = validateAcademicWindow(raw.startPeriod, raw.periods)
      if (!window.ok) {
        errors.push({ path: `${path}.startPeriod`, message: window.message ?? 'Invalid window.' })
        ok = false
      }
    }
    if (typeof raw.kind !== 'string' || !SESSION_KINDS.includes(raw.kind as SessionKind)) {
      errors.push({ path: `${path}.kind`, message: 'kind must be "lecture" or "lab".' })
      ok = false
    }
    if (!ok) continue

    if (!facultyIds.has(raw.facultyId as string)) {
      errors.push({ path: `${path}.facultyId`, message: `Unknown faculty "${raw.facultyId}".` })
      continue
    }
    if (!groupIds.has(raw.groupId as string)) {
      errors.push({ path: `${path}.groupId`, message: `Unknown group "${raw.groupId}".` })
      continue
    }
    if (!roomIds.has(raw.roomId as string)) {
      errors.push({ path: `${path}.roomId`, message: `Unknown room "${raw.roomId}".` })
      continue
    }

    const room = rooms.find((item) => item.id === raw.roomId)
    const group = groups.find((item) => item.id === raw.groupId)
    if (room && group && room.capacity < group.size) {
      warnings.push({
        path: `${path}.roomId`,
        message: `${room.name} holds ${room.capacity} but ${group.name} has ${group.size} students (H05).`,
      })
    }
    if (room && raw.kind === 'lab' && room.type !== 'lab') {
      warnings.push({
        path: `${path}.roomId`,
        message: `${room.name} is a ${room.type} room but session "${raw.id}" is a lab (H06).`,
      })
    }
    if (raw.kind === 'lab' && raw.periods !== 3) {
      warnings.push({
        path: `${path}.periods`,
        message: `Lab "${raw.id}" has ${raw.periods} periods; demo labs are 3 hours (H09).`,
      })
    }

    sessionIds.add(raw.id as string)
    sessions.push({
      id: raw.id as string,
      courseCode: raw.courseCode as string,
      courseName: raw.courseName as string,
      facultyId: raw.facultyId as string,
      groupId: raw.groupId as string,
      roomId: raw.roomId as string,
      day: raw.day as Day,
      startPeriod: raw.startPeriod as number,
      periods: raw.periods as number,
      kind: raw.kind as SessionKind,
    })
  }

  const bookings: Booking[] = []
  const bookingIds = new Set<string>()
  for (const [index, raw] of (root.bookings as unknown[]).entries()) {
    const path = `bookings[${index}]`
    if (!isRecord(raw)) {
      errors.push({ path, message: 'Booking must be an object.' })
      continue
    }
    let ok = true
    if (!isNonEmptyString(raw.id)) {
      errors.push({ path: `${path}.id`, message: 'Booking id is required.' })
      ok = false
    } else if (bookingIds.has(raw.id)) {
      errors.push({ path: `${path}.id`, message: `Duplicate booking id "${raw.id}".` })
      ok = false
    }
    for (const field of ['title', 'organizer', 'requester', 'roomId'] as const) {
      if (!isNonEmptyString(raw[field])) {
        errors.push({ path: `${path}.${field}`, message: `${field} is required.` })
        ok = false
      }
    }
    if (!isDay(raw.day)) {
      errors.push({ path: `${path}.day`, message: `Day must be one of ${DAYS.join(', ')}.` })
      ok = false
    }
    if (!isInteger(raw.startPeriod) || !isInteger(raw.periods)) {
      errors.push({ path: `${path}.startPeriod`, message: 'startPeriod and periods must be integers.' })
      ok = false
    } else {
      const window = validateAcademicWindow(raw.startPeriod, raw.periods)
      if (!window.ok) {
        errors.push({ path: `${path}.startPeriod`, message: window.message ?? 'Invalid window.' })
        ok = false
      }
      if (spansLunch(raw.startPeriod, raw.periods)) {
        errors.push({ path: `${path}.startPeriod`, message: 'Booking crosses the lunch break.' })
        ok = false
      }
    }
    if (typeof raw.priority !== 'number' || !PRIORITIES.includes(raw.priority as BookingPriority)) {
      errors.push({ path: `${path}.priority`, message: 'priority must be 1, 2 or 3.' })
      ok = false
    }
    if (typeof raw.status !== 'string' || !BOOKING_STATUSES.includes(raw.status as BookingStatus)) {
      errors.push({
        path: `${path}.status`,
        message: `status must be one of ${BOOKING_STATUSES.join(', ')}.`,
      })
      ok = false
    }
    if (!isInteger(raw.expectedAttendees) || raw.expectedAttendees <= 0) {
      errors.push({ path: `${path}.expectedAttendees`, message: 'expectedAttendees must be positive.' })
      ok = false
    }
    if (typeof raw.note !== 'string') {
      errors.push({ path: `${path}.note`, message: 'note must be a string.' })
      ok = false
    }
    if (!isFiniteNumber(raw.updatedAt)) {
      errors.push({ path: `${path}.updatedAt`, message: 'updatedAt must be a number.' })
      ok = false
    }
    if (!ok) continue

    if (!roomIds.has(raw.roomId as string)) {
      errors.push({ path: `${path}.roomId`, message: `Unknown room "${raw.roomId}".` })
      continue
    }
    const room = rooms.find((item) => item.id === raw.roomId)
    if (room && (raw.expectedAttendees as number) > room.capacity) {
      warnings.push({
        path: `${path}.expectedAttendees`,
        message: `${raw.expectedAttendees} expected vs ${room.name} capacity ${room.capacity} (H05).`,
      })
    }

    bookingIds.add(raw.id as string)
    bookings.push({
      id: raw.id as string,
      title: raw.title as string,
      organizer: raw.organizer as string,
      requester: raw.requester as string,
      roomId: raw.roomId as string,
      day: raw.day as Day,
      startPeriod: raw.startPeriod as number,
      periods: raw.periods as number,
      priority: raw.priority as BookingPriority,
      status: raw.status as BookingStatus,
      expectedAttendees: raw.expectedAttendees as number,
      note: raw.note as string,
      updatedAt: raw.updatedAt as number,
      ...(typeof raw.decidedBy === 'string' ? { decidedBy: raw.decidedBy } : {}),
      ...(isFiniteNumber(raw.decidedAt) ? { decidedAt: raw.decidedAt } : {}),
      ...(typeof raw.decisionReason === 'string' ? { decisionReason: raw.decisionReason } : {}),
    })
  }

  const proposals: ChangeProposal[] = []
  if (Array.isArray(root.proposals)) {
    for (const [index, raw] of root.proposals.entries()) {
      const path = `proposals[${index}]`
      if (!isRecord(raw)) {
        errors.push({ path, message: 'Proposal must be an object.' })
        continue
      }
      if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.title) || !isNonEmptyString(raw.requester)) {
        errors.push({ path, message: 'Proposal id, title and requester are required.' })
        continue
      }
      const before = Array.isArray(raw.before) ? (raw.before as unknown[]) : []
      const after = Array.isArray(raw.after) ? (raw.after as unknown[]) : []
      const placements: ProposedPlacement[] = []
      let placementsOk = true
      for (const [placementIndex, placement] of after.entries()) {
        if (!isRecord(placement)) {
          errors.push({ path: `${path}.after[${placementIndex}]`, message: 'Placement must be an object.' })
          placementsOk = false
          continue
        }
        if (!isNonEmptyString(placement.sessionId) || !sessionIds.has(placement.sessionId)) {
          errors.push({
            path: `${path}.after[${placementIndex}].sessionId`,
            message: `Unknown session "${String(placement.sessionId)}".`,
          })
          placementsOk = false
          continue
        }
        if (!isNonEmptyString(placement.roomId) || !roomIds.has(placement.roomId)) {
          errors.push({
            path: `${path}.after[${placementIndex}].roomId`,
            message: `Unknown room "${String(placement.roomId)}".`,
          })
          placementsOk = false
          continue
        }
        if (!isDay(placement.day) || !isInteger(placement.startPeriod)) {
          errors.push({
            path: `${path}.after[${placementIndex}]`,
            message: 'Placement day/startPeriod is invalid.',
          })
          placementsOk = false
          continue
        }
        placements.push({
          sessionId: placement.sessionId,
          day: placement.day,
          startPeriod: placement.startPeriod,
          roomId: placement.roomId,
        })
      }
      if (!placementsOk) continue
      const disruptionRaw = isRecord(raw.disruption) ? raw.disruption : null
      proposals.push({
        id: raw.id,
        title: raw.title,
        requester: raw.requester,
        route: isNonEmptyString(raw.route) ? raw.route : 'Imported proposal',
        detail: typeof raw.detail === 'string' ? raw.detail : '',
        disruption: {
          type: disruptionRaw?.type === 'room_closure' ? 'room_closure' : 'faculty_leave',
          day: isDay(disruptionRaw?.day) ? disruptionRaw.day : 'Mon',
          description:
            typeof disruptionRaw?.description === 'string'
              ? disruptionRaw.description
              : 'Imported proposal',
          ...(typeof disruptionRaw?.facultyId === 'string'
            ? { facultyId: disruptionRaw.facultyId }
            : {}),
          ...(typeof disruptionRaw?.roomId === 'string' ? { roomId: disruptionRaw.roomId } : {}),
        },
        before: Array.isArray(before)
          ? before.filter((item): item is ProposedPlacement => isRecord(item) && isNonEmptyString(item.sessionId) && isDay(item.day) && isInteger(item.startPeriod) && isNonEmptyString(item.roomId)).map((item) => ({
              sessionId: item.sessionId,
              day: item.day,
              startPeriod: item.startPeriod,
              roomId: item.roomId,
            }))
          : [],
        after: placements,
        movedCount: isInteger(raw.movedCount) ? raw.movedCount : placements.length,
        conflicts: Array.isArray(raw.conflicts)
          ? raw.conflicts.filter((item): item is string => typeof item === 'string')
          : [],
        status:
          raw.status === 'approved' || raw.status === 'rejected' || raw.status === 'pending'
            ? raw.status
            : 'pending',
        submittedAt: isFiniteNumber(raw.submittedAt) ? raw.submittedAt : Date.now(),
        ...(typeof raw.decidedBy === 'string' ? { decidedBy: raw.decidedBy } : {}),
        ...(isFiniteNumber(raw.decidedAt) ? { decidedAt: raw.decidedAt } : {}),
      })
    }
  }

  const audit: AuditEvent[] = []
  if (Array.isArray(root.audit)) {
    for (const [index, raw] of root.audit.entries()) {
      if (
        isRecord(raw) &&
        isNonEmptyString(raw.id) &&
        isNonEmptyString(raw.actor) &&
        isNonEmptyString(raw.action) &&
        isFiniteNumber(raw.at)
      ) {
        audit.push({ id: raw.id, actor: raw.actor, action: raw.action, at: raw.at })
      } else {
        warnings.push({
          path: `audit[${index}]`,
          message: 'Audit entry was skipped: id, actor, action and at are required.',
        })
      }
    }
  }

  const counts: ImportCounts = {
    rooms: rooms.length,
    faculty: faculty.length,
    groups: groups.length,
    sessions: sessions.length,
    bookings: bookings.length,
    proposals: proposals.length,
  }

  const distinctCourses = new Set(sessions.map((session) => session.courseCode)).size
  const countTargets = countTargetsFor(counts, distinctCourses)

  if (errors.length > 0) {
    return {
      summary: {
        ok: false,
        fileName,
        sourceHash: hashText(rawText),
        sourceFormat: 'json',
        counts,
        countTargets,
        errors,
        warnings,
      },
    }
  }

  return {
    summary: {
      ok: true,
      fileName,
      sourceHash: hashText(rawText),
      sourceFormat: 'json',
      counts,
      countTargets,
      errors,
      warnings,
    },
    data: {
      version: SEED_VERSION,
      rooms,
      faculty,
      groups,
      sessions,
      bookings,
      proposals,
      audit,
    },
  }
}
