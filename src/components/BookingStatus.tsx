import type { BookingStatus } from '../lib/store'
import { cn } from '../lib/utils'

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Awaiting decision',
  approved: 'Approved',
  alternative_offered: 'Alternative offered',
  rejected: 'Refused',
  cancelled: 'Withdrawn',
}

/**
 * Pale tint + dark ink of the same hue. Every class here is remapped by the
 * project's own `.dark` block in index.css, so the pills read in both themes.
 */
const PILL: Record<BookingStatus, string> = {
  pending: 'border-slate-200 bg-slate-100 text-slate-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  alternative_offered: 'border-amber-200 bg-amber-50 text-amber-900',
  rejected: 'border-rose-200 bg-rose-50 text-rose-800',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
}

export const STATUS_DOT: Record<BookingStatus, string> = {
  pending: 'bg-slate-400',
  approved: 'bg-emerald-600',
  alternative_offered: 'bg-amber-600',
  rejected: 'bg-rose-600',
  cancelled: 'bg-slate-300',
}

export const STATUS_BAR: Record<BookingStatus, string> = {
  pending: 'bg-slate-300',
  approved: 'bg-emerald-500',
  alternative_offered: 'bg-amber-500',
  rejected: 'bg-rose-500',
  cancelled: 'bg-slate-200',
}

export function StatusPill({
  status,
  className,
}: {
  status: BookingStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[12px] font-medium',
        PILL[status],
        className,
      )}
    >
      <span className="truncate">{STATUS_LABEL[status]}</span>
    </span>
  )
}
