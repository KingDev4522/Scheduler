import {
  SEED_VERSION,
  type AppData,
  type Booking,
  type BookingPriority,
  type BookingStatus,
  type Faculty,
  type Room,
  type RoomType,
  type Session,
  type StudentGroup,
} from './store'
import type { DatasetInfo, OfficialDecision, ScheduleResponse } from './api'

const DAY_MAP: Record<string, Session['day']> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
}

const DAY_ORDER: Session['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function toDemoDay(day: string): Session['day'] {
  return DAY_MAP[day] ?? 'Mon'
}

function toRoomType(type: string): RoomType {
  if (type.startsWith('lab_') || type === 'workshop') return 'lab'
  if (type === 'auditorium') return 'auditorium'
  if (type === 'seminar_hall') return 'seminar'
  return 'lecture'
}

function toPriority(category: string): BookingPriority {
  if (category === 'institute_event') return 1
  if (category === 'club_event') return 3
  return 2
}

export interface OfficialView {
  data: AppData
  groupsBySession: Map<string, string[]>
}

/**
 * Adapt the official dataset + generated schedule into the app's view model so
 * the existing grid, badges and tables can render it without a second UI stack.
 */
export function buildOfficialView(dataset: DatasetInfo, schedule: ScheduleResponse): OfficialView {
  const rooms: Room[] = dataset.entities.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    building: room.building,
    capacity: room.capacity,
    type: toRoomType(room.type),
    features: room.features,
    accessible: room.accessible,
  }))

  const faculty: Faculty[] = dataset.entities.faculty.map((member) => ({
    id: member.id,
    name: member.name,
    department: member.department,
    dailyLimit: member.max_hours_per_day,
  }))

  const groups: StudentGroup[] = dataset.entities.student_groups.map((group) => ({
    id: group.id,
    name: group.name,
    year: group.year,
    branch: group.department,
    size: group.size,
  }))

  const courseTitle = new Map(dataset.entities.courses.map((course) => [course.id, course.title]))
  const placement = new Map(schedule.schedule.sessions.map((item) => [item.session_id, item]))
  const requestById = new Map(dataset.entities.booking_requests.map((request) => [request.id, request]))
  const decisionById = new Map<string, OfficialDecision>(
    (schedule.decisions ?? []).map((decision) => [decision.request_id, decision]),
  )

  const sessions: Session[] = []
  const groupsBySession = new Map<string, string[]>()
  for (const definition of dataset.entities.sessions) {
    const placed = placement.get(definition.id)
    if (!placed) continue
    sessions.push({
      id: definition.id,
      courseCode: definition.course_id,
      courseName: courseTitle.get(definition.course_id) ?? definition.course_id,
      facultyId: definition.faculty_id,
      groupId: definition.groups[0] ?? '',
      roomId: placed.room_id,
      day: toDemoDay(placed.day),
      startPeriod: placed.start_period,
      periods: definition.duration,
      kind: definition.kind === 'lab' ? 'lab' : 'lecture',
    })
    groupsBySession.set(definition.id, definition.groups)
  }

  const bookings: Booking[] = schedule.schedule.fest_week.bookings.map((row, index) => {
    const id = String(row.request_id ?? `BR-${index}`)
    const request = requestById.get(id)
    const decision = decisionById.get(id)
    const status = (String(row.status ?? 'rejected') as BookingStatus) ?? 'rejected'
    const roomId = String(
      row.room_id ?? decision?.room_id ?? request?.requested_room ?? dataset.entities.rooms[0]?.id ?? 'UNKNOWN',
    )
    const day = toDemoDay(String(row.day ?? decision?.day ?? request?.windows?.[0]?.day ?? 'MON'))
    const startPeriod = Number(
      row.start_period ?? decision?.start_period ?? request?.windows?.[0]?.from_period ?? 1,
    )
    return {
      id,
      title: request?.title ?? id,
      organizer: request?.requester ?? 'Unknown',
      requester: request?.requester ?? 'unknown',
      roomId,
      day,
      startPeriod,
      periods: request?.duration_periods ?? 1,
      priority: toPriority(request?.requested_category ?? 'club_event'),
      status,
      expectedAttendees: request?.attendance ?? 0,
      note: String(row.reason ?? decision?.reason ?? ''),
      updatedAt: Date.now(),
      ...(row.status === 'approved' || row.status === 'alternative_offered'
        ? { decidedBy: 'debjeet', decisionReason: String(row.reason ?? decision?.reason ?? '') }
        : {}),
    }
  })

  return {
    data: {
      version: SEED_VERSION,
      rooms,
      faculty,
      groups,
      sessions,
      bookings,
      proposals: [],
      audit: [],
    },
    groupsBySession,
  }
}

export function officialOptions(
  view: OfficialView,
  type: 'group' | 'faculty' | 'room',
): { id: string; label: string }[] {
  if (type === 'group') return view.data.groups.map((group) => ({ id: group.id, label: group.name }))
  if (type === 'faculty') return view.data.faculty.map((member) => ({ id: member.id, label: member.name }))
  return view.data.rooms.map((room) => ({ id: room.id, label: room.name }))
}

export function officialSessionsForView(
  view: OfficialView,
  type: 'group' | 'faculty' | 'room',
  id: string,
): Session[] {
  if (type === 'group') {
    const out: Session[] = []
    for (const session of view.data.sessions) {
      for (const group of view.groupsBySession.get(session.id) ?? [session.groupId]) {
        out.push({ ...session, id: `${session.id}::${group}`, groupId: group })
      }
    }
    return out
      .filter((session) => session.groupId === id)
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startPeriod - b.startPeriod)
  }
  return view.data.sessions
    .filter((session) => (type === 'faculty' ? session.facultyId === id : session.roomId === id))
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startPeriod - b.startPeriod)
}
