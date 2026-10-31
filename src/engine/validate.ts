import { occupiedPeriods, periodRangeLabel, validateAcademicWindow } from '../lib/time'
import type { EngineInput, Placement, Violation } from './types'
import { roomCanHostRoomType } from './input'

/**
 * Independent, deterministic validator.
 *
 * This runs *after* the solver and knows nothing about its search state. It is
 * deliberately separate so a solver bug cannot certify its own output.
 * Modelled constraints: H01–H06, H09, H12, H13, H14. H07/H08/H10/H11 need
 * source fields that are absent until the starter pack arrives (DEC-002).
 */
export function validatePlacements(input: EngineInput, placements: Placement[]): Violation[] {
  const violations: Violation[] = []
  const emitted = new Set<string>()
  const push = (code: string, message: string, sessionIds: string[], key?: string) => {
    const dedupeKey = key ?? `${code}:${message}`
    if (emitted.has(dedupeKey)) return
    emitted.add(dedupeKey)
    violations.push({ code, message, sessionIds })
  }

  const sessionById = new Map(input.sessions.map((session) => [session.id, session]))
  const roomById = new Map(input.rooms.map((room) => [room.id, room]))
  const facultyById = new Map(input.faculty.map((member) => [member.id, member]))
  const groupById = new Map(input.groups.map((group) => [group.id, group]))

  const placed = new Map<string, Placement>()
  for (const placement of placements) {
    const session = sessionById.get(placement.sessionId)
    if (!session) {
      push('H01', `Placement references unknown session "${placement.sessionId}".`, [placement.sessionId])
      continue
    }
    if (placed.has(placement.sessionId)) {
      push('H01', `${placement.sessionId} is placed more than once.`, [placement.sessionId])
      continue
    }
    placed.set(placement.sessionId, placement)
  }

  for (const session of input.sessions) {
    if (!placed.has(session.id)) {
      push('H01', `${session.id} (${session.courseCode}) is not scheduled.`, [session.id])
    }
  }

  const blockedKeys = new Set<string>()
  const blockedByKey = new Map<string, string[]>()
  for (const blocked of input.blocked) {
    for (const period of occupiedPeriods(blocked.startPeriod, blocked.periods)) {
      const key = `${blocked.roomId}|${blocked.day}|${period}`
      blockedKeys.add(key)
      const list = blockedByKey.get(key) ?? []
      list.push(blocked.bookingId)
      blockedByKey.set(key, list)
    }
  }

  const unavailableKeys = new Map<string, string>()
  for (const closure of input.roomUnavailable) {
    for (const period of occupiedPeriods(closure.startPeriod, closure.periods)) {
      unavailableKeys.set(`${closure.roomId}|${closure.day}|${period}`, closure.reason)
    }
  }

  const roomUse = new Map<string, string>()
  const facultyUse = new Map<string, string>()
  const groupUse = new Map<string, string>()
  const facultyDayLoad = new Map<string, number>()

  for (const [sessionId, placement] of placed) {
    const session = sessionById.get(sessionId)
    if (!session) continue
    const room = roomById.get(placement.roomId)
    const group = groupById.get(session.groupId)
    const faculty = facultyById.get(session.facultyId)

    if (placement.periods !== session.periods) {
      push(
        'H01',
        `${sessionId} was placed for ${placement.periods} periods but needs ${session.periods}.`,
        [sessionId],
      )
    }

    const window = validateAcademicWindow(placement.startPeriod, placement.periods)
    if (!window.ok) {
      push('H09', `${session.courseCode}: ${window.message ?? 'invalid window'}`, [sessionId])
    }

    if (session.kind === 'lab' && placement.periods !== 3) {
      push('H09', `${session.courseCode} is a lab but is scheduled for ${placement.periods} periods.`, [
        sessionId,
      ])
    }

    if (!room) {
      push('ROOM', `${session.courseCode} is placed in unknown room "${placement.roomId}".`, [sessionId])
      continue
    }
    if (!group) {
      push('GROUP', `${session.courseCode} references unknown group "${session.groupId}".`, [sessionId])
    }
    if (!faculty) {
      push('FACULTY', `${session.courseCode} references unknown faculty "${session.facultyId}".`, [
        sessionId,
      ])
    }

    if (group && room.capacity < group.size) {
      push(
        'H05',
        `${room.name} holds ${room.capacity} but ${group.name} has ${group.size} students (${session.courseCode}).`,
        [sessionId],
      )
    }

    if (!roomCanHostRoomType(room, session)) {
      push(
        'H06',
        `${session.courseCode} is a ${session.kind} but ${room.name} is a ${room.type} room.`,
        [sessionId],
      )
    }

    for (const period of occupiedPeriods(placement.startPeriod, placement.periods)) {
      const roomKey = `${placement.roomId}|${placement.day}|${period}`
      const roomHolder = roomUse.get(roomKey)
      if (roomHolder && roomHolder !== sessionId) {
        push(
          'H04',
          `${room.name} is double-booked on ${placement.day} P${period}: ${roomHolder} and ${sessionId}.`,
          [roomHolder, sessionId],
          `H04:${[roomHolder, sessionId].sort().join('|')}`,
        )
      }
      roomUse.set(roomKey, sessionId)

      if (blockedKeys.has(roomKey)) {
        const bookingIds = blockedByKey.get(roomKey) ?? []
        push(
          'H13',
          `${session.courseCode} overlaps approved booking ${bookingIds.join(', ')} in ${room.name} on ${placement.day} P${period}.`,
          [sessionId],
          `H13:${sessionId}:${bookingIds.join('|')}`,
        )
      }

      const closureReason = unavailableKeys.get(roomKey)
      if (closureReason) {
        push(
          'H08',
          `${room.name} is unavailable on ${placement.day} P${period} (${closureReason}) but ${session.courseCode} is scheduled there.`,
          [sessionId],
          `H08:${sessionId}:${roomKey}`,
        )
      }

      const facultyKey = `${session.facultyId}|${placement.day}|${period}`
      const facultyHolder = facultyUse.get(facultyKey)
      if (facultyHolder && facultyHolder !== sessionId) {
        push(
          'H02',
          `${faculty?.name ?? session.facultyId} teaches two sessions on ${placement.day} P${period}: ${facultyHolder} and ${sessionId}.`,
          [facultyHolder, sessionId],
          `H02:${[facultyHolder, sessionId].sort().join('|')}:${placement.day}:${period}`,
        )
      }
      facultyUse.set(facultyKey, sessionId)

      const groupKey = `${session.groupId}|${placement.day}|${period}`
      const groupHolder = groupUse.get(groupKey)
      if (groupHolder && groupHolder !== sessionId) {
        push(
          'H03',
          `${group?.name ?? session.groupId} has overlapping sessions on ${placement.day} P${period}: ${groupHolder} and ${sessionId}.`,
          [groupHolder, sessionId],
          `H03:${[groupHolder, sessionId].sort().join('|')}:${placement.day}:${period}`,
        )
      }
      groupUse.set(groupKey, sessionId)
    }

    const loadKey = `${session.facultyId}|${placement.day}`
    facultyDayLoad.set(loadKey, (facultyDayLoad.get(loadKey) ?? 0) + placement.periods)

    if (session.fixed) {
      const same =
        session.fixed.day === placement.day &&
        session.fixed.startPeriod === placement.startPeriod &&
        session.fixed.roomId === placement.roomId
      if (!same) {
        push(
          'H14',
          `${session.courseCode} is fixed at ${session.fixed.day} ${periodRangeLabel(session.fixed.startPeriod, session.fixed.periods)} in ${session.fixed.roomId} but was moved.`,
          [sessionId],
        )
      }
    }
  }

  for (const [key, load] of facultyDayLoad) {
    const [facultyId, day] = key.split('|')
    const faculty = facultyById.get(facultyId)
    if (!faculty) continue
    if (load > faculty.dailyLimit) {
      push(
        'H12',
        `${faculty.name} teaches ${load} periods on ${day}, above the ${faculty.dailyLimit}-period daily limit.`,
        [],
      )
    }
  }

  return violations
}
