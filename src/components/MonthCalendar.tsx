import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Semester } from '../lib/semester'
import {
  dateToWeek,
  formatDate,
  monthLabel,
  monthMatrix,
  parseIso,
  phaseLabel,
  semesterMonths,
} from '../lib/semester'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function MonthCalendar({
  semester,
  selectedWeek,
  onSelectWeek,
  eventDates = [],
  examDays = [],
  onSelectDate,
}: {
  semester: Semester
  selectedWeek: number
  onSelectWeek: (week: number) => void
  eventDates?: string[]
  examDays?: string[]
  onSelectDate?: (iso: string) => void
}) {
  const months = useMemo(() => semesterMonths(semester), [semester])
  const initial = useMemo(() => {
    const week = semester.weeks.find((item) => item.number === selectedWeek) ?? semester.weeks[0]
    const monday = parseIso(week.monday)
    const found = months.findIndex(
      (entry) => entry.year === monday.getUTCFullYear() && entry.month === monday.getUTCMonth(),
    )
    return found >= 0 ? found : 0
  }, [semester, selectedWeek, months])
  const [index, setIndex] = useState(initial)
  const current = months[Math.min(index, months.length - 1)] ?? months[0]
  const grid = useMemo(() => monthMatrix(current.year, current.month), [current])
  const eventSet = useMemo(() => new Set(eventDates), [eventDates])
  const examSet = useMemo(() => new Set(examDays), [examDays])

  return (
    <section className="cit-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{monthLabel(current.year, current.month)}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Weeks with real dates; only Week {semester.fest_week} has events and Week {semester.exam_week} is exams.
          </p>
        </div>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index <= 0}
            aria-label="Previous month"
            className="rounded-lg border border-slate-300 p-1.5 text-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setIndex((value) => Math.min(months.length - 1, value + 1))}
            disabled={index >= months.length - 1}
            aria-label="Next month"
            className="rounded-lg border border-slate-300 p-1.5 text-slate-700 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))] border-b border-slate-100 bg-slate-50/70">
        <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Week</div>
        {DOW.map((day) => (
          <div key={day} className="border-l border-slate-100 px-2 py-2 text-center text-[11px] font-semibold text-slate-600">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[58px_repeat(7,minmax(0,1fr))]">
        {grid.map((row) => {
          const week = row.map((iso) => dateToWeek(semester, iso)).find((item) => item) ?? null
          return (
            <div key={row[0]} className="contents">
              <div
                className={`flex flex-col items-center justify-center border-b border-slate-100 px-1 py-2 text-center ${
                  week?.number === selectedWeek ? 'bg-slate-100' : ''
                }`}
              >
                {week ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectWeek(week.number)}
                      className="text-[11px] font-bold text-slate-800 hover:underline"
                    >
                      W{week.number}
                    </button>
                    {week.phase !== 'teaching' && (
                      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        {phaseLabel(week.phase)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-slate-300">—</span>
                )}
              </div>

              {row.map((iso) => {
                const inMonth = parseIso(iso).getUTCMonth() === current.month
                const cellWeek = dateToWeek(semester, iso)
                const isSelected = cellWeek?.number === selectedWeek
                const phase = cellWeek?.phase
                const base = phase === 'spectra' ? 'bg-amber-50' : phase === 'exams' ? 'bg-violet-50' : 'bg-white'
                const hasEvent = eventSet.has(iso)
                const hasExam = examSet.has(iso)
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!cellWeek}
                    onClick={() => {
                      if (!cellWeek) return
                      onSelectWeek(cellWeek.number)
                      onSelectDate?.(iso)
                    }}
                    title={cellWeek ? `${formatDate(iso)} · Week ${cellWeek.number} · ${phaseLabel(cellWeek.phase)}` : formatDate(iso)}
                    className={`relative min-h-[3.25rem] border-b border-l border-slate-100 px-1.5 py-1 text-left transition-colors ${
                      inMonth ? base : 'bg-white'
                    } ${cellWeek ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'} ${
                      isSelected ? 'ring-2 ring-inset ring-slate-900' : ''
                    }`}
                  >
                    <span className={`text-[11px] font-semibold ${inMonth ? 'text-slate-800' : 'text-slate-300'}`}>
                      {parseIso(iso).getUTCDate()}
                    </span>
                    {(hasEvent || hasExam) && (
                      <span className="mt-1 flex items-center gap-1">
                        {hasEvent && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="event" />}
                        {hasExam && <span className="h-2 w-2 rounded-full bg-violet-600" aria-label="exam" />}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 px-5 py-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded border border-amber-300 bg-amber-50" aria-hidden /> Spectra week
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded border border-violet-300 bg-violet-50" aria-hidden /> Midsem exams
        </span>
        <span className="ml-auto">Click a date to open that week</span>
      </div>
    </section>
  )
}
