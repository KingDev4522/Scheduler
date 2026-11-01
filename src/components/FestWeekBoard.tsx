import { motion } from 'framer-motion'
import type { BoardRow } from '../lib/bookingBoard'
import { formatSlot } from '../lib/bookingBoard'
import type { Semester } from '../lib/semester'
import { formatShortDate, weekDates } from '../lib/semester'
import { DAYS, type Day } from '../lib/time'
import { SOFT_EASE } from '../lib/motion'
import { cn } from '../lib/utils'

const DAY_FULL: Record<Day, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
}

export function FestWeekBoard({
  rows,
  semester,
  selectedId,
  onSelect,
}: {
  rows: BoardRow[]
  semester: Semester | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const dates = semester ? weekDates(semester, semester.fest_week) : []

  const byDay = new Map<Day, BoardRow[]>(DAYS.map((day) => [day, []]))
  for (const row of rows) {
    if (!row.granted) continue
    byDay.get(row.granted.day)?.push(row)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.granted?.from ?? 99) - (b.granted?.from ?? 99))
  }

  return (
    <section
      aria-labelledby="fest-week-heading"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3">
        <h3 id="fest-week-heading" className="text-[15px] font-semibold text-slate-900">
          The fest week, day by day
        </h3>
        <p className="text-[12px] text-slate-500">
          {rows.length} placed slot{rows.length === 1 ? '' : 's'} · rooms block the same period, so a
          day can hold several at once
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-5">
        {DAYS.map((day, dayIndex) => {
          const items = byDay.get(day) ?? []
          const date = dates[dayIndex]
          return (
            <div key={day} className="flex min-w-0 flex-col bg-white p-2.5">
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <span className="text-[12px] font-semibold text-slate-900">
                  <span className="sm:hidden">{DAY_FULL[day]}</span>
                  <span className="hidden sm:inline">{day}</span>
                </span>
                <span className="text-[12px] tabular-nums text-slate-500">
                  {date ? formatShortDate(date) : ''}
                  {items.length > 0 ? ` · ${items.length}` : ''}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="px-1 py-2 text-[12px] text-slate-400">No bookings</p>
              ) : (
                <ul className="flex flex-1 flex-col gap-0.5">
                  {items.map((row, index) => {
                    const active = row.id === selectedId
                    return (
                      <li key={row.id} className="min-w-0">
                        <motion.button
                          type="button"
                          onClick={() => onSelect(row.id)}
                          aria-pressed={active}
                          title={`${row.title} · ${row.roomName ?? 'no venue'} · ${formatSlot(row.granted!)}${row.moved ? ' · moved outside the window asked for' : ''}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: Math.min(dayIndex * 0.04 + index * 0.025, 0.5),
                            ease: SOFT_EASE,
                          }}
                          className={cn(
                            'flex w-full rounded-lg border px-2 py-1.5 text-left transition-colors duration-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950',
                            active
                              ? 'border-slate-300 bg-slate-50'
                              : row.moved
                                ? 'border-transparent bg-amber-50/70 hover:bg-amber-50'
                                : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-1.5">
                              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-900">
                                P{row.granted!.from}–{row.granted!.to}
                              </span>
                              <span className="truncate text-[12px] text-slate-500">
                                {row.roomName ?? 'No venue'}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] leading-snug text-slate-700">
                              {row.title}
                            </span>
                          </span>
                        </motion.button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
