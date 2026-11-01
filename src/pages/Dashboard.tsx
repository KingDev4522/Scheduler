import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { dashboardStats, pendingDecisions, roomUtilisation } from '../lib/selectors'
import { EmptyState, ErrorState } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { useOfficial } from '../hooks/useOfficial'
import { buildOfficialView } from '../lib/official'
import { WeekCalendar } from '../components/WeekCalendar'
import { ExamWeekOverview } from '../components/ExamWeekOverview'
import { WeekPicker } from '../components/WeekPicker'
import { MonthCalendar } from '../components/MonthCalendar'
import { datasetDay, weekDates, weekLabel } from '../lib/semester'
import { cn } from '../lib/utils'

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
  const stats = useMemo(() => (data && user ? dashboardStats(data, user) : null), [data, user])
  const queue = useMemo(() => (data && user ? pendingDecisions(data, user) : []), [data, user])
  const utilisation = useMemo(() => (data ? roomUtilisation(data) : []), [data])

  if (!user) return null

  if (official.loading && !official.dataset) {
    return <PageSkeleton label="Loading your dashboard…" variant="dashboard" cards={4} rows={5} />
  }

  if (official.error && !official.health) {
    return (
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Dashboard</h2>
        <div className="mt-4">
          <ErrorState
            title="Backend not reachable"
            description={official.error}
            onRetry={() => void official.refresh()}
          />
        </div>
      </div>
    )
  }

  if (!data || !stats || !official.dataset || !official.schedule) {
    return (
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Dashboard</h2>
        <div className="mt-4">
          <EmptyState
            title="No official schedule yet"
            description="The dashboard is computed from the official dataset and generated schedule."
            action={
              <Link
                to="/admin"
                className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
              >
                Open Import / Exports
              </Link>
            }
          />
        </div>
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
          member.name.toLowerCase().includes(user.displayName.split(' ').slice(-1)[0]!.toLowerCase()),
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

  const isFaculty = user.role === 'faculty'
  const isStaffView = user.role === 'event_manager' || isFaculty

  const bookingApproved = data.bookings.filter((booking) => booking.status === 'approved').length
  const bookingAlternatives = data.bookings.filter(
    (booking) => booking.status === 'alternative_offered',
  ).length
  const bookingPending = data.bookings.filter((booking) => booking.status === 'pending').length

  const metrics = [
    {
      label: 'Waiting on you',
      value: stats.pendingDecisions,
      hint: `${stats.actionableDecisions} you can decide`,
    },
    {
      label: 'Official conflicts',
      value: hard,
      hint: conflictRows.length > 0 ? `${conflictRows.length} rule(s) involved` : 'validator clean',
    },
    {
      label: 'Room utilisation',
      value: `${stats.averageUtilisation}%`,
      hint: `${data.rooms.length} official venues`,
    },
    isFaculty
      ? {
          label: 'Your teaching periods',
          value: data.sessions.reduce((sum, session) => sum + session.periods, 0),
          hint: `${data.sessions.length} sessions on the grid`,
        }
      : {
          label: 'Venue requests granted',
          value: bookingApproved,
          hint: `${bookingAlternatives} alternative · ${bookingPending} open`,
        },
  ]

  return (
    <div className="cit-page">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Dashboard</h2>
          <p className="mt-1 max-w-[58ch] text-[14px] leading-relaxed text-slate-600">
            {ROLE_LABEL[user.role]}
            {user.department ? ` · ${user.department}` : ''} · {dataset.institute} ·{' '}
            {summary.hard_violation_count} hard violation
            {summary.hard_violation_count === 1 ? '' : 's'} · booking score{' '}
            {summary.bookings?.booking_score ?? '–'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/official"
            className="hidden h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          >
            Official data
          </Link>
          <Link
            to={isStaffView ? '/manual' : '/approvals'}
            className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
          >
            {isStaffView ? 'Request a venue' : 'Open approvals'}
          </Link>
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white px-4 py-3">
            <dt className="text-[12px] text-slate-500">{metric.label}</dt>
            <dd className="mt-0.5 text-[24px] font-semibold leading-none tabular-nums text-slate-900">
              {metric.value}
            </dd>
            <p className="mt-1 text-[12px] text-slate-500">{metric.hint}</p>
          </div>
        ))}
      </dl>

      {semester ? (
        <div className="mt-4">
          <WeekPicker
            semester={semester}
            week={activeWeek}
            onChange={setSelectedWeek}
            view={calendarView}
            onViewChange={setCalendarView}
          />
        </div>
      ) : null}

      <div className="mt-3">
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
        <p className="mt-2 text-[12px] text-slate-500">
          Classes in this calendar: {focusLabel ?? 'selected group'} · open Timetables for every group,
          faculty and venue view.
          {!semester ? ' No calendar dates are available in this dataset.' : ''}
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 px-5 py-3">
            <h3 className="text-[15px] font-semibold text-slate-900">
              {isStaffView ? 'Your pending requests' : 'Waiting on a decision'}
            </h3>
            <Link
              to="/approvals"
              className="text-[12px] font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Open approvals
            </Link>
          </div>

          {queue.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-slate-500">
              Nothing waiting. Official booking decisions come from the solver; ad-hoc requests appear
              in Approvals.
            </p>
          ) : (
            <ul className="cit-stagger divide-y divide-slate-100">
              {queue.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="px-5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        <span className="tabular-nums">{item.id}</span> · {item.requester} ·{' '}
                        {timeAgo(item.submittedAt)} ·{' '}
                        {item.kind === 'booking' ? 'venue request' : 'session change'}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{item.detail}</p>
                      {item.requestReason ? (
                        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-700">
                          {item.requestReason}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-right text-[12px] leading-snug',
                        item.canDecide ? 'text-slate-700' : 'text-slate-400',
                      )}
                    >
                      {item.canDecide ? 'Yours to decide' : item.blockedReason}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-[15px] font-semibold text-slate-900">Room utilisation</h3>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Official sessions plus approved bookings.
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {[...utilisation]
                .sort((a, b) => b.percent - a.percent)
                .slice(0, 5)
                .map((row) => (
                  <li key={row.room.id} className="px-4 py-2">
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="truncate text-slate-700">{row.room.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">{row.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-700"
                        style={{ width: `${Math.max(row.percent, 1)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[12px] tabular-nums text-slate-500">
                      {row.occupiedPeriods} of {row.capacityPeriods} weekly periods
                    </p>
                  </li>
                ))}
            </ul>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-[15px] font-semibold text-slate-900">Validator</h3>
              <p className="mt-0.5 text-[12px] text-slate-500">Official hard-constraint report.</p>
            </div>
            {conflictRows.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-slate-500">
                No hard violations in the generated schedule.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {conflictRows.slice(0, 5).map(([rule, count]) => (
                  <li key={rule} className="flex items-baseline justify-between gap-2 px-4 py-2">
                    <span className="text-[12px] text-slate-700">{rule}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-rose-700">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 px-4 py-2">
              <Link
                to="/official"
                className="text-[12px] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                Inspect the official report
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
