import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, CalendarRange, CheckCircle2 } from 'lucide-react'
import { SOFT_EASE } from '../lib/motion'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { WeekCalendar } from '../components/WeekCalendar'
import { WeekPicker } from '../components/WeekPicker'
import { weekDates, weekLabel } from '../lib/semester'
import { type AppData } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import {
  buildOfficialView,
  officialOptions,
  officialSessionsForView,
} from '../lib/official'
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

const EMPTY_DATA: AppData = {
  version: 0,
  rooms: [],
  faculty: [],
  groups: [],
  sessions: [],
  bookings: [],
  proposals: [],
  audit: [],
}

export default function Timetables() {
  const { user } = useAuth()
  const official = useOfficial()
  const officialView = useMemo(
    () =>
      official.dataset && official.schedule
        ? buildOfficialView(official.dataset, official.schedule)
        : null,
    [official.dataset, official.schedule],
  )
  const data = officialView?.data ?? EMPTY_DATA
  const usingOfficial = officialView !== null
  const [params, setParams] = useSearchParams()

  if (official.loading && !official.dataset && !official.error) {
    return <PageSkeleton label="Loading timetables…" variant="calendar" />
  }

  const viewParam = params.get('view')
  const view: TimetableView = isTimetableView(viewParam) ? viewParam : 'group'
  const options = officialView ? officialOptions(officialView, view) : viewOptions(data, view)
  const requestedId = params.get('id')
  const facultyName =
    user?.role === 'faculty'
      ? data.faculty.find((member) =>
          member.name
            .toLowerCase()
            .includes(user.displayName.split(' ').slice(-1)[0]!.toLowerCase()),
        )?.id
      : undefined
  const defaultId =
    view === 'faculty' && facultyName && options.some((option) => option.id === facultyName)
      ? facultyName
      : options[0]?.id ?? ''
  const unknownSelection = requestedId !== null && !options.some((option) => option.id === requestedId)
  const selectedId = requestedId && !unknownSelection ? requestedId : defaultId

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

  const semester = official.dataset?.semester ?? null
  const weekParam = params.get('week')
  const selectedWeek =
    weekParam && /^\d+$/.test(weekParam) ? Number(weekParam) : semester?.fest_week ?? 1
  const setWeek = (value: number) => {
    const next = new URLSearchParams(params)
    next.set('week', String(value))
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

  const sessions = officialView
    ? officialSessionsForView(officialView, view, selectedId)
    : sessionsForView(data, view, selectedId)
  const viewConflicts = conflictsForView(data, view, selectedId)

  return (
    <div className="cit-page">
      <PageHeader
        title="Timetables"
        subtitle={
          usingOfficial
            ? 'Published solver output from the FastAPI backend, adapted into group, faculty and room views.'
            : 'Generate the official schedule in Import / Exports to populate the weekly grid.'
        }
      />

      <p className="mb-4 text-sm font-medium text-black">
        {usingOfficial ? 'Official schedule' : 'No official schedule'} · {data.sessions.length} sessions ·{' '}
        {data.groups.length} groups · {data.faculty.length} faculty · {data.rooms.length} rooms
      </p>

      {semester && (
        <div className="mb-4">
          <WeekPicker
            semester={semester}
            week={selectedWeek}
            onChange={setWeek}
            view="week"
            onViewChange={() => {}}
            showViewToggle={false}
          />
        </div>
      )}

      {/* View switching */}
      <section className="cit-card mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                  className={`relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === option.id ? 'text-neutral-800' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {view === option.id && (
                    <motion.span
                      layoutId="timetable-view-pill"
                      className="absolute inset-0 rounded-md bg-white shadow-sm"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{option.label}</span>
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
            const facultyLimit = view === 'faculty' ? facultyById(data, selectedId)?.dailyLimit ?? 4 : null
            const heavy = view === 'group' ? load > 6 : facultyLimit !== null ? load > facultyLimit : false
            const label = facultyLimit !== null ? `${load}/${facultyLimit}h` : `${load}p`
            return (
              <span
                key={day}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  heavy ? 'bg-neutral-200 text-neutral-800' : 'bg-slate-100 text-slate-600'
                }`}
                title={
                  view === 'group'
                    ? load > 6
                      ? 'Group exceeds 6 class hours on this day (soft constraint S03).'
                      : undefined
                    : facultyLimit !== null
                      ? `Faculty daily teaching limit ${facultyLimit}h (hard constraint H12).`
                      : undefined
                }
              >
                {day} {label}
                {heavy ? ' ⚠' : ''}
              </span>
            )
          })}
        </div>
      </section>

      <motion.div
        key={`${view}-${selectedId}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: SOFT_EASE }}
      >
        {sessions.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title={`No sessions for ${label ?? 'this selection'}`}
            description="This timetable has no teaching sessions for the selected view. Choose another group, faculty member or room."
          />
        ) : (
          <WeekCalendar
            sessions={sessions}
            rooms={data.rooms}
            faculty={data.faculty}
            groups={data.groups}
            title={label ? `${label} · study timetable` : 'Study timetable'}
            subtitle={`Classes only · ${
              semester ? weekLabel(semester, selectedWeek) : 'Mon–Fri'
            } · P1 08:00–P9 17:00 · lunch 13:00–14:00`}
            badge="Study view"
            weekDates={semester ? weekDates(semester, selectedWeek) : []}
          />
        )}
      </motion.div>

      {/* Legend */}        <section className="cit-card mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
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
      <section className="cit-card mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          {viewConflicts.length === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-neutral-600" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 text-neutral-600" aria-hidden />
          )}
          Checks for this view
        </h3>
        <p className="mt-1.5 text-xs text-neutral-500">
          In-browser checks (not the official validator).
        </p>
        {viewConflicts.length === 0 ? (
          <p className="mt-1.5 text-sm text-neutral-500">
            No room, faculty, group, capacity or timing issues detected for {label ?? 'this view'} in
            the in-browser checks.
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
