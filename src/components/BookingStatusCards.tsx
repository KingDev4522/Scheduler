import { motion } from 'framer-motion'
import type { BookingStatus } from '../lib/store'
import { SOFT_EASE } from '../lib/motion'
import { cn } from '../lib/utils'
import { STATUS_LABEL } from './BookingStatus'

export type StatusFilter = 'all' | BookingStatus

export interface StatusCard {
  key: StatusFilter
  label: string
  count: number
}

export function BookingStatusCards({
  cards,
  selected,
  onSelect,
}: {
  cards: StatusCard[]
  selected: StatusFilter
  onSelect: (key: StatusFilter) => void
}) {
  return (
    <div
      role="group"
      aria-label="Filter requests by status"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {cards.map((card, index) => {
        const active = card.key === selected
        return (
          <motion.button
            key={card.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(card.key)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: index * 0.04, ease: SOFT_EASE }}
            className={cn(
              'group flex min-w-0 flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950',
              active
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <span
              className={cn(
                'truncate text-[12px] font-medium',
                active ? 'opacity-75' : 'text-slate-500',
              )}
            >
              {card.label}
            </span>
            <span
              className={cn(
                'text-[22px] font-semibold leading-none tabular-nums',
                active ? '' : 'text-slate-900',
              )}
            >
              {card.count}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}

export function statusCardsFromCounts(
  counts: Record<'all' | BookingStatus, number>,
): StatusCard[] {
  const cards: StatusCard[] = [{ key: 'all', label: 'All requests', count: counts.all }]
  const order: BookingStatus[] = [
    'pending',
    'approved',
    'alternative_offered',
    'rejected',
    'cancelled',
  ]
  for (const status of order) {
    const count = counts[status] ?? 0
    // A status nobody used is not a filter worth a card; zeros that remain print as 0.
    if (count === 0) continue
    cards.push({ key: status, label: STATUS_LABEL[status], count })
  }
  return cards
}
