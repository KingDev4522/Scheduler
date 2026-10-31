import { DAYS, LUNCH_AFTER_PERIOD, occupiedPeriods, type Day } from '../lib/time'
import type { EngineInput, Placement } from './types'

/**
 * Provisional soft-constraint weights.
 *
 * The official validator's weights are not available (starter pack missing,
 * DEC-002), so these are demo-only heuristics. They are never presented as the
 * official score. See docs/03_SCHEDULING_SOLVER_PRD.md §"Soft constraints".
 */
export const SOFT_WEIGHTS = {
  /** S06: a session in P9. */
  p9: 5,
  /** S02: an idle period inside a group's teaching day (lunch excluded). */
  idleGap: 2,
  /** S03: each class hour above 6 in a group's day. */
  overSix: 4,
  /** S04: each repeat of the same course in a group's day. */
  repeatCourse: 3,
  /** S05: a room filled below 40%. */
  lowFill: 1,
} as const

interface DayLoad {
  occupied: Set<number>
  totalPeriods: number
  courseCounts: Map<string, number>
}

function gapCount(occupied: Set<number>, from: number, to: number): number {
  let gaps = 0
  let sawOccupied = false
  let lastOccupied = -1
  for (let period = from; period <= to; period += 1) {
    if (occupied.has(period)) {
      if (sawOccupied && period - lastOccupied > 1) {
        gaps += period - lastOccupied - 1
      }
      sawOccupied = true
      lastOccupied = period
    }
  }
  return gaps
}

export function computeSoftPenalty(input: EngineInput, placements: Placement[]): number {
  const sessionById = new Map(input.sessions.map((session) => [session.id, session]))
  const groupById = new Map(input.groups.map((group) => [group.id, group]))
  const roomById = new Map(input.rooms.map((room) => [room.id, room]))

  const byGroupDay = new Map<string, DayLoad>()
  let penalty = 0

  for (const placement of placements) {
    const session = sessionById.get(placement.sessionId)
    if (!session) continue
    const key = `${session.groupId}|${placement.day}`
    const load =
      byGroupDay.get(key) ?? { occupied: new Set<number>(), totalPeriods: 0, courseCounts: new Map() }
    for (const period of occupiedPeriods(placement.startPeriod, placement.periods)) {
      load.occupied.add(period)
      if (period === 9) penalty += SOFT_WEIGHTS.p9
    }
    load.totalPeriods += placement.periods
    load.courseCounts.set(session.courseCode, (load.courseCounts.get(session.courseCode) ?? 0) + 1)
    byGroupDay.set(key, load)

    const room = roomById.get(placement.roomId)
    const group = groupById.get(session.groupId)
    if (room && group && room.capacity > 0 && group.size / room.capacity < 0.4) {
      penalty += SOFT_WEIGHTS.lowFill
    }
  }

  for (const [key, load] of byGroupDay) {
    const day = key.split('|')[1] as Day
    if (DAYS.includes(day)) {
      penalty += gapCount(load.occupied, 1, LUNCH_AFTER_PERIOD) * SOFT_WEIGHTS.idleGap
      penalty += gapCount(load.occupied, LUNCH_AFTER_PERIOD + 1, 9) * SOFT_WEIGHTS.idleGap
    }
    if (load.totalPeriods > 6) {
      penalty += (load.totalPeriods - 6) * SOFT_WEIGHTS.overSix
    }
    for (const count of load.courseCounts.values()) {
      if (count > 1) penalty += (count - 1) * SOFT_WEIGHTS.repeatCourse
    }
  }

  return penalty
}
