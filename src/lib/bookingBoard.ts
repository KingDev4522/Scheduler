import type { DatasetInfo, ScheduleResponse } from './api'
import type { BookingStatus } from './store'
import {
  DAYS,
  PERIOD_TIMES,
  periodRangeLabel,
  timeRangeLabel,
  type Day,
} from './time'
import { weekLabel } from './semester'

const DAY_CODE: Record<string, Day> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
}

const CATEGORY_LABEL: Record<string, string> = {
  institute_event: 'Institute event',
  guest_lecture: 'Guest lecture',
  department_event: 'Department event',
  club_event: 'Club event',
  exam: 'Exam',
  regular_session: 'Regular session',
}

export const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Institute',
  2: 'Department',
  3: 'Club',
}

export interface Slot {
  day: Day
  from: number
  to: number
}

export interface GrantedSlot extends Slot {
  roomId: string | null
}

export interface BoardRow {
  id: string
  title: string
  requester: string
  category: string
  categoryLabel: string
  tier: 1 | 2 | 3
  attendance: number
  duration: number
  windows: Slot[]
  needs: string[]
  requestedRoom: string | null
  status: BookingStatus
  granted: GrantedSlot | null
  roomName: string | null
  roomBuilding: string | null
  roomCapacity: number | null
  roomFeatures: string[]
  reason: string
  /** The solver placed this request outside every window it asked for. */
  moved: boolean
  /** More people asked for than the largest venue on campus seats. */
  oversized: boolean
}

export interface BoardRoom {
  id: string
  name: string
  building: string
  capacity: number
}

export interface BookingBoard {
  rows: BoardRow[]
  rooms: BoardRoom[]
  /** Only the requests that hold a slot, in day then period order. */
  placed: BoardRow[]
  resort: BoardRoom[]
  festWeek: string | null
  policyOrder: string[]
  hardViolations: number | null
  largestRoom: BoardRoom | null
  counts: Record<'all' | BookingStatus, number>
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, ' ')
}

const KNOWN_STATUSES: BookingStatus[] = [
  'pending',
  'approved',
  'alternative_offered',
  'rejected',
  'cancelled',
]

/** The solver only emits three of these; anything new falls back to queued. */
export function toBookingStatus(value: unknown): BookingStatus {
  const text = String(value ?? '')
  return KNOWN_STATUSES.includes(text as BookingStatus) ? (text as BookingStatus) : 'pending'
}

export function formatSlot(slot: Slot): string {
  return `${slot.day} ${periodRangeLabel(slot.from, slot.to - slot.from + 1)}`
}

export function formatSlotTime(slot: Slot): string {
  const label = timeRangeLabel(slot.from, slot.to - slot.from + 1)
  return label || 'outside the grid'
}

/** One window as recorded on the request, clamped so the grid can draw it. */
function toWindows(raw: unknown): Slot[] {
  if (!Array.isArray(raw)) return []
  const out: Slot[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const value = item as Record<string, unknown>
    const day = DAY_CODE[String(value.day ?? '').toUpperCase()]
    const from = Number(value.from_period)
    const to = Number(value.to_period)
    if (!day || !Number.isFinite(from) || !Number.isFinite(to)) continue
    out.push({ day, from, to: Math.max(from, to) })
  }
  return out
}

function tierOf(category: string, policyOrder: string[]): 1 | 2 | 3 {
  const rank = policyOrder.indexOf(category)
  const institute = policyOrder.indexOf('institute_event')
  const club = policyOrder.indexOf('club_event')
  if (rank < 0 || institute < 0 || club < 0) return 2
  if (rank <= institute) return 1
  if (rank >= club) return 3
  return 2
}

function countByStatus(rows: BoardRow[]): Record<'all' | BookingStatus, number> {
  const counts: Record<'all' | BookingStatus, number> = {
    all: rows.length,
    pending: 0,
    approved: 0,
    alternative_offered: 0,
    rejected: 0,
    cancelled: 0,
  }
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1
  return counts
}

const DAY_ORDER = new Map<Day, number>(DAYS.map((day, index) => [day, index]))

export function compareRows(a: BoardRow, b: BoardRow): number {
  const aDay = a.granted ? (DAY_ORDER.get(a.granted.day) ?? 99) : 99
  const bDay = b.granted ? (DAY_ORDER.get(b.granted.day) ?? 99) : 99
  if (aDay !== bDay) return aDay - bDay
  const aFrom = a.granted?.from ?? 99
  const bFrom = b.granted?.from ?? 99
  if (aFrom !== bFrom) return aFrom - bFrom
  return a.id.localeCompare(b.id, undefined, { numeric: true })
}

/**
 * Joins the official requests with the solver's decisions into one board row
 * per request. Totals are computed from the rows, never typed in.
 */
export function buildBookingBoard(
  dataset: DatasetInfo,
  schedule: ScheduleResponse,
): BookingBoard {
  const requests = new Map(dataset.entities.booking_requests.map((item) => [item.id, item]))
  const rooms = dataset.entities.rooms
  const roomsById = new Map(rooms.map((room) => [room.id, room]))
  const policyOrder = dataset.priority_order ?? []

  const largest = rooms.reduce<BoardRoom | null>((best, room) => {
    const candidate: BoardRoom = {
      id: room.id,
      name: room.name,
      building: room.building,
      capacity: room.capacity,
    }
    return !best || candidate.capacity > best.capacity ? candidate : best
  }, null)

  const rows: BoardRow[] = (schedule.decisions ?? []).map((decision) => {
    const request = requests.get(decision.request_id)
    const grantedDay = DAY_CODE[String(decision.day ?? '').toUpperCase()]
    const from = Number(decision.start_period)
    const to = Number(decision.end_period ?? decision.start_period)
    const roomId = decision.room_id ? String(decision.room_id) : null
    const room = roomId ? roomsById.get(roomId) : undefined
    const hasSlot =
      Boolean(grantedDay) && Number.isFinite(from) && Number.isFinite(to) && from > 0

    const attendance = request?.attendance ?? 0
    const category = request?.requested_category ?? 'club_event'
    const status = toBookingStatus(decision.status)

    return {
      id: decision.request_id,
      title: request?.title ?? decision.request_id,
      requester: request?.requester ?? 'Unknown requester',
      category,
      categoryLabel: categoryLabel(category),
      tier: tierOf(category, policyOrder),
      attendance,
      duration: request?.duration_periods ?? (hasSlot ? to - from + 1 : 1),
      windows: toWindows(request?.windows),
      needs: request?.needs ?? [],
      requestedRoom: request?.requested_room ?? null,
      status,
      granted: hasSlot
        ? { day: grantedDay as Day, from, to, roomId }
        : null,
      roomName: room?.name ?? null,
      roomBuilding: room?.building ?? null,
      roomCapacity: room?.capacity ?? null,
      roomFeatures: room?.features ?? [],
      reason: String(decision.reason ?? '').trim(),
      moved: status === 'alternative_offered',
      oversized: Boolean(largest && attendance > largest.capacity),
    }
  })

  rows.sort(compareRows)

  const placed = rows.filter((row) => row.granted !== null)
  const usage = new Map<string, number>()
  for (const row of placed) {
    const id = row.granted?.roomId
    if (id) usage.set(id, (usage.get(id) ?? 0) + 1)
  }
  const resort = [...rooms]
    .map((room) => ({
      id: room.id,
      name: room.name,
      building: room.building,
      capacity: room.capacity,
    }))
    .filter((room) => usage.has(room.id))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name))

  const semester = dataset.semester
  const festWeek = semester ? weekLabel(semester, semester.fest_week) : null

  return {
    rows,
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      building: room.building,
      capacity: room.capacity,
    })),
    placed,
    resort,
    festWeek,
    policyOrder,
    hardViolations: schedule.summary?.hard_violation_count ?? null,
    largestRoom: largest,
    counts: countByStatus(rows),
  }
}

/** The periods a booking occupies, for the week board's position maths. */
export function periodTicks(): number[] {
  return Object.keys(PERIOD_TIMES)
    .map(Number)
    .sort((a, b) => a - b)
}
