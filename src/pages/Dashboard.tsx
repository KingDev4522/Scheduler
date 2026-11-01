import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  XCircle,
} from 'lucide-react'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { dashboardStats, pendingDecisions, roomUtilisation } from '../lib/selectors'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { EmptyState, ErrorState } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { useOfficial } from '../hooks/useOfficial'
import { buildOfficialView } from '../lib/official'
import { WeekCalendar } from '../components/WeekCalendar'
import { ExamWeekOverview } from '../components/ExamWeekOverview'
import { WeekPicker } from '../components/WeekPicker'
import { MonthCalendar } from '../components/MonthCalendar'
import { datasetDay, weekDates, weekLabel } from '../lib/semester'

type CalendarView = 'week' | 'month'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Dashboard() {
  const { user } = useAuth()
  const [calendarView, setCalendarView] = useState<CalendarView>('week')
  const [selectedWeek, setSelectedWeek] = useState(0)
  const official = useOfficial()
  const officialView = useMemo(
    () =>
      official.dataset && official.schedule
        ? buildOfficialView(official.dataset, official.schedule)
        : null,
    [official.dataset, official.schedule],
  )
  const data = officialView?.data ?? null
  const stats = useMemo(
    () => (data && user ? dashboardStats(data, user) : null),
    [data, user],
  )
  const queue = useMemo(
    () => (data && user ? pendingDecisions(data, user) : []),
    [data, user],
  )
  const utilisation = useMemo(() => (data ? roomUtilisation(data) : []), [data])

  if (!user) return null

  if (official.loading && !official.dataset) {
    return (
      <PageSkeleton label="Loading your dashboard…" variant="dashboard" cards={4} rows={5} />
    )
  }

  if (official.error && !official.health) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Official data is unavailable." />
        <ErrorState
          title="Backend not reachable"
          description={official.error}
          onRetry={() => void official.refresh()}
        />
      </div>
    )
  }

  if (!data || !stats || !official.dataset || !official.schedule) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Generate the official schedule to populate this page." />
        <EmptyState
          icon={CalendarCheck2}
          title="No official schedule yet"
          description="The dashboard is computed from the official dataset and generated schedule. Generate it from Import / Exports."
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

  const summary = official.schedule.summary
  const hard = summary.hard_violation_count
  const conflictRows = Object.entries(summary.hard_by_rule ?? {})
  const dataset = official.dataset

  const facultyFocus =
    user.role === 'faculty'
      ? data.faculty.find((member) =>
          member.name
            .toLowerCase()
            .includes(user.displayName.split(' ').slice(-1)[0]!.toLowerCase()),
        )
      : undefined
  const groupFocus = data.groups[0]
  const calendarSessions = facultyFocus
    ? data.sessions.filter((session) => session.facultyId === facultyFocus.id)
    : data.sessions.filter((session) => session.groupId === groupFocus?.id)
  const focusLabel = facultyFocus?.name ?? groupFocus?.name ?? null
  const campusEvents = data.bookings.filter(
    (booking) => booking.status === 'approved' || booking.status === 'alternative_offered',
  )
  const semester = dataset.semester
  const activeWeek = selectedWeek || semester?.fest_week || 1
  const weekInfo = semester?.weeks.find((week) => week.number === activeWeek) ?? null
  const isFest = weekInfo?.phase === 'spectra'
  const isExams = weekInfo?.phase === 'exams'
  const activeWeekDates = semester ? weekDates(semester, activeWeek) : []
  const eventDates = semester
    ? weekDates(semester, semester.fest_week).filter((iso) =>
        campusEvents.some((booking) => datasetDay(iso) === booking.day),
      )
    : []
  const examDates = semester ? weekDates(semester, semester.exam_week, true).slice(0, 6) : []
  const showEvents = isFest
  const weekText = semester ? weekLabel(semester, activeWeek) : `Week ${activeWeek}`
  const calendarTitle = isExams
    ? `${weekText} · midsem exams`
    : isFest
      ? `${weekText} · classes + events`
      : `${focusLabel ? `${focusLabel} · ` : ''}${weekText}`
  const calendarSubtitle = isFest
    ? 'Regular classes continue · Mon–Fri P1 08:00–P9 17:00 · lunch 13:00–14:00 · P10–P13 events 18:00–22:00'
    : 'Mon–Fri · P1 08:00–P9 17:00 · lunch 13:00–14:00 · classes only'
  const calendarBadge = isFest ? 'Spectra events' : isExams ? 'Exam week' : 'Recurring template'

  const isAdmin = user.role === 'admin'
  const isFaculty = user.role === 'faculty'
  const isStaffView = user.role === 'event_manager' || isFaculty
  const bookingApproved = data.bookings.filter((booking) => booking.status === 'approved').length
  const bookingAlternatives = data.bookings.filter(
    (booking) => booking.status === 'alternative_offered',
  ).length
  const bookingPending = data.bookings.filter((booking) => booking.status === 'pending').length

  const cards = isAdmin
    ? [
        { icon: ClipboardCheck, label: 'Pending decisions', value: stats.pendingDecisions, hint: `${stats.actionableDecisions} you can decide`, tone: 'amber' as const },
        { icon: CalendarCheck2, label: 'Spectra requests', value: stats.spectraActive, hint: `${stats.spectraPending} pending`, tone: 'neutral' as const },
        { icon: AlertTriangle, label: 'Open conflicts', value: hard, hint: 'official validator', tone: 'rose' as const },
        { icon: Building2, label: 'Avg room utilisation', value: `${stats.averageUtilisation}%`, hint: `${data.rooms.length} official rooms`, tone: 'emerald' as const },
      ]
    : user.role === 'department_coordinator'
      ? [
          { icon: ClipboardCheck, label: 'Pending decisions', value: stats.pendingDecisions, hint: `${stats.actionableDecisions} in your scope`, tone: 'amber' as const },
          { icon: CalendarCheck2, label: 'Spectra requests', value: stats.spectraActive, hint: `${stats.spectraPending} pending`, tone: 'neutral' as const },
          { icon: AlertTriangle, label: 'Open conflicts', value: hard, hint: 'official validator', tone: 'rose' as const },
          { icon: Building2, label: 'Avg room utilisation', value: `${stats.averageUtilisation}%`, hint: `${data.rooms.length} official rooms`, tone: 'emerald' as const },
        ]
      : isFaculty
        ? [
            { icon: CalendarCheck2, label: 'Teaching sessions', value: data.sessions.length, hint: 'official timetable', tone: 'neutral' as const },
            { icon: Building2, label: 'Rooms', value: data.rooms.length, hint: 'official room inventory', tone: 'emerald' as const },
            { icon: AlertTriangle, label: 'Open conflicts', value: hard, hint: 'official validator', tone: 'rose' as const },
            { icon: Clock3, label: 'My requests', value: stats.myPending, hint: 'awaiting a decision', tone: 'amber' as const },
          ]
        : [
            { icon: CalendarCheck2, label: 'Spectra requests', value: stats.spectraActive, hint: 'official board', tone: 'neutral' as const },
            { icon: CheckCircle2, label: 'Approved', value: bookingApproved, hint: 'solver decisions', tone: 'emerald' as const },
            { icon: XCircle, label: 'Alternatives', value: bookingAlternatives, hint: 'offered outside window', tone: 'rose' as const },
            { icon: Clock3, label: 'Pending', value: bookingPending, hint: 'awaiting a decision', tone: 'amber' as const },
          ]

  return (
    <div className="cit-page">
      <PageHeader
        title={`Welcome back, ${user.displayName}`}
        subtitle={`${ROLE_LABEL[user.role]}${
          user.department ? ` · ${user.department} department` : ''
        } · ${dataset.institute}`}
      />

      <section className="cit-card mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Official generated schedule</h3>
            <p className="mt-1 text-xs text-slate-500">
              {hard} hard violations · soft {summary.soft_total} · booking score{' '}
              {summary.bookings?.booking_score ?? '—'} /{' '}
              {summary.bookings?.booking_score_max_if_all_approved ?? '—'} · proposal{' '}
              {official.schedule.proposal_status ?? 'none'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {dataset.dataset_id} · {dataset.source} ·{' '}
              {dataset.generated_at ? `generated ${new Date(dataset.generated_at).toLocaleString()}` : 'not generated'}
            </p>
          </div>
          <Link
            to="/official"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Open Official Data →
          </Link>
        </div>
      </section>

      <div className="cit-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-5">
        {semester ? (
          <div className="mb-4">
            <WeekPicker
              semester={semester}
              week={activeWeek}
              onChange={setSelectedWeek}
              view={calendarView}
              onViewChange={setCalendarView}
            />
          </div>
        ) : null}

        {calendarView === 'month' && semester ? (
          <MonthCalendar
            semester={semester}
            selectedWeek={activeWeek}
            onSelectWeek={(week) => {
              setSelectedWeek(week)
              setCalendarView('week')
            }}
            eventDates={eventDates}
            examDays={examDates}
          />
        ) : isExams ? (
          <ExamWeekOverview dataset={dataset} schedule={official.schedule} />
        ) : (
          <WeekCalendar
            sessions={calendarSessions}
            rooms={data.rooms}
            events={campusEvents}
            faculty={data.faculty}
            groups={data.groups}
            title={calendarTitle}
            subtitle={calendarSubtitle}
            badge={calendarBadge}
            showEvents={showEvents}
            endHour={showEvents ? 22 : 18}
            weekDates={activeWeekDates}
          />
        )}

        <p className="mt-2 text-[11px] text-slate-400">
          Classes in this calendar: {focusLabel ?? 'selected group'} · open Timetables for every
          group, faculty and room view.
          {!semester ? ' No calendar dates are available in this dataset.' : ''}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="cit-card flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {isStaffView ? 'Your pending requests' : 'Pending decisions'}
              </h3>
              <Link to="/approvals" className="text-xs font-semibold text-neutral-900 hover:underline">
                Open approvals →
              </Link>
            </div>

            <div className="cit-stagger divide-y divide-slate-100">
              {queue.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState
                    icon={CheckCircle2}
                    title="Nothing waiting"
                    description="Official booking decisions are generated by the solver. Ad-hoc manual requests appear in Approvals."
                  />
                </div>
              ) : (
                queue.map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {item.kind === 'booking' ? 'Booking' : 'Change'}
                          </span>
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.id} · from <span className="font-medium">{item.requester}</span> ·{' '}
                          {timeAgo(item.submittedAt)}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                        {item.requestReason && (
                          <p className="mt-1 text-xs text-slate-600">
                            <span className="font-semibold">Request reason:</span>{' '}
                            {item.requestReason}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{item.canDecide ? 'Actionable' : item.blockedReason}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="cit-stagger space-y-5">
          <section className="cit-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Room utilisation</h3>
            <p className="text-xs text-slate-400">Derived from official sessions + approved bookings</p>
            <ul className="cit-stagger mt-4 space-y-3">
              {[...utilisation]
                .sort((a, b) => b.percent - a.percent)
                .slice(0, 5)
                .map((row) => (
                  <li key={row.room.id}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-slate-700">{row.room.name}</span>
                      <span className="text-slate-400">{row.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-neutral-500"
                        style={{ width: `${Math.max(row.percent, 1)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {row.occupiedPeriods} of {row.capacityPeriods} weekly periods
                    </p>
                  </li>
                ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Open conflicts</h3>
            <p className="text-xs text-slate-400">Official validator summary</p>
            <ul className="cit-stagger mt-3 space-y-3">
              {conflictRows.length === 0 ? (
                <li className="text-sm text-slate-400">No hard violations in the generated schedule.</li>
              ) : (
                conflictRows.slice(0, 5).map(([rule, count]) => (
                  <li key={rule} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-xs font-semibold text-neutral-800">
                      <span className="mr-1.5 rounded bg-neutral-200 px-1 py-0.5 text-[10px]">{rule}</span>
                      {count} violation{count === 1 ? '' : 's'}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-2 text-[11px] text-slate-400">
              <Link to="/official" className="font-semibold text-neutral-800 hover:underline">
                Inspect the official report
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
