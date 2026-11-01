import type { DatasetInfo } from './api'
import type { SessionUser } from './auth'

const ROOM_DEPARTMENT: Record<string, string> = {
  'CS-LAB-1': 'CSE',
  'CS-LAB-2': 'CSE',
  'ELEC-LAB-1': 'ECE',
  'ELEC-LAB-2': 'ECE',
  'PHY-LAB': 'SCIENCE',
  'MECH-WS': 'ME',
  'CIVIL-LAB': 'CE',
}

export function roomDepartment(roomId: string | null | undefined): string | null {
  if (!roomId) return null
  if (ROOM_DEPARTMENT[roomId]) return ROOM_DEPARTMENT[roomId]
  const upper = roomId.toUpperCase()
  if (upper.startsWith('CS-LAB')) return 'CSE'
  if (upper.startsWith('ELEC-LAB')) return 'ECE'
  if (upper.startsWith('PHY-LAB')) return 'SCIENCE'
  if (upper.startsWith('MECH')) return 'ME'
  if (upper.startsWith('CIVIL-LAB')) return 'CE'
  return null
}

export function canCoordinatorDecideRoom(
  user: SessionUser,
  roomId: string | null | undefined,
): boolean {
  return Boolean(
    user.role === 'department_coordinator' &&
      user.department &&
      roomDepartment(roomId) === user.department,
  )
}

export function sessionDepartment(
  dataset: DatasetInfo | null,
  sessionId: string | null | undefined,
): string | null {
  if (!dataset || !sessionId) return null
  const session = dataset.entities.sessions.find((item) => item.id === sessionId)
  if (!session) return null
  for (const groupId of session.groups) {
    const group = dataset.entities.student_groups.find((item) => item.id === groupId)
    if (group?.department) return group.department
  }
  const course = dataset.entities.courses.find((item) => item.id === session.course_id)
  if (course?.department) return course.department
  const faculty = dataset.entities.faculty.find((item) => item.id === session.faculty_id)
  return faculty?.department ?? null
}

export function canCoordinatorDecideSession(
  user: SessionUser,
  dataset: DatasetInfo | null,
  sessionId: string | null | undefined,
): boolean {
  return Boolean(
    user.role === 'department_coordinator' &&
      user.department &&
      sessionDepartment(dataset, sessionId) === user.department,
  )
}
