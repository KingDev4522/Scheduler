import { KEYS, readJSON, removeKey, writeJSON } from './storage'

/** Demo/localStorage data layer. Replaced per-module as real datasets land. */

export type RoomType = 'lecture' | 'lab' | 'seminar' | 'auditorium'

export interface Room {
  id: string
  name: string
  building: string
  capacity: number
  type: RoomType
  features: string[]
  accessible: boolean
  /** Demo utilisation % for dashboard display until real sessions are imported. */
  utilisation: number
}

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'alternative_offered'
  | 'cancelled'

export interface Booking {
  id: string
  title: string
  organizer: string
  requester: string
  roomId: string
  day: string
  startPeriod: number
  periods: number
  priority: 1 | 2 | 3
  status: BookingStatus
  note: string
  updatedAt: number
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Approval {
  id: string
  kind: 'booking' | 'change'
  title: string
  requester: string
  route: string
  detail: string
  conflicts: string[]
  status: ApprovalStatus
  submittedAt: number
}

export interface AuditEvent {
  id: string
  actor: string
  action: string
  at: number
}

export interface Conflict {
  id: string
  title: string
  detail: string
}

export interface AppData {
  version: number
  rooms: Room[]
  bookings: Booking[]
  approvals: Approval[]
  conflicts: Conflict[]
  audit: AuditEvent[]
}

export const SEED_VERSION = 1

const MIN = 60_000
const HOUR = 60 * MIN

const ROOMS: Room[] = [
  { id: 'LT-1', name: 'LT-1', building: 'Academic Block A', capacity: 120, type: 'lecture', features: ['Projector', 'AC'], accessible: true, utilisation: 82 },
  { id: 'LT-2', name: 'LT-2', building: 'Academic Block A', capacity: 90, type: 'lecture', features: ['Projector'], accessible: true, utilisation: 74 },
  { id: 'LT-3', name: 'LT-3', building: 'Academic Block B', capacity: 60, type: 'lecture', features: ['Whiteboard'], accessible: false, utilisation: 61 },
  { id: 'CSE-LAB-1', name: 'CSE Lab 1', building: 'Tech Block', capacity: 60, type: 'lab', features: ['Computers', 'AC'], accessible: true, utilisation: 88 },
  { id: 'CSE-LAB-2', name: 'CSE Lab 2', building: 'Tech Block', capacity: 60, type: 'lab', features: ['Computers'], accessible: true, utilisation: 66 },
  { id: 'ECE-LAB-1', name: 'ECE Lab 1', building: 'Tech Block', capacity: 48, type: 'lab', features: ['Oscilloscopes'], accessible: false, utilisation: 57 },
  { id: 'SEM-1', name: 'Seminar Hall 1', building: 'Library Block', capacity: 40, type: 'seminar', features: ['Projector', 'Video conferencing'], accessible: true, utilisation: 45 },
  { id: 'AUD-1', name: 'Auditorium', building: 'Main Block', capacity: 300, type: 'auditorium', features: ['Stage', 'Sound system', 'Projector'], accessible: true, utilisation: 38 },
]

type BookingTuple = [
  id: string,
  title: string,
  organizer: string,
  requester: string,
  roomId: string,
  day: string,
  start: number,
  periods: number,
  priority: 1 | 2 | 3,
  status: BookingStatus,
  note: string,
]

/** 25 Spectra-style venue requests (one later cancelled), per the PRD. */
const BOOKING_SEED: BookingTuple[] = [
  ['SPC-01', 'Inaugural Ceremony rehearsal', 'Spectra Core', 'mehul', 'AUD-1', 'Mon', 1, 2, 1, 'approved', 'Flagship opening slot confirmed.'],
  ['SPC-02', 'RoboWars workshop', 'Robotics Club', 'mehul', 'CSE-LAB-1', 'Tue', 6, 2, 2, 'pending', 'Needs lab power benches.'],
  ['SPC-03', 'Coding marathon kickoff', 'Codecell', 'mehul', 'CSE-LAB-2', 'Wed', 6, 3, 2, 'pending', 'Overlaps with lab session P7 — conflict check required.'],
  ['SPC-04', 'Tech talk: AI in industry', 'ECE Association', 'indranil', 'LT-1', 'Thu', 3, 1, 1, 'approved', 'Guest speaker confirmed.'],
  ['SPC-05', 'Dance auditions', 'Rhythm Club', 'mehul', 'AUD-1', 'Fri', 7, 2, 3, 'pending', 'Floor space needed.'],
  ['SPC-06', 'Debate prelims', 'Lit Club', 'indranil', 'SEM-1', 'Mon', 4, 2, 3, 'approved', 'Two rounds scheduled.'],
  ['SPC-07', 'Photography exhibition', 'Lens Club', 'mehul', 'SEM-1', 'Tue', 1, 2, 3, 'rejected', 'Room unavailable during P1–P2.'],
  ['SPC-08', 'Hackathon team formation', 'Codecell', 'mehul', 'LT-3', 'Wed', 1, 1, 2, 'alternative_offered', 'Offered LT-2 on the same day.'],
  ['SPC-09', 'Mechanical model display', 'Mech Society', 'indranil', 'LT-2', 'Thu', 8, 1, 3, 'pending', 'Display tables required.'],
  ['SPC-10', 'Robotics demo day', 'Robotics Club', 'mehul', 'AUD-1', 'Fri', 3, 2, 2, 'approved', 'Demo benches on stage.'],
  ['SPC-11', 'Career guidance session', 'Placement Cell', 'indranil', 'LT-1', 'Mon', 6, 1, 1, 'approved', 'Recruiter attendance expected.'],
  ['SPC-12', 'Board game night', 'Games Club', 'mehul', 'SEM-1', 'Tue', 8, 2, 3, 'pending', 'Evening slot request.'],
  ['SPC-13', 'Film screening', 'Cine Club', 'mehul', 'AUD-1', 'Wed', 8, 2, 3, 'pending', 'Projection setup needed.'],
  ['SPC-14', 'Yoga morning session', 'Wellness Club', 'indranil', 'LT-3', 'Thu', 1, 1, 3, 'rejected', 'Clashes with P1 lectures.'],
  ['SPC-15', 'Startup pitch night', 'E-Cell', 'mehul', 'AUD-1', 'Fri', 1, 2, 1, 'approved', 'Jury panel confirmed.'],
  ['SPC-16', 'Poster presentation', 'ECE Association', 'indranil', 'LT-2', 'Mon', 3, 1, 2, 'approved', 'Corridor display allowed.'],
  ['SPC-17', 'Treasure hunt briefing', 'Adventure Club', 'mehul', 'LT-3', 'Tue', 4, 1, 3, 'pending', 'Short briefing slot.'],
  ['SPC-18', 'Workshop: PCB design', 'Robotics Club', 'indranil', 'ECE-LAB-1', 'Wed', 3, 2, 2, 'pending', 'Lab owner approval required.'],
  ['SPC-19', 'Choreography practice', 'Rhythm Club', 'mehul', 'AUD-1', 'Thu', 6, 2, 3, 'approved', 'Regular weekly slot.'],
  ['SPC-20', ' Literary evening', 'Lit Club', 'indranil', 'SEM-1', 'Fri', 4, 2, 3, 'pending', 'Open mic event.'],
  ['SPC-21', 'Annual day auditions', 'Spectra Core', 'mehul', 'AUD-1', 'Mon', 8, 2, 1, 'pending', 'Priority-1 allocation.'],
  ['SPC-22', 'Tech quiz prelims', 'Codecell', 'mehul', 'LT-2', 'Tue', 3, 1, 2, 'approved', 'Invigilation arranged.'],
  ['SPC-23', 'Drone flying demo', 'Robotics Club', 'mehul', 'LT-1', 'Wed', 4, 1, 2, 'cancelled', 'Organizer cancelled — weather constraints.'],
  ['SPC-24', 'Alumni meet prep', 'Placement Cell', 'indranil', 'LT-1', 'Thu', 4, 1, 1, 'pending', 'Room block for rehearsals.'],
  ['SPC-25', 'Closing ceremony run-through', 'Spectra Core', 'mehul', 'AUD-1', 'Fri', 6, 3, 1, 'pending', 'Full run before Spectra week.'],
]

const APPROVAL_SEED: Approval[] = [
  {
    id: 'APR-01',
    kind: 'booking',
    title: 'RoboWars workshop — CSE Lab 1, Tue P6–P7',
    requester: 'mehul',
    route: 'Admin (displaces a class)',
    detail: 'Lab session for II-year CSE occupies P6–P7 in CSE Lab 1; approving moves that class.',
    conflicts: ['CSE Lab 1 — II-year lab session P6–P7'],
    status: 'pending',
    submittedAt: Date.now() - 3 * HOUR,
  },
  {
    id: 'APR-02',
    kind: 'change',
    title: 'Faculty leave repair — 3 sessions moved',
    requester: 'indranil',
    route: 'Admin (timetable change)',
    detail: 'Candidate repair minimises moved sessions: 3 sessions relocate, no hard violations.',
    conflicts: [],
    status: 'pending',
    submittedAt: Date.now() - 6 * HOUR,
  },
  {
    id: 'APR-03',
    kind: 'booking',
    title: 'Dept guest lecture — LT-1, Thu P3',
    requester: 'indranil',
    route: 'Admin (class-displacing booking)',
    detail: 'Displaces one II-year lecture; alternate slot LT-2 P3 offered as fallback.',
    conflicts: ['LT-1 — II-year lecture P3'],
    status: 'pending',
    submittedAt: Date.now() - 26 * HOUR,
  },
  {
    id: 'APR-04',
    kind: 'booking',
    title: 'Lab booking — ECE Lab 1, Wed P3–P4',
    requester: 'indranil',
    route: 'Department coordinator (own department lab)',
    detail: 'Self-approval blocked by policy; routed to Admin for decision.',
    conflicts: [],
    status: 'pending',
    submittedAt: Date.now() - 50 * MIN,
  },
]

const CONFLICTS: Conflict[] = [
  { id: 'CNF-01', title: 'CSE Lab 1 double-booked (P6)', detail: 'SPC-02 request overlaps II-year lab session.' },
  { id: 'CNF-02', title: 'LT-1 capacity risk (P3)', detail: 'Guest lecture expects 130 attendees vs capacity 120.' },
]

const AUDIT_SEED: AuditEvent[] = [
  { id: 'AUD-06', actor: 'mehul', action: 'Submitted SPC-25 — closing ceremony run-through', at: Date.now() - 12 * MIN },
  { id: 'AUD-05', actor: 'indranil', action: 'Requested faculty-leave repair proposal', at: Date.now() - 6 * HOUR },
  { id: 'AUD-04', actor: 'debjeet', action: 'Approved SPC-04 — Tech talk: AI in industry', at: Date.now() - 9 * HOUR },
  { id: 'AUD-03', actor: 'system', action: 'Re-validation run completed — 2 conflicts open', at: Date.now() - 22 * HOUR },
  { id: 'AUD-02', actor: 'debjeet', action: 'Rejected SPC-07 — Photography exhibition', at: Date.now() - 30 * HOUR },
  { id: 'AUD-01', actor: 'system', action: 'Demo dataset initialised in localStorage', at: Date.now() - 48 * HOUR },
]

function seedData(): AppData {
  const now = Date.now()
  return {
    version: SEED_VERSION,
    rooms: ROOMS,
    bookings: BOOKING_SEED.map((t, i) => ({
      id: t[0],
      title: t[1],
      organizer: t[2],
      requester: t[3],
      roomId: t[4],
      day: t[5],
      startPeriod: t[6],
      periods: t[7],
      priority: t[8],
      status: t[9],
      note: t[10],
      updatedAt: now - (i + 1) * 17 * MIN,
    })),
    approvals: APPROVAL_SEED,
    conflicts: CONFLICTS,
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

export function decideApproval(
  id: string,
  decision: 'approved' | 'rejected',
  actor: string,
): AppData {
  const data = getData()
  const target = data.approvals.find((a) => a.id === id)
  if (!target || target.status !== 'pending') return data
  target.status = decision
  data.audit = [
    {
      id: `AUD-${Date.now()}`,
      actor,
      action: `${decision === 'approved' ? 'Approved' : 'Rejected'} ${target.id} — ${target.title}`,
      at: Date.now(),
    },
    ...data.audit,
  ]
  return persist(data)
}

export function resetDemoData(): void {
  removeKey(KEYS.data)
}
