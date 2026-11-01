import {
  canDecideBooking,
  type Actor,
  type AppData,
  type Booking,
  type Faculty,
  type Room,
  type Session,
  type StudentGroup,
} from './store'
import type { SessionUser } from './auth'
import {
  DAYS,
  LAST_ACADEMIC_PERIOD,
  LUNCH_AFTER_PERIOD,
  dayIndex,
  occupiedPeriods,
  periodRangeLabel,
  periodsOverlap,
  validateAcademicWindow,
  type Day,
} from './time'

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function roomById(data: AppData, id: string): Room | undefined {
  return data.rooms.find((room) => room.id === id)
}

export function facultyById(data: AppData, id: string): Faculty | undefined {
  return data.faculty.find((member) => member.id === id)
}

export function groupById(data: AppData, id: string): StudentGroup | undefined {
  return data.groups.find((group) => group.id === id)
}

export function bookingLocation(data: AppData, booking: Booking): string {
  const room = roomById(data, booking.roomId)
  return `${room?.name ?? booking.roomId} · ${booking.day} ${periodRangeLabel(booking.startPeriod, booking.periods)}`
}

export function sessionWindowLabel(session: Session): string {
  return `${session.day} ${periodRangeLabel(session.startPeriod, session.periods)}`
}

/* ------------------------------------------------------------------ */
/* Booking visibility and decisions                                    */
/* ------------------------------------------------------------------ */

/** Club representatives and faculty see only their own requests; approvers see everything. */
export function visibleBookings(data: AppData, user: SessionUser): Booking[] {
  if (user.role === 'event_manager' || user.role === 'faculty') {
    return data.bookings.filter((booking) => booking.requester === user.username)
  }
  return data.bookings
}

export function bookingDecisionPermission(
  data: AppData,
  booking: Booking,
  actor: Actor,
): ReturnType<typeof canDecideBooking> {
  return canDecideBooking(booking, actor, data.rooms)
}

export interface PendingDecision {
  kind: 'booking' | 'change'
  id: string
  title: string
  requester: string
  detail: string
  /** Why the requester asked (ad-hoc bookings); shown before deciding. */
  requestReason?: string
  conflicts: string[]
  submittedAt: number
  canDecide: boolean
  blockedReason?: string
}

/**
 * The single queue used by the dashboard: pending bookings plus pending change
 * proposals, each carrying whether this actor may decide it and why not.
 */
export function pendingDecisions(data: AppData, user: SessionUser): PendingDecision[] {
  const items: PendingDecision[] = []
  const conflicts = derivedConflicts(data)
  const ownOnly = user.role === 'event_manager' || user.role === 'faculty'

  for (const booking of data.bookings) {
    if (booking.status !== 'pending') continue
    if (ownOnly && booking.requester !== user.username) continue
    const permission = bookingDecisionPermission(data, booking, user)
    const bookingConflicts = conflicts
      .filter((conflict) => conflict.bookingIds?.includes(booking.id))
      .map((conflict) => conflict.title)
    items.push({
      kind: 'booking',
      id: booking.id,
      title: booking.title,
      requester: booking.requester,
      detail: `${booking.organizer} · ${bookingLocation(data, booking)} · ${booking.expectedAttendees} expected`,
      requestReason: booking.requestReason,
      conflicts: bookingConflicts,
      submittedAt: booking.updatedAt,
      canDecide: permission.allowed,
      blockedReason: permission.allowed ? undefined : permission.reason,
    })
  }

  for (const proposal of data.proposals) {
    if (proposal.status !== 'pending') continue
    if (ownOnly && proposal.requester !== user.username) continue
    const canDecide = user.role === 'admin' && proposal.requester !== user.username
    items.push({
      kind: 'change',
      id: proposal.id,
      title: proposal.title,
      requester: proposal.requester,
      detail: `${proposal.route} · ${proposal.detail} · ${proposal.movedCount} session(s) moved`,
      conflicts: proposal.conflicts,
      submittedAt: proposal.submittedAt,
      canDecide,
      blockedReason: canDecide
        ? undefined
        : user.role === 'admin'
          ? 'You cannot decide your own proposal.'
          : 'Change proposals are Admin-only.',
    })
  }

  return items.sort((a, b) => b.submittedAt - a.submittedAt)
}

/* ------------------------------------------------------------------ */
/* Deterministic conflict derivation                                   */
/* ------------------------------------------------------------------ */

export interface DerivedConflict {
  id: string
  /** Hard-constraint code from docs/03_SCHEDULING_SOLVER_PRD.md where known. */
  code: string
  title: string
  detail: string
  severity: 'critical' | 'warning'
  bookingIds?: string[]
  sessionIds?: string[]
}

const OCCUPYING_BOOKING_STATUSES: Booking['status'][] = ['approved', 'pending']

function overlaps(a: { day: Day; startPeriod: number; periods: number }, b: { day: Day; startPeriod: number; periods: number }): boolean {
  return (
    a.day === b.day &&
    periodsOverlap(a.startPeriod, a.periods, b.startPeriod, b.periods)
  )
}

function facultyLabel(data: AppData, id: string): string {
  return facultyById(data, id)?.name ?? id
}

function groupLabel(data: AppData, id: string): string {
  return groupById(data, id)?.name ?? id
}

/**
 * Recomputes every detectable hard-constraint issue from the current data.
 * This is a demo-level check, not the official validator (DEC-002).
 */
export function derivedConflicts(data: AppData): DerivedConflict[] {
  const conflicts: DerivedConflict[] = []
  const seen = new Set<string>()
  const push = (conflict: DerivedConflict) => {
    if (seen.has(conflict.id)) return
    seen.add(conflict.id)
    conflicts.push(conflict)
  }

  const active = data.bookings.filter((booking) => booking.status !== 'cancelled')

  // Booking windows, rooms and capacity.
  for (const booking of active) {
    const room = roomById(data, booking.roomId)
    if (!room) {
      push({
        id: `BOOKING-ROOM-${booking.id}`,
        code: 'ROOM',
        title: `${booking.id} references an unknown room`,
        detail: `Room "${booking.roomId}" does not exist in the current dataset.`,
        severity: 'critical',
        bookingIds: [booking.id],
      })
      continue
    }

    const window = validateAcademicWindow(booking.startPeriod, booking.periods)
    if (!window.ok) {
      push({
        id: `BOOKING-WINDOW-${booking.id}`,
        code: window.code ?? 'WINDOW',
        title: `${booking.id} has an invalid time window`,
        detail: window.message ?? 'Invalid period window.',
        severity: 'critical',
        bookingIds: [booking.id],
      })
    }

    if (booking.expectedAttendees > room.capacity) {
      push({
        id: `BOOKING-CAPACITY-${booking.id}`,
        code: 'H05',
        title: `${booking.id} exceeds ${room.name} capacity`,
        detail: `${booking.expectedAttendees} attendees vs capacity ${room.capacity}.`,
        severity: 'critical',
        bookingIds: [booking.id],
      })
    }
  }

  // Booking vs teaching session (H13 for approved, a request clash for pending).
  for (const booking of active) {
    if (!OCCUPYING_BOOKING_STATUSES.includes(booking.status)) continue
    for (const session of data.sessions) {
      if (session.roomId !== booking.roomId) continue
      if (!overlaps(booking, session)) continue
      push({
        id: `BOOKING-SESSION-${booking.id}-${session.id}`,
        code: booking.status === 'approved' ? 'H13' : 'H04',
        title: `${booking.id} clashes with ${session.courseCode} in ${roomById(data, booking.roomId)?.name ?? booking.roomId}`,
        detail: `${booking.title} (${booking.day} ${periodRangeLabel(booking.startPeriod, booking.periods)}) overlaps ${session.courseCode} ${sessionWindowLabel(session)} for ${groupLabel(data, session.groupId)}.`,
        severity: booking.status === 'approved' ? 'critical' : 'warning',
        bookingIds: [booking.id],
        sessionIds: [session.id],
      })
    }
  }

  // Booking vs booking within the same room.
  for (let i = 0; i < active.length; i += 1) {
    const a = active[i]
    if (!OCCUPYING_BOOKING_STATUSES.includes(a.status)) continue
    for (let j = i + 1; j < active.length; j += 1) {
      const b = active[j]
      if (!OCCUPYING_BOOKING_STATUSES.includes(b.status)) continue
      if (a.roomId !== b.roomId || !overlaps(a, b)) continue
      const ids = [a.id, b.id].sort()
      const approvedCount = [a, b].filter((booking) => booking.status === 'approved').length
      push({
        id: `BOOKING-BOOKING-${ids[0]}-${ids[1]}`,
        code: approvedCount > 0 ? 'H13' : 'H04',
        title: `${ids[0]} and ${ids[1]} overlap in ${roomById(data, a.roomId)?.name ?? a.roomId}`,
        detail: `${a.title} (${a.day} ${periodRangeLabel(a.startPeriod, a.periods)}) overlaps ${b.title} (${b.day} ${periodRangeLabel(b.startPeriod, b.periods)}). Priority decides which request can stand.`,
        severity: approvedCount > 0 ? 'critical' : 'warning',
        bookingIds: ids,
      })
    }
  }

  // Session vs session.
  for (let i = 0; i < data.sessions.length; i += 1) {
    const a = data.sessions[i]
    for (let j = i + 1; j < data.sessions.length; j += 1) {
      const b = data.sessions[j]
      if (!overlaps(a, b)) continue
      if (a.roomId === b.roomId) {
        push({
          id: `SESSION-ROOM-${a.id}-${b.id}`,
          code: 'H04',
          title: `Room double-booking: ${roomById(data, a.roomId)?.name ?? a.roomId}`,
          detail: `${a.courseCode} (${groupLabel(data, a.groupId)}) and ${b.courseCode} (${groupLabel(data, b.groupId)}) both occupy ${a.day} ${periodRangeLabel(a.startPeriod, a.periods)}.`,
          severity: 'critical',
          sessionIds: [a.id, b.id],
        })
      }
      if (a.facultyId === b.facultyId) {
        push({
          id: `SESSION-FACULTY-${a.id}-${b.id}`,
          code: 'H02',
          title: `Faculty double-booking: ${facultyLabel(data, a.facultyId)}`,
          detail: `${a.courseCode} and ${b.courseCode} overlap on ${a.day} ${periodRangeLabel(a.startPeriod, a.periods)}.`,
          severity: 'critical',
          sessionIds: [a.id, b.id],
        })
      }
      if (a.groupId === b.groupId) {
        push({
          id: `SESSION-GROUP-${a.id}-${b.id}`,
          code: 'H03',
          title: `Student-group overlap: ${groupLabel(data, a.groupId)}`,
          detail: `${a.courseCode} and ${b.courseCode} both claim ${a.day} ${periodRangeLabel(a.startPeriod, a.periods)}.`,
          severity: 'critical',
          sessionIds: [a.id, b.id],
        })
      }
    }
  }

  // Static feasibility of each session.
  for (const session of data.sessions) {
    const room = roomById(data, session.roomId)
    const group = groupById(data, session.groupId)

    const window = validateAcademicWindow(session.startPeriod, session.periods)
    if (!window.ok) {
      push({
        id: `SESSION-WINDOW-${session.id}`,
        code: window.code ?? 'WINDOW',
        title: `${session.courseCode} has an invalid time window`,
        detail: window.message ?? 'Invalid period window.',
        severity: 'critical',
        sessionIds: [session.id],
      })
    }

    if (!room) {
      push({
        id: `SESSION-ROOM-MISSING-${session.id}`,
        code: 'ROOM',
        title: `${session.courseCode} references a missing room`,
        detail: `Room "${session.roomId}" does not exist.`,
        severity: 'critical',
        sessionIds: [session.id],
      })
      continue
    }

    if (group && room.capacity < group.size) {
      push({
        id: `SESSION-CAPACITY-${session.id}`,
        code: 'H05',
        title: `${room.name} is too small for ${group.name}`,
        detail: `${session.courseCode} expects ${group.size} students, room capacity ${room.capacity}.`,
        severity: 'critical',
        sessionIds: [session.id],
      })
    }

    if (session.kind === 'lab' && room.type !== 'lab') {
      push({
        id: `SESSION-TYPE-${session.id}`,
        code: 'H06',
        title: `${session.courseCode} lab is not in a lab room`,
        detail: `${room.name} is a ${room.type} room.`,
        severity: 'critical',
        sessionIds: [session.id],
      })
    }
  }

  // Faculty daily teaching limit (H12).
  const load = new Map<string, number>()
  for (const session of data.sessions) {
    const key = `${session.facultyId}:${session.day}`
    load.set(key, (load.get(key) ?? 0) + session.periods)
  }
  for (const [key, periods] of load) {
    const [facultyId, day] = key.split(':')
    const limit = facultyById(data, facultyId)?.dailyLimit
    if (limit !== undefined && periods > limit) {
      push({
        id: `SESSION-LIMIT-${facultyId}-${day}`,
        code: 'H12',
        title: `${facultyLabel(data, facultyId)} exceeds the daily limit on ${day}`,
        detail: `${periods} periods scheduled against a limit of ${limit}.`,
        severity: 'critical',
      })
    }
  }

  return conflicts
}

/* ------------------------------------------------------------------ */
/* Room availability and utilisation                                   */
/* ------------------------------------------------------------------ */

export interface OccupancySegment {
  id: string
  label: string
  startPeriod: number
  periods: number
  source: 'session' | 'booking'
}

export interface RoomAvailability {
  segments: OccupancySegment[]
  occupied: Set<number>
  freeWindows: { startPeriod: number; periods: number }[]
}

/** Only approved bookings block a room; pending requests do not. */
export function roomAvailability(data: AppData, roomId: string, day: Day): RoomAvailability {
  const segments: OccupancySegment[] = []

  for (const session of data.sessions) {
    if (session.roomId !== roomId || session.day !== day) continue
    segments.push({
      id: session.id,
      label: session.courseCode,
      startPeriod: session.startPeriod,
      periods: session.periods,
      source: 'session',
    })
  }

  for (const booking of data.bookings) {
    if (booking.roomId !== roomId || booking.day !== day) continue
    if (booking.status !== 'approved') continue
    segments.push({
      id: booking.id,
      label: booking.title,
      startPeriod: booking.startPeriod,
      periods: booking.periods,
      source: 'booking',
    })
  }

  segments.sort((a, b) => a.startPeriod - b.startPeriod)

  const occupied = new Set<number>()
  for (const segment of segments) {
    for (const period of occupiedPeriods(segment.startPeriod, segment.periods)) {
      if (period >= 1 && period <= LAST_ACADEMIC_PERIOD) occupied.add(period)
    }
  }

  const freeWindows: { startPeriod: number; periods: number }[] = []
  for (let period = 1; period <= 9; period += 1) {
    if (occupied.has(period)) continue
    const previous = freeWindows[freeWindows.length - 1]
    const continuesWindow =
      previous !== undefined &&
      previous.startPeriod + previous.periods === period &&
      period !== LUNCH_AFTER_PERIOD + 1
    if (continuesWindow) {
      previous.periods += 1
    } else {
      freeWindows.push({ startPeriod: period, periods: 1 })
    }
  }

  return { segments, occupied, freeWindows }
}

export function freeWindowLabel(freeWindows: { startPeriod: number; periods: number }[]): string {
  if (freeWindows.length === 0) return 'Fully booked'
  return freeWindows.map((window) => periodRangeLabel(window.startPeriod, window.periods)).join(', ')
}

export interface RoomUtilisation {
  room: Room
  percent: number
  occupiedPeriods: number
  capacityPeriods: number
}

/** Utilisation over the 5-day × 9-period academic week. */
export function roomUtilisation(data: AppData): RoomUtilisation[] {
  const capacityPeriods = DAYS.length * 9
  return data.rooms.map((room) => {
    const occupied = new Set<string>()
    for (const session of data.sessions) {
      if (session.roomId !== room.id) continue
      for (const period of occupiedPeriods(session.startPeriod, session.periods)) {
        occupied.add(`${session.day}:${period}`)
      }
    }
    for (const booking of data.bookings) {
      if (booking.roomId !== room.id || booking.status !== 'approved') continue
      for (const period of occupiedPeriods(booking.startPeriod, booking.periods)) {
        occupied.add(`${booking.day}:${period}`)
      }
    }
    return {
      room,
      occupiedPeriods: occupied.size,
      capacityPeriods,
      percent: Math.round((occupied.size / capacityPeriods) * 100),
    }
  })
}

export function averageUtilisation(data: AppData): number {
  const rows = roomUtilisation(data)
  if (rows.length === 0) return 0
  return Math.round(rows.reduce((sum, row) => sum + row.percent, 0) / rows.length)
}

/* ------------------------------------------------------------------ */
/* Dashboard stats                                                     */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  pendingDecisions: number
  actionableDecisions: number
  spectraActive: number
  spectraPending: number
  myRequests: number
  myApproved: number
  myRejected: number
  myPending: number
  conflicts: number
  averageUtilisation: number
}

export function dashboardStats(data: AppData, user: SessionUser): DashboardStats {
  const queue = pendingDecisions(data, user)
  const activeBookings = data.bookings.filter((booking) => booking.status !== 'cancelled')
  const mine = data.bookings.filter((booking) => booking.requester === user.username)
  return {
    pendingDecisions: queue.length,
    actionableDecisions: queue.filter((item) => item.canDecide).length,
    spectraActive: activeBookings.length,
    spectraPending: activeBookings.filter((booking) => booking.status === 'pending').length,
    myRequests: mine.length,
    myApproved: mine.filter((booking) => booking.status === 'approved').length,
    myRejected: mine.filter(
      (booking) => booking.status === 'rejected' || booking.status === 'alternative_offered',
    ).length,
    myPending: mine.filter((booking) => booking.status === 'pending').length,
    conflicts: derivedConflicts(data).length,
    averageUtilisation: averageUtilisation(data),
  }
}

/* ------------------------------------------------------------------ */
/* Timetable views                                                     */
/* ------------------------------------------------------------------ */

export type TimetableView = 'group' | 'faculty' | 'room'

export const TIMETABLE_VIEWS: { id: TimetableView; label: string }[] = [
  { id: 'group', label: 'Student group' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'room', label: 'Room' },
]

export function viewOptions(
  data: AppData,
  view: TimetableView,
): { id: string; label: string }[] {
  if (view === 'group') return data.groups.map((group) => ({ id: group.id, label: group.name }))
  if (view === 'faculty') return data.faculty.map((member) => ({ id: member.id, label: member.name }))
  return data.rooms.map((room) => ({ id: room.id, label: room.name }))
}

export function sessionsForView(data: AppData, view: TimetableView, id: string): Session[] {
  return data.sessions
    .filter((session) => {
      if (view === 'group') return session.groupId === id
      if (view === 'faculty') return session.facultyId === id
      return session.roomId === id
    })
    .sort((a, b) => {
      const dayDelta = dayIndex(a.day) - dayIndex(b.day)
      return dayDelta !== 0 ? dayDelta : a.startPeriod - b.startPeriod
    })
}

/** Conflicts touching the selected timetable entity. */
export function conflictsForView(
  data: AppData,
  view: TimetableView,
  id: string,
): DerivedConflict[] {
  const sessionIds = new Set(data.sessions.filter((session) => {
    if (view === 'group') return session.groupId === id
    if (view === 'faculty') return session.facultyId === id
    return session.roomId === id
  }).map((session) => session.id))

  return derivedConflicts(data).filter((conflict) => {
    if (conflict.sessionIds?.some((sessionId) => sessionIds.has(sessionId))) return true
    if (view !== 'room' || !conflict.bookingIds) return false
    return conflict.bookingIds.some(
      (bookingId) => data.bookings.find((booking) => booking.id === bookingId)?.roomId === id,
    )
  })
}

/** Sessions that overlap another session in the same room, day and window. */
export function overlappingSessionPairs(
  sessions: Session[],
): { a: Session; b: Session; reason: string }[] {
  const pairs: { a: Session; b: Session; reason: string }[] = []
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      const a = sessions[i]
      const b = sessions[j]
      if (a.day !== b.day) continue
      if (!periodsOverlap(a.startPeriod, a.periods, b.startPeriod, b.periods)) continue
      const reasons: string[] = []
      if (a.roomId === b.roomId) reasons.push('room')
      if (a.facultyId === b.facultyId) reasons.push('faculty')
      if (a.groupId === b.groupId) reasons.push('group')
      if (reasons.length === 0) continue
      pairs.push({ a, b, reason: reasons.join(' + ') })
    }
  }
  return pairs
}

export function groupDailyLoad(data: AppData, groupId: string, day: Day): number {
  return data.sessions
    .filter((session) => session.groupId === groupId && session.day === day)
    .reduce((sum, session) => sum + session.periods, 0)
}
