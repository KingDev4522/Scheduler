import type { AppData, DisruptionSpec } from '../lib/store'
import type { Placement } from './types'
import { buildEngineInput } from './input'

export interface DisruptionPlan {
  input: ReturnType<typeof buildEngineInput>
  affectedSessionIds: string[]
  affectedLabels: string[]
  before: Placement[]
  summary: string
}

/**
 * Turns a disruption description into engine constraints:
 * - faculty leave closes all of that faculty's periods for the day (H07)
 * - room closure closes the room for the day (H08)
 * Only sessions that are actually affected are handed to the repair search.
 */
export function planDisruption(data: AppData, spec: DisruptionSpec): DisruptionPlan {
  const input = buildEngineInput(data)
  const affectedSessionIds: string[] = []
  const affectedLabels: string[] = []
  const before: Placement[] = []

  const take = (predicate: (session: AppData['sessions'][number]) => boolean) => {
    for (const session of data.sessions) {
      if (!predicate(session)) continue
      affectedSessionIds.push(session.id)
      affectedLabels.push(`${session.courseCode} ${session.courseName}`)
      before.push({
        sessionId: session.id,
        day: session.day,
        startPeriod: session.startPeriod,
        periods: session.periods,
        roomId: session.roomId,
      })
    }
  }

  let summary = ''

  if (spec.type === 'faculty_leave') {
    take((session) => session.facultyId === spec.facultyId && session.day === spec.day)
    const faculty = input.faculty.find((member) => member.id === spec.facultyId)
    if (faculty) {
      faculty.unavailable = [{ day: spec.day, periods: [1, 2, 3, 4, 5, 6, 7, 8, 9] }]
      summary = `${faculty.name} unavailable on ${spec.day} — ${affectedSessionIds.length} session(s) affected`
    } else {
      summary = `Unknown faculty — no sessions affected`
    }
  } else {
    take((session) => session.roomId === spec.roomId && session.day === spec.day)
    const room = input.rooms.find((item) => item.id === spec.roomId)
    if (spec.roomId) {
      input.roomUnavailable.push({
        reason: spec.description,
        roomId: spec.roomId,
        day: spec.day,
        startPeriod: 1,
        periods: 9,
      })
    }
    summary = `${room?.name ?? spec.roomId} closed on ${spec.day} — ${affectedSessionIds.length} session(s) affected`
  }

  return { input, affectedSessionIds, affectedLabels, before, summary }
}
