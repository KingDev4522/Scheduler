import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Semester } from '../lib/semester'
import {
  dateToWeek,
  formatDate,
  isSelectable,
  monthLabel,
  monthMatrix,
  parseIso,
  semesterMonths,
  todayIso,
} from '../lib/semester'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Multi-select calendar for booking dates. Only upcoming weekdays inside the
 * semester's bookable weeks (not the exam week) can be chosen.
 */
export function DatePickerCalendar({
  semester,
  dates,
  onChange,
}: {
  semester: Semester | null
  dates: string[]
  onChange: (dates: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const today = todayIso()
  const months = useMemo(() => (semester ? semesterMonths(semester) : []), [semester])
  const initialMonth = useMemo(() => {
    if (!semester) return 0
    const first = dates[0] ?? semester.semester_start
    const anchor = parseIso(first)
    const found = months.findIndex(
      (entry) => entry.year === anchor.getUTCFullYear() && entry.month === anchor.getUTCMonth(),
    )
    if (found >= 0) return found
    const now = parseIso(today)
    const current = months.findIndex((entry) => entry.year === now.getUTCFullYear() && entry.month === now.getUTCMonth())
    return current >= 0 ? current : 0
  }, [semester, dates, months, today])
  const [index, setIndex] = useState(initialMonth)

  useEffect(() => {
    if (!open) return undefined
    const handler = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (iso: string) => {
    onChange(dates.includes(iso) ? dates.filter((item) => item !== iso) : [...dates, iso].sort())
  }

  const current = months[Math.min(index, Math.max(months.length - 1, 0))]
  const grid = useMemo(
    () => (semester && current ? monthMatrix(current.year, current.month) : []),
    [semester, current],
  )

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
      >
        <CalendarDays className="h-4 w-4" aria-hidden />
        {dates.length > 0 ? `${dates.length} date${dates.length === 1 ? '' : 's'} selected` : 'Pick date(s)'}
      </button>

      {semester && dates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dates.map((iso) => {
            const week = dateToWeek(semester, iso)
            return (
              <span
                key={iso}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
              >
                {formatDate(iso)}
                {week ? ` · W${week.number}` : ''}
                <button type="button" onClick={() => toggle(iso)} aria-label={`Remove ${iso}`}>
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Choose booking dates"
          className="absolute z-50 mt-2 w-[19rem] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
        >
          {!semester ? (
            <p className="text-xs text-slate-500">
              No calendar is available because the dataset has no dates.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  disabled={index <= 0}
                  aria-label="Previous month"
                  className="rounded-lg border border-slate-300 p-1 text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="text-xs font-semibold text-slate-800">
                  {current ? monthLabel(current.year, current.month) : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setIndex((value) => Math.min(months.length - 1, value + 1))}
                  disabled={index >= months.length - 1}
                  aria-label="Next month"
                  className="rounded-lg border border-slate-300 p-1 text-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {DOW.map((day) => (
                  <span key={day} className="text-center text-[9px] font-semibold uppercase text-slate-400">
                    {day}
                  </span>
                ))}
                {grid.flat().map((iso) => {
                  const inMonth = current ? parseIso(iso).getUTCMonth() === current.month : false
                  const week = dateToWeek(semester, iso)
                  const selectable = isSelectable(semester, iso, today)
                  const selected = dates.includes(iso)
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!selectable}
                      onClick={() => toggle(iso)}
                      title={
                        selectable
                          ? `${formatDate(iso)} · Week ${week?.number} · click to ${selected ? 'remove' : 'add'}`
                          : `${formatDate(iso)} · not bookable`
                      }
                      className={`flex h-8 flex-col items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white'
                          : selectable
                            ? 'bg-slate-50 text-slate-800 hover:bg-slate-200'
                            : 'text-slate-300'
                      } ${inMonth ? '' : 'opacity-40'} ${
                        week?.phase === 'spectra' && !selected ? 'ring-1 ring-amber-300' : ''
                      }`}
                    >
                      {parseIso(iso).getUTCDate()}
                      {week && inMonth && (
                        <span className={`text-[8px] leading-none ${selected ? 'text-slate-200' : 'text-slate-400'}`}>
                          W{week.number}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>Upcoming weekdays · weeks 1–{semester.exam_week - 1} · W{semester.exam_week} is exams</span>
                {dates.length > 0 && (
                  <button type="button" onClick={() => onChange([])} className="font-semibold text-slate-600 hover:underline">
                    Clear
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
