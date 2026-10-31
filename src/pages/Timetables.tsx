import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarRange, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState } from '../components/States'
import { TimetableGrid } from '../components/TimetableGrid'
import { getData } from '../lib/store'
import {
  TIMETABLE_VIEWS,
  conflictsForView,
  facultyById,
  groupById,
  roomById,
  sessionsForView,
  viewOptions,
  type TimetableView,
} from '../lib/selectors'
import { DAYS } from '../lib/time'

function isTimetableView(value: string | null): value is TimetableView {
  return value === 'group' || value === 'faculty' || value === 'room'
}

export default function Timetables() {
  const [data] = useState(getData)
  const [params, setParams] = useSearchParams()

  const viewParam = params.get('view')
  const view: TimetableView = isTimetableView(viewParam) ? viewParam : 'group'
  const options = viewOptions(data, view)
  const requestedId = params.get('id')
  const unknownSelection = requestedId !== null && !options.some((option) => option.id === requestedId)
  const selectedId = requestedId && !unknownSelection ? requestedId : options[0]?.id ?? ''

  const setView = (nextView: TimetableView) => {
    const next = new URLSearchParams(params)
    next.set('view', nextView)
    next.delete('id')
    setParams(next, { replace: true })
  }

  const setSelection = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('view', view)
    next.set('id', id)
    setParams(next, { replace: true })
  }

  const label =
    view === 'group'
      ? groupById(data, selectedId)?.name
      : view === 'faculty'
        ? facultyById(data, selectedId)?.name
        : roomById(data, selectedId)?.name

  if (data.sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Timetables" subtitle="Weekly teaching grid" />
        <EmptyState
          icon={CalendarRange}
          title="No timetable data yet"
          description="Import the official dataset to populate the weekly grid. Until then this view stays empty."
        />
      </div>
    )
  }

  if (unknownSelection) {
    return (
      <div>
        <PageHeader title="Timetables" subtitle="Weekly teaching grid" />
        <ErrorState
          title="That selection no longer exists"
          description={`"${requestedId}" is not a ${view} in the current dataset. Choose another view or reset the filter.`}
          onRetry={() => setView(view)}
        />
      </div>
    )
  }

  const sessions = sessionsForView(data, view, selectedId)
  const viewConflicts = conflictsForView(data, view, selectedId)

  return (
    <div>
      <PageHeader
        title="Timetables"
        subtitle="Monday–Friday, P1–P9 with a lunch divider and the event-only P10–P13 band. Demo data — not solver output and not validator-checked."
      />

      <p className="mb-4 text-xs text-slate-500">
        {data.sessions.length} demo sessions · {data.groups.length} groups · {data.faculty.length}{' '}
        faculty · {data.rooms.length} rooms
      </p>

      {/* View switching */}
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">View by</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {TIMETABLE_VIEWS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setView(option.id)}
                  aria-pressed={view === option.id}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === option.id
                      ? 'bg-white text-neutral-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[12rem] flex-1 sm:max-w-xs">
            <label htmlFor="timetable-entity" className="mb-1 block text-xs font-medium text-slate-600">
              {view === 'group' ? 'Student group' : view === 'faculty' ? 'Faculty member' : 'Room'}
            </label>
            <select
              id="timetable-entity"
              value={selectedId}
              onChange={(event) => setSelection(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500">
            <p className="font-semibold text-slate-700">{label}</p>
            <p>
              {sessions.length} sessions ·{' '}
              {sessions.reduce((sum, session) => sum + session.periods, 0)} periods/week
            </p>
          </div>
        </div>

        {/* Per-day load summary */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DAYS.map((day) => {
            const load = sessions
              .filter((session) => session.day === day)
              .reduce((sum, session) => sum + session.periods, 0)
            const heavy = view === 'group' && load > 6
            return (
              <span
                key={day}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  heavy ? 'bg-neutral-200 text-neutral-800' : 'bg-slate-100 text-slate-600'
                }`}
                title={heavy ? 'Group exceeds 6 class hours on this day (soft constraint S03).' : undefined}
              >
                {day} {load}p{heavy ? ' ⚠' : ''}
              </span>
            )
          })}
        </div>
      </section>

      {sessions.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={`No sessions for ${label ?? 'this selection'}`}
          description="This demo dataset has no teaching sessions for the selected view. Choose another group, faculty member or room."
        />
      ) : (
        <TimetableGrid data={data} sessions={sessions} view={view} />
      )}

      {/* Legend */}        <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-neutral-900">Legend</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-neutral-300 bg-neutral-100" aria-hidden />
            Lecture
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-neutral-300 bg-neutral-100" aria-hidden />
            Lab (3-hour blocks start at P2 or P6)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-neutral-300 bg-neutral-100" aria-hidden />
            Event-only band P10–P13 (18:00–22:00)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-3 w-5 items-center justify-center rounded border border-neutral-400 bg-neutral-100" aria-hidden>
              <AlertTriangle className="h-2.5 w-2.5 text-neutral-700" />
            </span>
            Overlap warning
          </span>
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">
          Labels are always written in text, so the grid never relies on colour alone. On phones the
          timetable switches to a stacked per-day agenda.
        </p>
      </section>

      {/* Deterministic checks for this view */}
      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          {viewConflicts.length === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-neutral-600" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 text-neutral-600" aria-hidden />
          )}
          Checks for this view
        </h3>
        {viewConflicts.length === 0 ? (
          <p className="mt-1.5 text-sm text-neutral-500">
            No room, faculty, group, capacity or timing issues detected for {label ?? 'this view'} in
            the demo data.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {viewConflicts.map((conflict) => (
              <li
                key={conflict.id}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  conflict.severity === 'critical'
                    ? 'border-neutral-200 bg-neutral-50 text-neutral-800'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                }`}
              >
                <p className="font-semibold">
                  <span className="mr-1.5 rounded bg-white/60 px-1 py-0.5 text-[10px]">
                    {conflict.code}
                  </span>
                  {conflict.title}
                </p>
                <p className="mt-0.5 leading-relaxed opacity-90">{conflict.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
