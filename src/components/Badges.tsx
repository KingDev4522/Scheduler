import type { BookingPriority, BookingStatus, RoomType, SessionKind } from '../lib/store'

const STATUS_STYLES: Record<BookingStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-neutral-100 text-neutral-700' },
  approved: { label: 'Approved', className: 'bg-neutral-100 text-neutral-800' },
  rejected: { label: 'Rejected', className: 'bg-neutral-100 text-neutral-800' },
  alternative_offered: { label: 'Alternative offered', className: 'bg-neutral-100 text-neutral-800' },
  cancelled: { label: 'Cancelled', className: 'bg-neutral-100 text-neutral-500' },
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  )
}

const PRIORITY_STYLES: Record<BookingPriority, { label: string; className: string }> = {
  1: { label: 'Tier 1 · institute', className: 'bg-neutral-900 text-white' },
  2: { label: 'Tier 2 · department', className: 'bg-neutral-800 text-white' },
  3: { label: 'Tier 3 · club', className: 'bg-neutral-200 text-neutral-700' },
}

export function PriorityBadge({ priority }: { priority: BookingPriority }) {
  const style = PRIORITY_STYLES[priority]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  )
}

const ROOM_TYPES: Record<RoomType, string> = {
  lecture: 'Lecture hall',
  lab: 'Laboratory',
  seminar: 'Seminar room',
  auditorium: 'Auditorium',
}

export function RoomTypeBadge({ type }: { type: RoomType }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
      {ROOM_TYPES[type]}
    </span>
  )
}

export function SessionKindBadge({ kind }: { kind: SessionKind }) {
  const isLab = kind === 'lab'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isLab ? 'bg-neutral-200 text-neutral-800' : 'bg-neutral-100 text-neutral-800'
      }`}
    >
      {isLab ? 'Lab' : 'Lecture'}
    </span>
  )
}
