import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import { useAvailability } from '../hooks/useAvailability'
import { buildOfficialView } from '../lib/official'
import { canCoordinatorDecideRoom, sessionDepartment } from '../lib/departments'
import { datasetDay, formatDate } from '../lib/semester'
import { toBookingStatus } from '../lib/bookingBoard'
import { findNav, navLabel } from '../lib/nav'
import { SOFT_EASE } from '../lib/motion'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import {
  api,
  type BookingAlternative,
  type BookingDraft,
  type BookingProposalPayload,
  type BookingSubmission,
  type BookingValidation,
  type ChangeRequestRecord,
} from '../lib/api'
import { EmptyState, ErrorState, StatusNotice } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { BookingDraftForm, type BookingFormOptions } from '../components/BookingDraftForm'
import { SessionChangeForm } from '../components/SessionChangeForm'
import { DecisionDialog, type Decision } from '../components/DecisionDialog'
import { StatusPill } from '../components/BookingStatus'
import { PeriodTape } from '../components/PeriodTape'

type Tab = 'event' | 'change'

const EMPTY_DRAFT: BookingDraft = {
  title: '',
  request_reason: '',
  attendance: 45,
  duration_periods: 2,
  windows: [{ day: 'MON', from_period: 10, to_period: 11 }],
  dates: [],
  room_types: [],
  needs: [],
  requested_room: null,
  mandatory_for_groups: [],
}

const ADMIN_CATEGORIES = [
  { value: 'institute_event', label: 'Institute event' },
  { value: 'guest_lecture', label: 'Guest lecture' },
  { value: 'department_event', label: 'Department event' },
  { value: 'club_event', label: 'Club event' },
]

function slotLabel(submission: BookingSubmission): string {
  const dates = submission.dates ?? []
  const weeks = submission.weeks ?? []
  const time = `${submission.start_period ? `P${submission.start_period}` : '–'}–${
    submission.end_period ? `P${submission.end_period}` : '–'
  }`
  const day = submission.day ?? ''
  if (dates.length === 0) return `${day} ${time}`.trim()
  const week = weeks[0]
  const more = dates.length > 1 ? ` +${dates.length - 1}` : ''
  return `${week ? `W${week} · ` : ''}${formatDate(dates[0])}${more} · ${day} ${time}`
}

export default function ManualBooking() {
  const { user } = useAuth()
  const official = useOfficial()
  const officialView = useMemo(
    () =>
      official.dataset && official.schedule
        ? buildOfficialView(official.dataset, official.schedule)
        : null,
    [official.dataset, official.schedule],
  )
  const data = officialView?.data
  const [tab, setTab] = useState<Tab>('event')
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT)
  const [target, setTarget] = useState<{ room_id: string; day: string; start_period: number } | null>(
    null,
  )
  const [validation, setValidation] = useState<BookingValidation | null>(null)
  const [submissions, setSubmissions] = useState<BookingSubmission[]>([])
  const [changes, setChanges] = useState<ChangeRequestRecord[]>([])
  const [category, setCategory] = useState('institute_event')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [decisionTarget, setDecisionTarget] = useState<BookingSubmission | null>(null)

  const isFaculty = user?.role === 'faculty'
  const isAdmin = user?.role === 'admin'
  const isCoordinator = user?.role === 'department_coordinator'
  const canBookEvents = !isFaculty
  const canChange = isFaculty || isAdmin || isCoordinator
  const showTabs = isAdmin || isCoordinator
  const activeTab: Tab = isFaculty ? 'change' : showTabs ? tab : 'event'

  const facultyFocus = useMemo(() => {
    if (!user || user.role !== 'faculty') return undefined
    const last = user.displayName.split(' ').slice(-1)[0]?.toLowerCase() ?? ''
    return data?.faculty.find((member) => member.name.toLowerCase().includes(last))
  }, [data?.faculty, user])

  const options: BookingFormOptions | null = useMemo(() => {
    if (!official.dataset) return null
    const rooms = official.dataset.entities.rooms
    return {
      days: official.dataset.entities.calendar.days,
      roomTypes: Array.from(new Set(rooms.map((room) => room.type))).sort(),
      needs: Array.from(new Set(rooms.flatMap((room) => room.features))).concat('accessible').sort(),
      groups: official.dataset.entities.student_groups.map((group) => group.id),
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        type: room.type,
        accessible: room.accessible,
        features: room.features,
      })),
      semester: official.dataset.semester ?? null,
    }
  }, [official.dataset])

  const changeSessions = useMemo(() => {
    if (!data) return []
    if (isFaculty) return data.sessions.filter((session) => session.facultyId === facultyFocus?.id)
    if (isCoordinator) {
      return data.sessions.filter(
        (session) => sessionDepartment(official.dataset, session.id) === user?.department,
      )
    }
    return data.sessions
  }, [data, isFaculty, isCoordinator, facultyFocus?.id, official.dataset, user?.department])

  const { checks, loading: availabilityLoading } = useAvailability(
    draft,
    user,
    canBookEvents && activeTab === 'event',
  )

  const loadRequests = useCallback(async () => {
    if (!user) return
    try {
      const [bookingResponse, changeResponse] = await Promise.all([
        api.listBookings(user.username),
        canChange ? api.changeRequests(user.username) : Promise.resolve({ items: [] }),
      ])
      setSubmissions(bookingResponse.items)
      setChanges(changeResponse.items)
    } catch {
      /* the page still works without the list */
    }
  }, [user, canChange])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const decided = useMemo(() => {
    const me = user?.username ?? ''
    const rows = [
      ...submissions
        .filter((item) => item.requester === me || item.decided_by === me)
        .map((item) => ({
          id: item.id,
          label: String(item.title ?? item.id),
          status: item.status,
          requestReason: String(item.request_reason ?? ''),
          reason: item.reason ?? '',
          decidedAt: item.decided_at ?? '',
          decidedBy: item.decided_by ?? '',
          kind: 'booking' as const,
        })),
      ...changes
        .filter((item) => item.requester === me || item.decided_by === me)
        .map((item) => ({
          id: item.id,
          label: item.text,
          status: item.status,
          requestReason: String(
            item.request_reason ?? (item.draft as Record<string, unknown>)?.request_reason ?? '',
          ),
          reason: item.reason ?? '',
          decidedAt: item.decided_at ?? '',
          decidedBy: item.decided_by ?? '',
          kind: 'change' as const,
        })),
    ]
    return rows
      .filter((row) => row.status === 'approved' || row.status === 'rejected')
      .sort((a, b) => String(b.decidedAt || '').localeCompare(String(a.decidedAt || '')))
      .slice(0, 4)
  }, [submissions, changes, user?.username])

  if (!user) return null

  if (official.loading && !official.dataset) {
    return <PageSkeleton label="Loading the official dataset…" variant="form" rows={4} />
  }

  if (!official.dataset || !options) {
    return (
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">
          Booking and changes
        </h2>
        <div className="mt-4">
          <ErrorState
            title="Backend not reachable"
            description={`${official.error ?? 'The scheduling API is offline.'} Start it with: python -m uvicorn backend.app:app --port 8000`}
            onRetry={() => void official.refresh()}
          />
        </div>
      </div>
    )
  }

  const payload = (): BookingProposalPayload => ({
    ...draft,
    ...(target ?? {}),
    ...(isAdmin ? { requested_category: category } : {}),
  })

  const validate = async (): Promise<BookingValidation | null> => {
    setBusy(true)
    setFlash(null)
    try {
      const result = await api.validateBooking(payload(), user.username)
      setValidation(result)
      return result
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Validation failed.',
      })
      return null
    } finally {
      setBusy(false)
    }
  }

  const chooseAlternative = async (alternative: BookingAlternative) => {
    const chosen = {
      room_id: alternative.room_id,
      day: alternative.day,
      start_period: alternative.start_period,
    }
    const nextDraft = {
      ...draft,
      dates: (draft.dates ?? []).filter((iso) => datasetDay(iso) === alternative.day),
      duration_periods: alternative.end_period - alternative.start_period + 1,
      windows: [
        {
          day: alternative.day,
          from_period: alternative.start_period,
          to_period: alternative.end_period,
        },
      ],
    }
    setDraft(nextDraft)
    setTarget(chosen)
    setBusy(true)
    try {
      setValidation(await api.validateBooking({ ...nextDraft, ...chosen }, user.username))
    } finally {
      setBusy(false)
    }
  }

  const submitNow = async () => {
    setBusy(true)
    setFlash(null)
    try {
      const result = await api.submitBooking(payload(), user.username)
      setFlash({
        tone: 'success',
        message: `${result.request.id} is in for approval · ${result.request.room_id ?? 'a room'} on ${result.request.day ?? ''}.`,
      })
      setDraft(EMPTY_DRAFT)
      setTarget(null)
      setValidation(null)
      await loadRequests()
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Submission failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!draft.request_reason?.trim()) {
      setFlash({
        tone: 'error',
        message: 'Add a short reason for this request. The approver sees it, so it cannot be blank.',
      })
      return
    }
    if (validation?.ok) {
      await submitNow()
      return
    }
    const result = await validate()
    if (result?.ok) {
      await submitNow()
      return
    }
    if (result) {
      setFlash({
        tone: 'error',
        message:
          result.alternatives.length > 0
            ? 'No exact slot is chosen yet. Pick one of the feasible alternatives below, then submit again.'
            : 'This request does not pass the hard checks yet. Clear the listed issues and submit again.',
      })
    }
  }

  const decide = async (decision: Decision, reason: string) => {
    if (!decisionTarget) return
    const submission = decisionTarget
    setDecisionTarget(null)
    try {
      await api.decideBookingSubmission(submission.id, decision, reason, user.username)
      setFlash({ tone: 'success', message: `${submission.id} ${decision}.` })
      await loadRequests()
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Decision failed.',
      })
    }
  }

  const manualNav = findNav('/manual')
  const pageTitle = manualNav ? navLabel(manualNav, user.role) : 'Booking and changes'
  const eventTitle = isCoordinator
    ? 'Department event'
    : isAdmin
      ? 'Event booking'
      : 'Club venue request'

  const openCount = submissions.filter((item) => item.status === 'pending').length
  const pendingInScope = submissions.filter(
    (item) =>
      item.status === 'pending' &&
      (user.role === 'admin' ||
        (user.role === 'department_coordinator' &&
          canCoordinatorDecideRoom(user, String(item.room_id ?? item.requested_room ?? '')))),
  ).length

  const scopeLine = [
    openCount > 0 ? `${openCount} awaiting a decision` : null,
    `${submissions.length} venue request${submissions.length === 1 ? '' : 's'}`,
    canChange ? `${changes.length} session change${changes.length === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const canDecide = (submission: BookingSubmission) =>
    submission.status === 'pending' &&
    (user.role === 'admin' ||
      (user.role === 'department_coordinator' &&
        canCoordinatorDecideRoom(
          user,
          String(submission.room_id ?? submission.requested_room ?? ''),
        )))

  const tabs: { id: Tab; label: string }[] = [
    { id: 'event', label: eventTitle },
    { id: 'change', label: 'Session change' },
  ]

  return (
    <div className="cit-page">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">{pageTitle}</h2>
          <p className="mt-1 max-w-[56ch] text-[14px] leading-relaxed text-slate-600">{scopeLine}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/assistant"
            className="hidden h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          >
            Ask the assistant
          </Link>
          <Link
            to={isAdmin || isCoordinator ? '/approvals' : '/workspace'}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950"
          >
            {isAdmin || isCoordinator ? 'Open approvals' : 'My workspace'}
            {pendingInScope > 0 ? (
              <span className="rounded-full bg-white/20 px-1.5 text-[12px] tabular-nums">
                {pendingInScope}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      {flash ? (
        <div className="mt-4">
          <StatusNotice tone={flash.tone}>
            {flash.message}
            {flash.tone === 'success' ? (
              <>
                {' '}
                <Link to="/approvals" className="font-medium underline">
                  Track it in Approvals
                </Link>
              </>
            ) : null}
          </StatusNotice>
        </div>
      ) : null}

      {showTabs ? (
        <div
          role="group"
          aria-label="Request type"
          className="mt-4 flex gap-5 border-b border-slate-200"
        >
          {tabs.map((item) => {
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  '-mb-px border-b-2 pb-2.5 pt-1 text-[13px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950',
                  active
                    ? 'border-neutral-900 font-medium text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {activeTab === 'event' && canBookEvents ? (
        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-5">
            {isAdmin ? (
              <div className="mb-5 max-w-xs">
                <p className="mb-1.5 text-[13px] font-medium text-slate-700">Priority category</p>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 transition-colors hover:border-slate-400 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-300"
                >
                  {ADMIN_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[12px] text-slate-500">
                  Decides the title's rank when two requests want the same slot.
                </p>
              </div>
            ) : null}

            <BookingDraftForm
              draft={draft}
              options={options}
              showGroups={isAdmin}
              availability={checks}
              availabilityLoading={availabilityLoading}
              onChange={(next) => {
                setDraft(next)
                setTarget(null)
                setValidation(null)
              }}
            />

            {validation ? (
              <div className="cit-anim-pop mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p
                  className={cn(
                    'text-[13px] font-semibold',
                    validation.ok ? 'text-emerald-800' : 'text-rose-800',
                  )}
                >
                  {validation.ok ? 'Every hard check passes' : 'Blocked by hard checks'}
                </p>

                {validation.violations.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {validation.violations.map((violation) => (
                      <li key={violation} className="text-[12px] text-rose-800">
                        {violation}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {validation.alternatives.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[12px] text-slate-500">Slots that would work</p>
                    <ul className="mt-1.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {validation.alternatives.map((alternative) => (
                        <li key={`${alternative.room_id}-${alternative.day}-${alternative.start_period}`}>
                          <button
                            type="button"
                            onClick={() => void chooseAlternative(alternative)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-300"
                          >
                            <span className="block text-[12px] text-slate-800">
                              <span className="font-medium">{alternative.room_id}</span>
                              <span className="text-slate-500">
                                {' · '}
                                {alternative.day} P{alternative.start_period}–P{alternative.end_period}
                              </span>
                            </span>
                            <span className="mt-1 block text-[12px] text-slate-500">
                              {alternative.type.replace(/_/g, ' ')} · {alternative.capacity} seats
                            </span>
                            <span className="mt-1.5 block">
                              <PeriodTape
                                from={alternative.start_period}
                                to={alternative.end_period}
                                tone="granted"
                              />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950"
            >
              Submit for approval
            </button>
            <button
              type="button"
              onClick={() => void validate()}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
            >
              Check the slot
            </button>
            <p className="text-[12px] text-slate-500">
              {validation?.ok
                ? 'A validated slot is chosen. Submitting records a pending request.'
                : draft.request_reason?.trim()
                  ? 'Submitting validates first, then records a pending request.'
                  : 'Add a reason first; the approver reads it.'}
            </p>
          </div>
        </section>
      ) : null}

      {activeTab === 'change' && canChange ? (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-[15px] font-semibold text-slate-900">Request a session change</h3>
            {isFaculty ? (
              <Link
                to="/workspace"
                className="text-[12px] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                Mark unavailability in My Workspace
              </Link>
            ) : null}
          </div>
          <SessionChangeForm
            user={user}
            sessions={changeSessions}
            rooms={options.rooms}
            semester={options.semester}
            onSubmitted={() => void loadRequests()}
          />
        </section>
      ) : null}

      {activeTab === 'change' && canChange && !data ? (
        <div className="mt-4">
          <EmptyState
            title="Generate the timetable first"
            description="Session changes are checked against the generated timetable."
          />
        </div>
      ) : null}

      {/* Venue requests in scope */}
      {canBookEvents && submissions.length > 0 ? (
        <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-3">
            <h3 className="text-[15px] font-semibold text-slate-900">
              {isAdmin || isCoordinator ? 'Venue requests in your scope' : 'Your venue requests'}
            </h3>
            <p className="text-[12px] tabular-nums text-slate-500">
              {submissions.length} request{submissions.length === 1 ? '' : 's'} · {openCount} open
            </p>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[860px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[13%]" />
                <col className="w-[19%]" />
                <col className="w-[13%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-2 text-[12px] font-medium text-slate-500">
                    Request
                  </th>
                  <th scope="col" className="px-3 py-2 text-[12px] font-medium text-slate-500">
                    Requester
                  </th>
                  <th scope="col" className="px-3 py-2 text-[12px] font-medium text-slate-500">
                    Slot
                  </th>
                  <th scope="col" className="px-3 py-2 text-[12px] font-medium text-slate-500">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-[12px] font-medium text-slate-500">
                    Reason and decision
                  </th>
                </tr>
              </thead>
              <tbody className="cit-stagger-rows">
                {submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="border-b border-slate-100 align-top last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <p className="truncate text-[14px] font-semibold text-slate-900">
                        {submission.title}
                      </p>
                      <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">{submission.id}</p>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-slate-600">{submission.requester}</td>
                    <td className="px-3 py-3">
                      <p className="text-[13px] text-slate-800">{submission.room_id ?? 'No room yet'}</p>
                      <p className="mt-0.5 text-[12px] text-slate-500">{slotLabel(submission)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={toBookingStatus(submission.status)} />
                      {canDecide(submission) ? (
                        <button
                          type="button"
                          onClick={() => setDecisionTarget(submission)}
                          className="mt-1.5 block text-[12px] font-medium text-slate-700 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
                        >
                          Record a decision
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {submission.request_reason?.trim() ? (
                        <p className="line-clamp-2 text-[12px] leading-relaxed text-slate-700">
                          {submission.request_reason}
                        </p>
                      ) : null}
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
                        {submission.reason?.trim() || 'No decision recorded.'}
                        {submission.decided_by ? ` · ${submission.decided_by}` : ''}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="cit-stagger divide-y divide-slate-100 lg:hidden">
            {submissions.map((submission) => (
              <li key={submission.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-900">
                      {submission.title}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      <span className="tabular-nums">{submission.id}</span> · {submission.requester}
                    </p>
                  </div>
                  <StatusPill status={toBookingStatus(submission.status)} className="shrink-0" />
                </div>
                <p className="mt-2 text-[12px] text-slate-600">
                  {submission.room_id ?? 'No room yet'} · {slotLabel(submission)}
                </p>
                {submission.request_reason?.trim() ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-700">
                    {submission.request_reason}
                  </p>
                ) : null}
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                  {submission.reason?.trim() || 'No decision recorded.'}
                </p>
                {canDecide(submission) ? (
                  <button
                    type="button"
                    onClick={() => setDecisionTarget(submission)}
                    className="mt-2 h-8 rounded-lg border border-slate-300 px-3 text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-400"
                  >
                    Record a decision
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Session changes and recent decisions */}
      {(changes.length > 0 || decided.length > 0) && (
        <div
          className={cn(
            'mt-4 grid gap-4',
            changes.length > 0 && decided.length > 0 ? 'lg:grid-cols-2' : 'grid-cols-1',
          )}
        >
          {changes.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3">
                <h3 className="text-[15px] font-semibold text-slate-900">Session changes</h3>
                <p className="text-[12px] tabular-nums text-slate-500">{changes.length}</p>
              </div>
              <ul className="cit-stagger divide-y divide-slate-100">
                {changes.map((record) => (
                  <li key={record.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-[13px] font-medium text-slate-800">
                        {record.text}
                      </p>
                      <StatusPill status={toBookingStatus(record.status)} className="shrink-0" />
                    </div>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      <span className="tabular-nums">{record.id}</span>
                      {record.decided_by ? ` · ${record.decided_by}` : ''}
                      {record.reason ? ` · ${record.reason}` : ''}
                    </p>
                    {record.warnings && record.warnings.length > 0 ? (
                      <p className="mt-0.5 text-[12px] text-amber-700">
                        {record.warnings.join(' · ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {isAdmin || isCoordinator ? (
                <div className="border-t border-slate-100 px-4 py-2">
                  <Link
                    to="/approvals"
                    className="text-[12px] font-medium text-slate-700 transition-colors hover:text-slate-900"
                  >
                    Decide pending changes in the approvals inbox
                  </Link>
                </div>
              ) : null}
            </section>
          ) : null}

          {decided.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[15px] font-semibold text-slate-900">Recent decisions</h3>
                <p className="text-[12px] text-slate-500">On your requests, newest first.</p>
              </div>
              <ul className="cit-stagger divide-y divide-slate-100">
                {decided.map((row) => (
                  <motion.li
                    key={`${row.kind}-${row.id}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: SOFT_EASE }}
                    className="px-4 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-[13px] font-medium text-slate-800">
                        {row.label}
                      </p>
                      <StatusPill status={toBookingStatus(row.status)} className="shrink-0" />
                    </div>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      <span className="tabular-nums">{row.id}</span>
                      {row.decidedBy ? ` · ${row.decidedBy}` : ''}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </p>
                  </motion.li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <DecisionDialog
        open={decisionTarget !== null}
        title={decisionTarget ? `${decisionTarget.id} · ${decisionTarget.title ?? ''}` : ''}
        detail={
          decisionTarget
            ? `${decisionTarget.requester ?? 'unknown'} · ${decisionTarget.room_id ?? 'no room'} · ${slotLabel(decisionTarget)}`
            : undefined
        }
        onClose={() => setDecisionTarget(null)}
        onSubmit={(decision, reason) => void decide(decision, reason)}
      />
    </div>
  )
}
