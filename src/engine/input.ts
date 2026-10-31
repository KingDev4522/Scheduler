import type { AppData } from '../lib/store'
import { DAYS, spansLunch, validateAcademicWindow } from '../lib/time'
import type {
  BlockedWindow,
  EngineFaculty,
  EngineGroup,
  EngineInput,
  EngineRoom,
  EngineSession,
} from './types'

/** Adapter from the demo localStorage shape to engine contracts. */
export function buildEngineInput(data: AppData): EngineInput {
  const rooms: EngineRoom[] = data.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    type: room.type,
    accessible: room.accessible,
    features: room.features,
  }))

  const faculty: EngineFaculty[] = data.faculty.map((member) => ({
    id: member.id,
    name: member.name,
    dailyLimit: member.dailyLimit,
    unavailable: [],
  }))

  const groups: EngineGroup[] = data.groups.map((group) => ({
    id: group.id,
    name: group.name,
    size: group.size,
  }))

  const sessions: EngineSession[] = data.sessions.map((session) => ({
    id: session.id,
    courseCode: session.courseCode,
    courseName: session.courseName,
    facultyId: session.facultyId,
    groupId: session.groupId,
    periods: session.periods,
    kind: session.kind,
  }))

  const blocked: BlockedWindow[] = data.bookings
    .filter((booking) => booking.status === 'approved')
    .map((booking) => ({
      bookingId: booking.id,
      roomId: booking.roomId,
      day: booking.day,
      startPeriod: booking.startPeriod,
      periods: booking.periods,
    }))

  return { rooms, faculty, groups, sessions, blocked, roomUnavailable: [] }
}

/** All legal (day, start period) windows for a duration. */
export function candidateWindows(periods: number): { startPeriod: number; periods: number }[] {
  if (!Number.isInteger(periods) || periods < 1 || periods > 3) return []
  if (periods === 3) {
    return [
      { startPeriod: 2, periods },
      { startPeriod: 6, periods },
    ]
  }
  const windows: { startPeriod: number; periods: number }[] = []
  for (let startPeriod = 1; startPeriod <= 9; startPeriod += 1) {
    if (validateAcademicWindow(startPeriod, periods).ok) {
      windows.push({ startPeriod, periods })
    }
  }
  return windows
}

/** Demo room-compatibility policy (H05/H06). */
export function roomCanHostRoomType(room: EngineRoom, session: EngineSession): boolean {
  if (session.kind === 'lab') return room.type === 'lab'
  return room.type !== 'lab'
}

export function roomFitsGroup(room: EngineRoom, group: EngineGroup): boolean {
  return room.capacity >= group.size
}

export function facultyUnavailable(
  faculty: EngineFaculty,
  day: (typeof DAYS)[number],
  startPeriod: number,
  periods: number,
): boolean {
  return faculty.unavailable.some((unavailable) => {
    if (unavailable.day !== day) return false
    for (let offset = 0; offset < periods; offset += 1) {
      if (unavailable.periods.includes(startPeriod + offset)) return true
    }
    return false
  })
}

export function isWindowLegal(startPeriod: number, periods: number): boolean {
  const validation = validateAcademicWindow(startPeriod, periods)
  return validation.ok && !spansLunch(startPeriod, periods)
}
