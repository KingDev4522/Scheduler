import { KEYS, readJSON, removeKey, writeJSON } from './storage'
import type { Role } from './auth'
import { DAYS, validateAcademicWindow, type Day } from './time'

/**
 * Demo/localStorage data layer.
 *
 * Shapes here are DEMO-ONLY and are not the official dataset schema.
 * The starter pack (`cit_public.json`) is still absent (DEC-002), so field
 * names must not be treated as authoritative. See docs/agent/DECISIONS.md.
 */

export type RoomType = 'lecture' | 'lab' | 'seminar' | 'auditorium'

export interface Room {
  id: string
  name: string
  building: string
  capacity: number
  type: RoomType
  features: string[]
  accessible: boolean
  /** Owning department for lab approval routing. */
  department?: string
}

export interface Faculty {
  id: string
  name: string
  department: string
  /** CIT daily teaching limit, in periods (H12). */
  dailyLimit: number
}

export interface StudentGroup {
  id: string
  name: string
  year: number
  branch: string
  size: number
}

export type SessionKind = 'lecture' | 'lab'

export interface Session {
  id: string
  courseCode: string
  courseName: string
  facultyId: string
  groupId: string
  roomId: string
  day: Day
  startPeriod: number
  periods: number
  kind: SessionKind
}

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'alternative_offered'
  | 'cancelled'

export type BookingPriority = 1 | 2 | 3

export interface Booking {
  id: string
  title: string
  organizer: string
  requester: string
  roomId: string
  day: Day
  startPeriod: number
  periods: number
  /** 1 = institute event, 2 = department/guest, 3 = club event. */
  priority: BookingPriority
  /** Raw requested category from the official dataset (e.g. institute_event). */
  category?: string
  status: BookingStatus
  expectedAttendees: number
  note: string
  updatedAt: number
  decidedBy?: string
  decidedAt?: number
  decisionReason?: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ProposedPlacement {
  sessionId: string
  day: Day
  startPeriod: number
  roomId: string
}

export type DisruptionType = 'faculty_leave' | 'room_closure'

export interface DisruptionSpec {
  type: DisruptionType
  day: Day
  facultyId?: string
  roomId?: string
  description: string
}

/**
 * A disruption-repair proposal: the affected sessions, what they had before and
 * what the engine proposes. Nothing is written to the timetable until an Admin
 * approves it.
 */
export interface ChangeProposal {
  id: string
  title: string
  requester: string
  route: string
  detail: string
  disruption: DisruptionSpec
  before: ProposedPlacement[]
  after: ProposedPlacement[]
  movedCount: number
  conflicts: string[]
  status: ApprovalStatus
  submittedAt: number
  decidedBy?: string
  decidedAt?: number
}

export interface AuditEvent {
  id: string
  actor: string
  action: string
  at: number
}

export interface AppData {
  version: number
  rooms: Room[]
  faculty: Faculty[]
  groups: StudentGroup[]
  sessions: Session[]
  bookings: Booking[]
  proposals: ChangeProposal[]
  audit: AuditEvent[]
}

/** Bumped whenever the demo shape changes so stale localStorage is replaced. */
export const SEED_VERSION = 4

const MIN = 60_000
const HOUR = 60 * MIN

const ROOMS: Room[] = [
  { id: 'LT-1', name: 'LT-1', building: 'Academic Block A', capacity: 120, type: 'lecture', features: ['Projector', 'AC'], accessible: true },
  { id: 'LT-2', name: 'LT-2', building: 'Academic Block A', capacity: 90, type: 'lecture', features: ['Projector'], accessible: true },
  { id: 'LT-3', name: 'LT-3', building: 'Academic Block B', capacity: 60, type: 'lecture', features: ['Whiteboard'], accessible: false },
  { id: 'CSE-LAB-1', name: 'CSE Lab 1', building: 'Tech Block', capacity: 60, type: 'lab', features: ['Computers', 'AC'], accessible: true, department: 'CSE' },
  { id: 'CSE-LAB-2', name: 'CSE Lab 2', building: 'Tech Block', capacity: 60, type: 'lab', features: ['Computers'], accessible: true, department: 'CSE' },
  { id: 'ECE-LAB-1', name: 'ECE Lab 1', building: 'Tech Block', capacity: 48, type: 'lab', features: ['Oscilloscopes'], accessible: false, department: 'ECE' },
  { id: 'SEM-1', name: 'Seminar Hall 1', building: 'Library Block', capacity: 40, type: 'seminar', features: ['Projector', 'Video conferencing'], accessible: true },
  { id: 'AUD-1', name: 'Auditorium', building: 'Main Block', capacity: 300, type: 'auditorium', features: ['Stage', 'Sound system', 'Projector'], accessible: true },
]

const FACULTY: Faculty[] = [
  { id: 'F-SEN', name: 'Dr. A. Sen', department: 'CSE', dailyLimit: 4 },
  { id: 'F-IYER', name: 'Dr. R. Iyer', department: 'CSE', dailyLimit: 4 },
  { id: 'F-BOSE', name: 'Dr. S. Bose', department: 'CSE', dailyLimit: 4 },
  { id: 'F-RAO', name: 'Dr. M. Rao', department: 'ECE', dailyLimit: 4 },
  { id: 'F-VERMA', name: 'Dr. K. Verma', department: 'ECE', dailyLimit: 4 },
  { id: 'F-NAIR', name: 'Dr. P. Nair', department: 'MECH', dailyLimit: 4 },
  { id: 'F-KHAN', name: 'Dr. F. Khan', department: 'MECH', dailyLimit: 4 },
]

const GROUPS: StudentGroup[] = [
  { id: 'CSE-A', name: 'CSE II-A', year: 2, branch: 'CSE', size: 60 },
  { id: 'CSE-B', name: 'CSE II-B', year: 2, branch: 'CSE', size: 60 },
  { id: 'ECE-A', name: 'ECE II-A', year: 2, branch: 'ECE', size: 48 },
  { id: 'MECH-A', name: 'MECH III-A', year: 3, branch: 'MECH', size: 55 },
]

/**
 * Demo teaching sessions — illustrative only, not generated by a solver and
 * never claimed to pass the official validator (DEC-006).
 */
const SESSIONS: Session[] = [
  // CSE II-A
  { id: 'SES-01', courseCode: 'CS201', courseName: 'Data Structures', facultyId: 'F-SEN', groupId: 'CSE-A', roomId: 'LT-1', day: 'Mon', startPeriod: 1, periods: 1, kind: 'lecture' },
  { id: 'SES-02', courseCode: 'CS291', courseName: 'Data Structures Lab', facultyId: 'F-SEN', groupId: 'CSE-A', roomId: 'CSE-LAB-1', day: 'Mon', startPeriod: 2, periods: 3, kind: 'lab' },
  { id: 'SES-03', courseCode: 'CS202', courseName: 'Algorithms', facultyId: 'F-IYER', groupId: 'CSE-A', roomId: 'LT-1', day: 'Tue', startPeriod: 1, periods: 1, kind: 'lecture' },
  { id: 'SES-04', courseCode: 'CS204', courseName: 'Computer Networks', facultyId: 'F-BOSE', groupId: 'CSE-A', roomId: 'LT-1', day: 'Wed', startPeriod: 1, periods: 1, kind: 'lecture' },
  { id: 'SES-05', courseCode: 'CS202', courseName: 'Algorithms', facultyId: 'F-IYER', groupId: 'CSE-A', roomId: 'LT-1', day: 'Thu', startPeriod: 1, periods: 1, kind: 'lecture' },
  { id: 'SES-06', courseCode: 'CS201', courseName: 'Data Structures', facultyId: 'F-SEN', groupId: 'CSE-A', roomId: 'LT-1', day: 'Fri', startPeriod: 6, periods: 1, kind: 'lecture' },
  { id: 'SES-25', courseCode: 'CS291', courseName: 'Data Structures Lab', facultyId: 'F-SEN', groupId: 'CSE-A', roomId: 'CSE-LAB-1', day: 'Tue', startPeriod: 6, periods: 3, kind: 'lab' },
  // CSE II-B
  { id: 'SES-07', courseCode: 'CS203', courseName: 'Database Systems', facultyId: 'F-BOSE', groupId: 'CSE-B', roomId: 'LT-2', day: 'Mon', startPeriod: 1, periods: 1, kind: 'lecture' },
  { id: 'SES-08', courseCode: 'CS205', courseName: 'Operating Systems', facultyId: 'F-IYER', groupId: 'CSE-B', roomId: 'LT-2', day: 'Mon', startPeriod: 5, periods: 1, kind: 'lecture' },
  { id: 'SES-09', courseCode: 'CS201', courseName: 'Data Structures', facultyId: 'F-SEN', groupId: 'CSE-B', roomId: 'LT-2', day: 'Tue', startPeriod: 1, periods: 1, kind: 'lecture' },
  { id: 'SES-10', courseCode: 'CS293', courseName: 'Database Lab', facultyId: 'F-BOSE', groupId: 'CSE-B', roomId: 'CSE-LAB-2', day: 'Tue', startPeriod: 2, periods: 3, kind: 'lab' },
  { id: 'SES-11', courseCode: 'CS203', courseName: 'Database Systems', facultyId: 'F-BOSE', groupId: 'CSE-B', roomId: 'LT-2', day: 'Wed', startPeriod: 3, periods: 1, kind: 'lecture' },
  { id: 'SES-12', courseCode: 'CS205', courseName: 'Operating Systems', facultyId: 'F-IYER', groupId: 'CSE-B', roomId: 'LT-2', day: 'Thu', startPeriod: 4, periods: 1, kind: 'lecture' },
  // ECE II-A
  { id: 'SES-13', courseCode: 'EC201', courseName: 'Signals & Systems', facultyId: 'F-RAO', groupId: 'ECE-A', roomId: 'LT-3', day: 'Mon', startPeriod: 1, periods: 1, kind: 'lecture' },
  { id: 'SES-14', courseCode: 'EC291', courseName: 'Signals Lab', facultyId: 'F-RAO', groupId: 'ECE-A', roomId: 'ECE-LAB-1', day: 'Mon', startPeriod: 2, periods: 3, kind: 'lab' },
  { id: 'SES-15', courseCode: 'EC202', courseName: 'Digital Circuits', facultyId: 'F-VERMA', groupId: 'ECE-A', roomId: 'LT-3', day: 'Tue', startPeriod: 2, periods: 1, kind: 'lecture' },
  { id: 'SES-16', courseCode: 'EC201', courseName: 'Signals & Systems', facultyId: 'F-RAO', groupId: 'ECE-A', roomId: 'LT-3', day: 'Wed', startPeriod: 1, periods: 1, kind: 'lecture' },
  { id: 'SES-17', courseCode: 'EC202', courseName: 'Digital Circuits', facultyId: 'F-VERMA', groupId: 'ECE-A', roomId: 'LT-3', day: 'Thu', startPeriod: 3, periods: 1, kind: 'lecture' },
  { id: 'SES-18', courseCode: 'EC201', courseName: 'Signals & Systems', facultyId: 'F-RAO', groupId: 'ECE-A', roomId: 'LT-3', day: 'Fri', startPeriod: 1, periods: 1, kind: 'lecture' },
  // MECH III-A
  { id: 'SES-19', courseCode: 'ME301', courseName: 'Thermodynamics', facultyId: 'F-NAIR', groupId: 'MECH-A', roomId: 'AUD-1', day: 'Mon', startPeriod: 3, periods: 1, kind: 'lecture' },
  { id: 'SES-20', courseCode: 'ME302', courseName: 'Fluid Mechanics', facultyId: 'F-KHAN', groupId: 'MECH-A', roomId: 'AUD-1', day: 'Mon', startPeriod: 6, periods: 1, kind: 'lecture' },
  { id: 'SES-21', courseCode: 'ME301', courseName: 'Thermodynamics', facultyId: 'F-NAIR', groupId: 'MECH-A', roomId: 'AUD-1', day: 'Tue', startPeriod: 3, periods: 1, kind: 'lecture' },
  { id: 'SES-22', courseCode: 'ME303', courseName: 'Materials Science', facultyId: 'F-KHAN', groupId: 'MECH-A', roomId: 'AUD-1', day: 'Wed', startPeriod: 5, periods: 1, kind: 'lecture' },
  { id: 'SES-23', courseCode: 'ME301', courseName: 'Thermodynamics', facultyId: 'F-NAIR', groupId: 'MECH-A', roomId: 'AUD-1', day: 'Thu', startPeriod: 2, periods: 1, kind: 'lecture' },
  { id: 'SES-24', courseCode: 'ME302', courseName: 'Fluid Mechanics', facultyId: 'F-KHAN', groupId: 'MECH-A', roomId: 'AUD-1', day: 'Fri', startPeriod: 5, periods: 1, kind: 'lecture' },
]

interface BookingSeed {
  id: string
  title: string
  organizer: string
  requester: string
  roomId: string
  day: Day
  start: number
  periods: number
  priority: BookingPriority
  status: BookingStatus
  expectedAttendees: number
  note: string
}

/** 25 Spectra-style venue requests (one later cancelled), per docs/05. */
const BOOKING_SEED: BookingSeed[] = [
  { id: 'SPC-01', title: 'Inaugural Ceremony rehearsal', organizer: 'Spectra Core', requester: 'mehul', roomId: 'AUD-1', day: 'Mon', start: 1, periods: 2, priority: 1, status: 'approved', expectedAttendees: 250, note: 'Flagship opening slot confirmed.' },
  { id: 'SPC-02', title: 'RoboWars workshop', organizer: 'Robotics Club', requester: 'mehul', roomId: 'CSE-LAB-1', day: 'Tue', start: 6, periods: 2, priority: 2, status: 'pending', expectedAttendees: 55, note: 'Needs lab power benches.' },
  { id: 'SPC-03', title: 'Coding marathon kickoff', organizer: 'Codecell', requester: 'mehul', roomId: 'CSE-LAB-2', day: 'Wed', start: 6, periods: 3, priority: 2, status: 'pending', expectedAttendees: 50, note: 'Long evening slot requested.' },
  { id: 'SPC-04', title: 'Tech talk: AI in industry', organizer: 'ECE Association', requester: 'indranil', roomId: 'LT-1', day: 'Thu', start: 3, periods: 1, priority: 1, status: 'approved', expectedAttendees: 130, note: 'Guest speaker confirmed; expected turnout exceeds LT-1 capacity.' },
  { id: 'SPC-05', title: 'Dance auditions', organizer: 'Rhythm Club', requester: 'mehul', roomId: 'AUD-1', day: 'Fri', start: 7, periods: 2, priority: 3, status: 'pending', expectedAttendees: 180, note: 'Floor space needed.' },
  { id: 'SPC-06', title: 'Debate prelims', organizer: 'Lit Club', requester: 'indranil', roomId: 'SEM-1', day: 'Mon', start: 4, periods: 2, priority: 3, status: 'approved', expectedAttendees: 35, note: 'Two rounds scheduled.' },
  { id: 'SPC-07', title: 'Photography exhibition', organizer: 'Lens Club', requester: 'mehul', roomId: 'SEM-1', day: 'Tue', start: 1, periods: 2, priority: 3, status: 'rejected', expectedAttendees: 30, note: 'Room unavailable during P1–P2.' },
  { id: 'SPC-08', title: 'Hackathon team formation', organizer: 'Codecell', requester: 'mehul', roomId: 'LT-3', day: 'Wed', start: 1, periods: 1, priority: 2, status: 'alternative_offered', expectedAttendees: 45, note: 'LT-3 is occupied; LT-2 on the same day was offered.' },
  { id: 'SPC-09', title: 'Mechanical model display', organizer: 'Mech Society', requester: 'indranil', roomId: 'LT-2', day: 'Thu', start: 8, periods: 1, priority: 3, status: 'pending', expectedAttendees: 60, note: 'Display tables required.' },
  { id: 'SPC-10', title: 'Robotics demo day', organizer: 'Robotics Club', requester: 'mehul', roomId: 'AUD-1', day: 'Fri', start: 3, periods: 2, priority: 2, status: 'approved', expectedAttendees: 200, note: 'Demo benches on stage.' },
  { id: 'SPC-11', title: 'Career guidance session', organizer: 'Placement Cell', requester: 'indranil', roomId: 'LT-1', day: 'Mon', start: 6, periods: 1, priority: 1, status: 'approved', expectedAttendees: 110, note: 'Recruiter attendance expected.' },
  { id: 'SPC-12', title: 'Board game night', organizer: 'Games Club', requester: 'mehul', roomId: 'SEM-1', day: 'Tue', start: 8, periods: 2, priority: 3, status: 'pending', expectedAttendees: 30, note: 'Evening slot request.' },
  { id: 'SPC-13', title: 'Film screening', organizer: 'Cine Club', requester: 'mehul', roomId: 'AUD-1', day: 'Wed', start: 8, periods: 2, priority: 3, status: 'pending', expectedAttendees: 150, note: 'Projection setup needed.' },
  { id: 'SPC-14', title: 'Yoga morning session', organizer: 'Wellness Club', requester: 'indranil', roomId: 'LT-3', day: 'Thu', start: 1, periods: 1, priority: 3, status: 'rejected', expectedAttendees: 25, note: 'Clashes with P1 lectures.' },
  { id: 'SPC-15', title: 'Startup pitch night', organizer: 'E-Cell', requester: 'mehul', roomId: 'AUD-1', day: 'Fri', start: 1, periods: 2, priority: 1, status: 'approved', expectedAttendees: 220, note: 'Jury panel confirmed.' },
  { id: 'SPC-16', title: 'Poster presentation', organizer: 'ECE Association', requester: 'indranil', roomId: 'LT-2', day: 'Mon', start: 3, periods: 1, priority: 2, status: 'approved', expectedAttendees: 70, note: 'Corridor display allowed.' },
  { id: 'SPC-17', title: 'Treasure hunt briefing', organizer: 'Adventure Club', requester: 'mehul', roomId: 'LT-3', day: 'Tue', start: 4, periods: 1, priority: 3, status: 'pending', expectedAttendees: 40, note: 'Short briefing slot.' },
  { id: 'SPC-18', title: 'Workshop: PCB design', organizer: 'Robotics Club', requester: 'indranil', roomId: 'ECE-LAB-1', day: 'Wed', start: 3, periods: 2, priority: 2, status: 'pending', expectedAttendees: 40, note: 'Lab owner approval required.' },
  { id: 'SPC-19', title: 'Choreography practice', organizer: 'Rhythm Club', requester: 'mehul', roomId: 'AUD-1', day: 'Thu', start: 6, periods: 2, priority: 3, status: 'approved', expectedAttendees: 90, note: 'Regular weekly slot.' },
  { id: 'SPC-20', title: 'Literary evening', organizer: 'Lit Club', requester: 'indranil', roomId: 'SEM-1', day: 'Fri', start: 4, periods: 2, priority: 3, status: 'pending', expectedAttendees: 35, note: 'Open mic event.' },
  { id: 'SPC-21', title: 'Annual day auditions', organizer: 'Spectra Core', requester: 'mehul', roomId: 'AUD-1', day: 'Mon', start: 8, periods: 2, priority: 1, status: 'pending', expectedAttendees: 200, note: 'Priority-1 allocation.' },
  { id: 'SPC-22', title: 'Tech quiz prelims', organizer: 'Codecell', requester: 'mehul', roomId: 'LT-2', day: 'Tue', start: 3, periods: 1, priority: 2, status: 'approved', expectedAttendees: 60, note: 'Invigilation arranged.' },
  { id: 'SPC-23', title: 'Drone flying demo', organizer: 'Robotics Club', requester: 'mehul', roomId: 'LT-1', day: 'Wed', start: 4, periods: 1, priority: 2, status: 'cancelled', expectedAttendees: 80, note: 'Organizer cancelled — weather constraints.' },
  { id: 'SPC-24', title: 'Alumni meet prep', organizer: 'Placement Cell', requester: 'indranil', roomId: 'LT-1', day: 'Thu', start: 4, periods: 1, priority: 1, status: 'pending', expectedAttendees: 100, note: 'Room block for rehearsals.' },
  { id: 'SPC-25', title: 'Closing ceremony run-through', organizer: 'Spectra Core', requester: 'mehul', roomId: 'AUD-1', day: 'Fri', start: 6, periods: 3, priority: 1, status: 'pending', expectedAttendees: 240, note: 'Full run before Spectra week.' },
]

/** Change proposals start empty — they are produced by the repair engine. */
const PROPOSAL_SEED: ChangeProposal[] = []

const AUDIT_SEED: AuditEvent[] = [
  { id: 'AUD-06', actor: 'mehul', action: 'Submitted SPC-25 — closing ceremony run-through', at: Date.now() - 12 * MIN },
  { id: 'AUD-05', actor: 'indranil', action: 'Reviewed the department timetable for next week', at: Date.now() - 6 * HOUR },
  { id: 'AUD-04', actor: 'debjeet', action: 'Approved SPC-04 — Tech talk: AI in industry', at: Date.now() - 9 * HOUR },
  { id: 'AUD-03', actor: 'system', action: 'Re-validation run completed — conflicts recomputed', at: Date.now() - 22 * HOUR },
  { id: 'AUD-02', actor: 'debjeet', action: 'Rejected SPC-07 — Photography exhibition', at: Date.now() - 30 * HOUR },
  { id: 'AUD-01', actor: 'system', action: 'Demo dataset initialised in localStorage', at: Date.now() - 48 * HOUR },
]

function seedData(): AppData {
  const now = Date.now()
  return {
    version: SEED_VERSION,
    rooms: ROOMS,
    faculty: FACULTY,
    groups: GROUPS,
    sessions: SESSIONS,
    bookings: BOOKING_SEED.map((b, i) => ({
      id: b.id,
      title: b.title,
      organizer: b.organizer,
      requester: b.requester,
      roomId: b.roomId,
      day: b.day,
      startPeriod: b.start,
      periods: b.periods,
      priority: b.priority,
      status: b.status,
      expectedAttendees: b.expectedAttendees,
      note: b.note,
      updatedAt: now - (i + 1) * 17 * MIN,
      ...(b.status === 'approved' || b.status === 'rejected'
        ? { decidedBy: 'debjeet', decidedAt: now - (i + 1) * 17 * MIN }
        : {}),
    })),
    proposals: PROPOSAL_SEED,
    audit: AUDIT_SEED,
  }
}

/** Reads current data, seeding it on first run or after a version bump. */
export function getData(): AppData {
  const stored = readJSON<AppData | null>(KEYS.data, null)
  if (stored && stored.version === SEED_VERSION) return stored
  const fresh = seedData()
  writeJSON(KEYS.data, fresh)
  return fresh
}

function persist(data: AppData): AppData {
  writeJSON(KEYS.data, data)
  return data
}

function appendAudit(data: AppData, actor: string, action: string): void {
  data.audit = [{ id: `AUD-${Date.now()}`, actor, action, at: Date.now() }, ...data.audit]
}

export interface Actor {
  username: string
  role: Role
  department?: string
}

export type Permission = { allowed: true } | { allowed: false; reason: string }

/**
 * Deterministic authorization for booking decisions.
 * Admin decides everything; a coordinator decides only their department's lab
 * rooms; nobody decides their own request (no self-approval, ever).
 */
export function canDecideBooking(
  booking: Booking,
  actor: Actor,
  rooms: Room[],
): Permission {
  if (booking.status !== 'pending') {
    return { allowed: false, reason: `This request is already ${booking.status.replace('_', ' ')}.` }
  }
  if (booking.requester === actor.username) {
    return { allowed: false, reason: 'You cannot decide your own request — another approver must review it.' }
  }
  if (actor.role === 'admin') return { allowed: true }

  if (actor.role === 'department_coordinator') {
    const room = rooms.find((r) => r.id === booking.roomId)
    if (!room?.department) {
      return { allowed: false, reason: 'Only an Admin can decide requests for this venue.' }
    }
    if (room.department !== actor.department) {
      return {
        allowed: false,
        reason: `Only the ${room.department} coordinator or an Admin can decide this venue.`,
      }
    }
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: 'Only an Admin or the owning department coordinator can decide requests.',
  }
}

export type DecisionOutcome =
  | { ok: true; data: AppData }
  | { ok: false; error: string }

export function decideBooking(
  id: string,
  decision: 'approved' | 'rejected',
  actor: Actor,
  reason: string,
): DecisionOutcome {
  const data = getData()
  const booking = data.bookings.find((b) => b.id === id)
  if (!booking) return { ok: false, error: `Unknown booking ${id}.` }

  const permission = canDecideBooking(booking, actor, data.rooms)
  if (!permission.allowed) return { ok: false, error: permission.reason }

  const trimmed = reason.trim()
  if (trimmed.length < 3) {
    return { ok: false, error: 'A short reason is required for the audit trail.' }
  }

  booking.status = decision
  booking.decidedBy = actor.username
  booking.decidedAt = Date.now()
  booking.decisionReason = trimmed
  booking.updatedAt = Date.now()

  appendAudit(
    data,
    actor.username,
    `${decision === 'approved' ? 'Approved' : 'Rejected'} ${booking.id} — ${booking.title}: ${trimmed}`,
  )
  return { ok: true, data: persist(data) }
}

export function resetDemoData(): void {
  removeKey(KEYS.data)
}

export interface AppliedPlacement {
  sessionId: string
  day: Day
  startPeriod: number
  roomId: string
}

function validatePlacementList(
  data: AppData,
  placements: ProposedPlacement[],
): string | null {
  const sessionIds = new Set(data.sessions.map((session) => session.id))
  const roomIds = new Set(data.rooms.map((room) => room.id))
  const seen = new Set<string>()
  for (const placement of placements) {
    if (!sessionIds.has(placement.sessionId)) {
      return `Unknown session "${placement.sessionId}".`
    }
    if (seen.has(placement.sessionId)) {
      return `Session "${placement.sessionId}" appears more than once.`
    }
    seen.add(placement.sessionId)
    if (!roomIds.has(placement.roomId)) {
      return `Unknown room "${placement.roomId}".`
    }
    if (!DAYS.includes(placement.day)) {
      return `Invalid day "${placement.day}".`
    }
    const session = data.sessions.find((item) => item.id === placement.sessionId)
    const window = validateAcademicWindow(placement.startPeriod, session?.periods ?? 1)
    if (!window.ok) {
      return `${placement.sessionId}: ${window.message}`
    }
  }
  return null
}

function writePlacements(
  data: AppData,
  placements: ProposedPlacement[],
  actor: string,
  action: string,
): AppData {
  for (const placement of placements) {
    const session = data.sessions.find((item) => item.id === placement.sessionId)
    if (!session) continue
    session.day = placement.day
    session.startPeriod = placement.startPeriod
    session.roomId = placement.roomId
  }
  appendAudit(data, actor, action)
  return persist(data)
}

/**
 * Writes a full generated timetable. Refuses partial or malformed placements so
 * the app can never persist a schedule that skipped the validator.
 */
export function applyPlacements(
  placements: AppliedPlacement[],
  actor: string,
): DecisionOutcome {
  if (placements.length === 0) return { ok: false, error: 'No placements to apply.' }

  const data = getData()
  const error = validatePlacementList(data, placements)
  if (error) return { ok: false, error }

  const placed = new Set(placements.map((placement) => placement.sessionId))
  const missing = data.sessions.filter((session) => !placed.has(session.id))
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Refusing a partial timetable: ${missing.length} sessions would stay unplaced.`,
    }
  }

  return {
    ok: true,
    data: writePlacements(
      data,
      placements,
      actor,
      `Applied generated timetable — ${placements.length} sessions placed by the deterministic solver`,
    ),
  }
}

/**
 * Replaces the demo store with a fully validated import. The caller must run
 * `parseImportDocument` first; this function only guards against a missing
 * collection and then records provenance in the audit trail.
 */
export function writeImportedData(
  data: AppData,
  actor: string,
  sourceLabel: string,
): DecisionOutcome {
  if (
    !Array.isArray(data.rooms) ||
    !Array.isArray(data.faculty) ||
    !Array.isArray(data.groups) ||
    !Array.isArray(data.sessions) ||
    !Array.isArray(data.bookings) ||
    !Array.isArray(data.proposals) ||
    !Array.isArray(data.audit)
  ) {
    return { ok: false, error: 'Imported data is missing one or more required collections.' }
  }

  const next: AppData = { ...data, version: SEED_VERSION }
  appendAudit(
    next,
    actor,
    `Imported dataset "${sourceLabel}" — ${next.rooms.length} rooms, ${next.faculty.length} faculty, ${next.groups.length} groups, ${next.sessions.length} sessions, ${next.bookings.length} bookings`,
  )
  return { ok: true, data: persist(next) }
}

/** Internal, non-official snapshot for round-trip checks and debugging. */
export function exportDataSnapshot(): string {
  return JSON.stringify(getData(), null, 2)
}

export interface ProposalDraft {
  title: string
  route: string
  detail: string
  disruption: DisruptionSpec
  before: ProposedPlacement[]
  after: ProposedPlacement[]
  movedCount: number
  conflicts: string[]
}

export type SubmitProposalOutcome =
  | { ok: true; id: string; data: AppData }
  | { ok: false; error: string }

export function submitProposal(draft: ProposalDraft, actor: Actor): SubmitProposalOutcome {
  const data = getData()
  if (draft.after.length === 0) {
    return { ok: false, error: 'The proposal has no placements to apply.' }
  }
  const error = validatePlacementList(data, draft.after)
  if (error) return { ok: false, error }

  const id = `CHG-${String(data.proposals.length + 1).padStart(2, '0')}-${Date.now().toString(36)}`
  const proposal: ChangeProposal = {
    id,
    title: draft.title,
    requester: actor.username,
    route: draft.route,
    detail: draft.detail,
    disruption: draft.disruption,
    before: draft.before,
    after: draft.after,
    movedCount: draft.movedCount,
    conflicts: draft.conflicts,
    status: 'pending',
    submittedAt: Date.now(),
  }
  data.proposals = [proposal, ...data.proposals]
  appendAudit(
    data,
    actor.username,
    `Submitted ${id} — ${proposal.title} (${proposal.movedCount} session${proposal.movedCount === 1 ? '' : 's'} moved)`,
  )
  return { ok: true, id, data: persist(data) }
}

/**
 * Approves or rejects a change proposal. Approval applies the stored placements;
 * the schedule stays untouched until the decision is written.
 */
export function decideProposal(
  id: string,
  decision: 'approved' | 'rejected',
  actor: Actor,
  reason: string,
): DecisionOutcome {
  const data = getData()
  const target = data.proposals.find((proposal) => proposal.id === id)
  if (!target) return { ok: false, error: `Unknown proposal ${id}.` }
  if (target.status !== 'pending') {
    return { ok: false, error: `Proposal ${id} is already ${target.status}.` }
  }
  if (target.requester === actor.username) {
    return { ok: false, error: 'You cannot decide your own proposal.' }
  }
  if (actor.role !== 'admin') {
    return { ok: false, error: 'Change proposals are Admin-only.' }
  }

  const trimmed = reason.trim()
  if (trimmed.length < 3) {
    return { ok: false, error: 'A short reason is required for the audit trail.' }
  }

  if (decision === 'approved') {
    const error = validatePlacementList(data, target.after)
    if (error) return { ok: false, error: `Proposal cannot be applied: ${error}` }
  }

  target.status = decision
  target.decidedBy = actor.username
  target.decidedAt = Date.now()

  if (decision === 'approved') {
    for (const placement of target.after) {
      const session = data.sessions.find((item) => item.id === placement.sessionId)
      if (!session) continue
      session.day = placement.day
      session.startPeriod = placement.startPeriod
      session.roomId = placement.roomId
    }
    appendAudit(
      data,
      actor.username,
      `Approved ${target.id} — applied ${target.after.length} placement(s), ${target.movedCount} session(s) moved: ${trimmed}`,
    )
  } else {
    appendAudit(
      data,
      actor.username,
      `Rejected ${target.id} — timetable unchanged: ${trimmed}`,
    )
  }

  return { ok: true, data: persist(data) }
}
