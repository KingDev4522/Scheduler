import { motion } from 'framer-motion'
import type { BoardRow } from '../lib/bookingBoard'
import { formatSlot, formatSlotTime } from '../lib/bookingBoard'
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
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 id="fest-week-heading" className="text-[15px] font-semibold text-slate-900">
            The fest week, day by day
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Every granted slot on the campus period grid · P1–P13, lunch between P5 and P6
          </p>
        </div>
        <p className="text-[12px] tabular-nums text-slate-500">
          {rows.length} placed · {new Set(rows.map((row) => row.roomName)).size} venues
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {DAYS.map((day, dayIndex) => {
          const items = byDay.get(day) ?? []
          const date = dates[dayIndex]
          return (
            <div
              key={day}
              className={cn(
                'flex min-w-0 flex-col border-t border-slate-200',
                dayIndex === 0 ? 'border-t-0' : '',
                'sm:border-t-0',
                dayIndex > 0 ? 'sm:border-l sm:border-slate-200' : '',
              )}
            >
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[13px] font-semibold text-slate-900">
                  <span className="sm:hidden">{DAY_FULL[day]}</span>
                  <span className="hidden sm:inline">{day}</span>
                </span>
                <span className="text-[12px] tabular-nums text-slate-500">
                  {date ? formatShortDate(date) : ''}
                  {items.length > 0 ? ` · ${items.length}` : ''}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-slate-400">No bookings</p>
              ) : (
                <ul className="flex-1 divide-y divide-slate-100">
                  {items.map((row, index) => {
                    const active = row.id === selectedId
                    return (
                      <li key={row.id} className="min-w-0">
                        <motion.button
                          type="button"
                          onClick={() => onSelect(row.id)}
                          aria-pressed={active}
                          title={`${row.title} · ${row.roomName ?? 'no venue'} · ${formatSlot(row.granted!)} · ${formatSlotTime(row.granted!)}${
                            row.moved ? ' · moved outside the window asked for' : ''
                          }`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: Math.min(dayIndex * 0.04 + index * 0.025, 0.5),
                            ease: SOFT_EASE,
                          }}
                          className={cn(
                            'block w-full px-3 py-2 text-left transition-colors duration-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-slate-300',
                            active
                              ? 'bg-slate-100'
                              : row.moved
                                ? 'bg-amber-50/70 hover:bg-amber-50'
                                : 'hover:bg-slate-50',
                          )}
                        >
                          <span className="flex items-baseline gap-1.5">
                            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-900">
                              P{row.granted!.from}–{row.granted!.to}
                            </span>
                            <span className="truncate text-[12px] tabular-nums text-slate-500">
                              {formatSlotTime(row.granted!)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                            {row.roomName ?? 'No venue'}
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] leading-snug text-slate-800">
                            {row.title}
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
