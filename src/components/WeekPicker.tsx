import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Semester, WeekPhase } from '../lib/semester'
import { phaseLabel, weekLabel } from '../lib/semester'

const PHASE_STYLE: Record<WeekPhase, string> = {
  teaching: 'border-slate-200 bg-white text-slate-700',
  spectra: 'border-amber-300 bg-amber-50 text-amber-900',
  exams: 'border-violet-300 bg-violet-50 text-violet-900',
}

const PHASE_ACTIVE: Record<WeekPhase, string> = {
  teaching: 'bg-slate-900 text-white border-slate-900',
  spectra: 'bg-amber-500 text-white border-amber-500',
  exams: 'bg-violet-600 text-white border-violet-600',
}

export function WeekPicker({
  semester,
  week,
  onChange,
  view,
  onViewChange,
  showViewToggle = true,
}: {
  semester: Semester
  week: number
  onChange: (week: number) => void
  view: 'week' | 'month'
  onViewChange: (view: 'week' | 'month') => void
  showViewToggle?: boolean
}) {
  const index = semester.weeks.findIndex((item) => item.number === week)
  const move = (delta: number) => {
    const next = semester.weeks[index + delta]
    if (next) onChange(next.number)
  }

  return (
    <section className="cit-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarRange className="h-4 w-4 text-neutral-700" aria-hidden /> Semester calendar
          </h3>
          <p className="mt-0.5 text-xs font-medium text-slate-600">{weekLabel(semester, week)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{semester.assumption}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showViewToggle && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(['week', 'month'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onViewChange(option)}
                  aria-pressed={view === option}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    view === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={index <= 0}
              aria-label="Previous week"
              className="rounded-lg border border-slate-300 p-1.5 text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={index < 0 || index >= semester.weeks.length - 1}
              aria-label="Next week"
              className="rounded-lg border border-slate-300 p-1.5 text-slate-700 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {semester.weeks.map((item) => (
          <button
            key={item.number}
            type="button"
            onClick={() => onChange(item.number)}
            title={`${weekLabel(semester, item.number)} · ${phaseLabel(item.phase)}`}
            aria-pressed={item.number === week}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              item.number === week ? PHASE_ACTIVE[item.phase] : PHASE_STYLE[item.phase]
            }`}
          >
            W{item.number}
            {item.phase !== 'teaching' ? ' •' : ''}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded border border-amber-300 bg-amber-50" aria-hidden /> Spectra week
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded border border-violet-300 bg-violet-50" aria-hidden /> Midsem exams
        </span>
        <span>Teaching weeks 1–6 reuse the same solved weekly template.</span>
      </div>
    </section>
  )
}
