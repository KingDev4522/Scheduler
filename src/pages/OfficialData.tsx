import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CalendarDays, CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { SOFT_EASE } from '../lib/motion'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { WeekCalendar } from '../components/WeekCalendar'
import { BookingStatusBadge, PriorityBadge } from '../components/Badges'
import { useOfficial } from '../hooks/useOfficial'
import { buildOfficialView, officialOptions, officialSessionsForView } from '../lib/official'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

type Tab = 'timetable' | 'exams' | 'bookings' | 'changes'
type ViewType = 'group' | 'faculty' | 'room'

const TABS: { id: Tab; label: string }[] = [
  { id: 'timetable', label: 'Timetable' },
  { id: 'exams', label: 'Exams' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'changes', label: 'Changes' },
]

export default function OfficialData() {
  const official = useOfficial()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('timetable')
  const [view, setView] = useState<ViewType>('group')
  const [entityId, setEntityId] = useState('')
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const download = async (name: string) => {
    if (!user) return
    setDownloadError(null)
    try {
      await api.downloadExport(name, user.username)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : `Could not download ${name}.`)
    }
  }

  const datasetReady = Boolean(official.dataset?.entities?.rooms)
  const viewData = useMemo(
    () =>
      official.dataset && official.schedule && datasetReady
        ? buildOfficialView(official.dataset, official.schedule)
        : null,
    [official.dataset, official.schedule, datasetReady],
  )

  const options = useMemo(
    () => (viewData ? officialOptions(viewData, view) : []),
    [viewData, view],
  )
  const selectedId = options.some((option) => option.id === entityId)
    ? entityId
    : options[0]?.id ?? ''
  const sessions = useMemo(
    () => (viewData && selectedId ? officialSessionsForView(viewData, view, selectedId) : []),
    [viewData, view, selectedId],
  )

  if (official.loading) {
    return (
      <PageSkeleton
        label="Loading official dataset and schedule…"
        variant="calendar"
        cards={4}
      />
    )
  }

  if (official.error && !official.health) {
    return (
      <div>
        <PageHeader title="Official data" subtitle="The Python engine is not reachable." />
        <ErrorState
          title="Backend not reachable"
          description={`${official.error}. Start it with: python -m uvicorn backend.app:app --port 8000`}
          onRetry={() => void official.refresh()}
        />
      </div>
    )
  }

  if (!official.dataset) {
    return (
      <div>
        <PageHeader title="Official data" subtitle="No dataset loaded." />
        <EmptyState
          icon={CalendarDays}
          title="No official dataset"
          description="Load cit_public.json in Import / Exports, then generate a schedule."
          action={
            <Link
              to="/admin"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Open Import / Exports
            </Link>
          }
        />
      </div>
    )
  }

  if (!datasetReady) {
    return (
      <div>
        <PageHeader title="Official data" subtitle="Backend response is incomplete." />
        <ErrorState
          title="Backend is running an older version"
          description="Restart the API to load the dataset entities: python -m uvicorn backend.app:app --port 8000"
          onRetry={() => void official.refresh()}
        />
      </div>
    )
  }

  const summary = official.schedule?.summary
  const dataset = official.dataset

  return (
    <div className="cit-page">
      <PageHeader
        title="Official data"
        subtitle={`${dataset.institute} · ${dataset.dataset_id} · source ${dataset.source}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
          Backend connected
        </span>
        {official.schedule && summary ? (
          <>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                summary.hard_violation_count === 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {summary.hard_violation_count} hard violations
            </span>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-black">
              soft {summary.soft_total}
            </span>
            {summary.bookings && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-black">
                booking score {summary.bookings.booking_score}/
                {summary.bookings.booking_score_max_if_all_approved}
              </span>
            )}
            <button
              type="button"
              onClick={() => void download('schedule.json')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
            >
              <Download className="h-3.5 w-3.5" aria-hidden /> schedule.json
            </button>
            {official.schedule.proposal_status === 'approved' ? (
              <button
                type="button"
                onClick={() => void download('schedule_after.json')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> schedule_after.json
              </button>
            ) : (
              <span className="text-xs font-medium text-black">
                schedule_after.json after approval
              </span>
            )}
          </>
        ) : (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            No schedule generated yet
          </span>
        )}
        <button
          type="button"
          onClick={() => void official.refresh()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
        </button>
      </div>

      {downloadError && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {downloadError}
        </p>
      )}

      {!official.schedule || !viewData ? (
        <EmptyState
          icon={CalendarDays}
          title="Generate the official schedule"
          description="The dataset is loaded. Run the CP-SAT engine from Import / Exports to generate the timetable, exams and Spectra decisions."
          action={
            <Link
              to="/admin"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Go to Import / Exports
            </Link>
          }
        />
      ) : (
        <>
          <section className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-900">Why this timetable?</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              Hard constraints are enforced first. Among feasible timetables, CP-SAT minimises the
              official soft penalties; a class may sit at P1/P9 or in a larger room because moving it
              would create a hard conflict or a larger penalty. This run has{' '}
              {summary?.hard_violation_count ?? 0} hard violations and soft total{' '}
              {summary?.soft_total ?? '—'}.
            </p>
            {summary && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(summary.soft_penalties).map(([rule, value]) => (
                  <span
                    key={rule}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-700"
                  >
                    {rule}: {value}
                  </span>
                ))}
              </div>
            )}
          </section>
          <div className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                aria-pressed={tab === entry.id}
                className={`relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === entry.id
                    ? 'text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {tab === entry.id && (
                  <motion.span
                    layoutId="official-tab-pill"
                    className="absolute inset-0 rounded-md bg-white shadow-sm"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{entry.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: SOFT_EASE }}
            >
          {tab === 'timetable' && (
            <>
              <section className="cit-card mb-4 rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <span className="mb-1 block text-xs font-medium text-neutral-600">View by</span>
                    <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
                      {(
                        [
                          ['group', 'Student group'],
                          ['faculty', 'Faculty'],
                          ['room', 'Room'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setView(id)
                            setEntityId('')
                          }}
                          aria-pressed={view === id}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                            view === id
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[12rem] flex-1 sm:max-w-xs">
                    <label
                      htmlFor="official-entity"
                      className="mb-1 block text-xs font-medium text-neutral-600"
                    >
                      Selection
                    </label>
                    <select
                      id="official-entity"
                      value={selectedId}
                      onChange={(event) => setEntityId(event.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800"
                    >
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-sm text-black">
                    {sessions.length} sessions ·{' '}
                    {sessions.reduce((sum, session) => sum + session.periods, 0)} periods/week
                  </p>
                </div>
              </section>

              {sessions.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No sessions in this view"
                  description="Choose another group, faculty member or room."
                />
              ) : (
                <WeekCalendar
                  sessions={sessions}
                  rooms={viewData.data.rooms}
                  faculty={viewData.data.faculty}
                  groups={viewData.data.groups}
                  title={
                    options.find((option) => option.id === selectedId)?.label
                      ? `${options.find((option) => option.id === selectedId)?.label} · official timetable`
                      : 'Official timetable'
                  }
                  subtitle="Classes only · Mon–Fri · P1 08:00–P9 17:00 · lunch 13:00–14:00"
                  badge="Official data"
                />
              )}
            </>
          )}

          {tab === 'exams' && (
            <section className="cit-card overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs font-semibold text-black uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2">Exam</th>
                    <th className="px-4 py-2">Course(s)</th>
                    <th className="px-4 py-2">Day</th>
                    <th className="px-4 py-2">Session</th>
                    <th className="px-4 py-2">Rooms</th>
                    <th className="px-4 py-2">Candidates</th>
                  </tr>
                </thead>
                <tbody className="cit-stagger-rows divide-y divide-neutral-100">
                  {official.schedule.schedule.exams.map((exam) => {
                    const definition = dataset.entities.exams.find((item) => item.id === exam.exam_id)
                    return (
                      <tr key={exam.exam_id} className="hover:bg-neutral-50">
                        <td className="px-4 py-2 font-medium text-neutral-800">{exam.exam_id}</td>
                        <td className="px-4 py-2 text-sm text-black">
                          {definition?.course_ids.join(', ')}
                        </td>
                        <td className="px-4 py-2 text-sm text-black">{exam.day}</td>
                        <td className="px-4 py-2 text-sm text-black">{exam.session}</td>
                        <td className="px-4 py-2 text-sm text-black">{exam.rooms.join(', ')}</td>
                        <td className="px-4 py-2 text-sm text-black">{definition?.size}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}

          {tab === 'bookings' && (
            <section className="cit-card overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs font-semibold text-black uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2">Request</th>
                    <th className="px-4 py-2">Requester</th>
                    <th className="px-4 py-2">Venue &amp; time</th>
                    <th className="px-4 py-2">Priority</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="cit-stagger-rows divide-y divide-neutral-100">
                  {viewData.data.bookings.map((booking) => (
                    <tr key={booking.id} className="align-top hover:bg-neutral-50">
                      <td className="px-4 py-2">
                        <p className="font-medium text-neutral-800">{booking.title}</p>
                        <p className="text-[11px] text-neutral-500">{booking.id}</p>
                      </td>
                      <td className="px-4 py-2 text-sm text-black">{booking.organizer}</td>
                      <td className="px-4 py-2 text-sm text-black">
                        {booking.roomId} · {booking.day} P{booking.startPeriod}–
                        {booking.startPeriod + booking.periods - 1}
                      </td>
                      <td className="px-4 py-2">
                        <PriorityBadge priority={booking.priority} />
                      </td>
                      <td className="px-4 py-2">
                        <BookingStatusBadge status={booking.status} />
                      </td>
                      <td className="max-w-[20rem] px-4 py-2 text-sm text-black">
                        {booking.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === 'changes' && (
            <>
              {official.schedule.diff ? (
                <section className="cit-card rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-800">
                      {official.schedule.diff.moved_count} moved
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                      {official.schedule.diff.time_changed} time ·{' '}
                      {official.schedule.diff.room_only_changed} room-only
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 font-semibold ${
                        official.schedule.diff.moved_minimal
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {official.schedule.diff.moved_minimal ? 'minimal movement' : 'above minimum'}
                    </span>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-neutral-50 text-xs font-semibold text-black uppercase tracking-wide">
                        <tr>
                          <th className="px-3 py-2">Session</th>
                          <th className="px-3 py-2">Before</th>
                          <th className="px-3 py-2">After</th>
                          <th className="px-3 py-2">Change</th>
                        </tr>
                      </thead>
                      <tbody className="cit-stagger-rows divide-y divide-neutral-100">
                        {official.schedule.diff.moved.map((row) => (
                          <tr key={row.session_id}>
                            <td className="px-3 py-2 font-medium text-neutral-800">{row.session_id}</td>
                            <td className="px-3 py-2 text-sm text-black">
                              {row.before.room_id} · {row.before.day} P{row.before.start_period}
                            </td>
                            <td className="px-3 py-2 text-sm text-black">
                              {row.after.room_id} · {row.after.day} P{row.after.start_period}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {row.time_changed ? 'Time + room' : 'Room only'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <EmptyState
                  icon={AlertTriangle}
                  title="No change proposal yet"
                  description="Apply the sample disruption in Import / Exports to generate a proposal and diff."
                  action={
                    <Link
                      to="/admin"
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Apply a disruption
                    </Link>
                  }
                />
              )}
            </>
          )}
            </motion.div>
          </AnimatePresence>

          {summary && summary.hard_violation_count === 0 && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Both the timetable and the exam schedule passed the official validator.
            </p>
          )}
        </>
      )}
    </div>
  )
}
