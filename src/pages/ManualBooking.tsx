import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, CheckCircle2, Clock3, Info, Plus } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, StatusNotice } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { BookingDraftForm, type BookingFormOptions } from '../components/BookingDraftForm'
import { SessionChangeForm } from '../components/SessionChangeForm'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import { useAvailability } from '../hooks/useAvailability'
import { canCoordinatorDecideRoom, sessionDepartment } from '../lib/departments'
import { datasetDay, formatDate } from '../lib/semester'
import { buildOfficialView } from '../lib/official'
import {
  api,
  type BookingAlternative,
  type BookingDraft,
  type BookingProposalPayload,
  type BookingSubmission,
  type BookingValidation,
  type ChangeRequestRecord,
} from '../lib/api'

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
  const time = `${submission.start_period ? `P${submission.start_period}` : '—'}–${
    submission.end_period ? `P${submission.end_period}` : '—'
  }`
  const day = submission.day ?? ''
  if (dates.length === 0) return `${day} ${time}`
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
  const [target, setTarget] = useState<{ room_id: string; day: string; start_period: number } | null>(null)
  const [validation, setValidation] = useState<BookingValidation | null>(null)
  const [submissions, setSubmissions] = useState<BookingSubmission[]>([])
  const [changes, setChanges] = useState<ChangeRequestRecord[]>([])
  const [category, setCategory] = useState('institute_event')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

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
      .slice(0, 5)
  }, [submissions, changes, user?.username])

  if (!user) return null

  if (official.loading && !official.dataset) {
    return <PageSkeleton label="Loading the official dataset…" variant="form" rows={4} />
  }

  if (!official.dataset || !options) {
    return (
      <div>
        <PageHeader title="Manual booking" subtitle="Validated without AI." />
        <ErrorState
          title="Backend not reachable"
          description={`${official.error ?? 'The scheduling API is offline.'} Start it with: python -m uvicorn backend.app:app --port 8000`}
          onRetry={() => void official.refresh()}
        />
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
      setFlash({ tone: 'error', message: error instanceof Error ? error.message : 'Validation failed.' })
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
        message: `${result.request.id} submitted for approval in ${result.request.room_id ?? 'a room'} on ${result.request.day ?? ''}.`,
      })
      setDraft(EMPTY_DRAFT)
      setTarget(null)
      setValidation(null)
      await loadRequests()
    } catch (error) {
      setFlash({ tone: 'error', message: error instanceof Error ? error.message : 'Submission failed.' })
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
    // Never leave Submit silently disabled: validate first, then either submit
    // or tell the user exactly why a feasible slot must be chosen.
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
            ? 'No exact slot is selected yet. Choose one of the feasible alternatives below, then press Submit again.'
            : 'This request does not pass the hard checks yet. Fix the listed issues and press Submit again.',
      })
    }
  }

  const decide = async (submission: BookingSubmission, decision: 'approved' | 'rejected') => {
    const reason = window.prompt(`Reason for ${decision === 'approved' ? 'approving' : 'rejecting'} ${submission.id}`)
    if (!reason || reason.trim().length < 3) return
    try {
      await api.decideBookingSubmission(submission.id, decision, reason, user.username)
      setFlash({ tone: 'success', message: `${submission.id} ${decision}.` })
      await loadRequests()
    } catch (error) {
      setFlash({ tone: 'error', message: error instanceof Error ? error.message : 'Decision failed.' })
    }
  }

  const eventTitle =
    isCoordinator ? 'Department event' : isAdmin ? 'Event booking' : 'Club venue request'
  const pageSubtitle = isFaculty
    ? 'Request a move for one of your sessions. Hard conflicts block submission; soft warnings do not.'
    : isCoordinator
      ? 'Book a room for a department event, or request a department session change.'
      : isAdmin
        ? 'Book any event, choose its priority category, or request a session change.'
        : 'Request a venue for a club event. An Admin or the owning coordinator decides; you never approve your own request.'

  return (
    <div className="cit-page">
      <PageHeader title="Manual booking" subtitle={pageSubtitle} />

      {flash && (
        <StatusNotice tone={flash.tone}>
          {flash.message}
          {flash.tone === 'success' && (
            <>
              {' '}
              <Link to="/approvals" className="font-semibold underline">
                Track it in Approvals →
              </Link>
            </>
          )}
        </StatusNotice>
      )}

      {decided.length > 0 && (
        <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-900">Recent decisions on your requests</p>
          <ul className="mt-1 space-y-1 text-[11px] text-emerald-800">
            {decided.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <span className="font-semibold">{row.label}</span> · {row.status}
                {row.decidedBy ? ` by ${row.decidedBy}` : ''}
                {row.requestReason ? ` · request reason: ${row.requestReason}` : ''}
                {row.reason ? ` · decision: ${row.reason}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showTabs && (
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(['event', 'change'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              aria-pressed={activeTab === option}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                activeTab === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {option === 'event' ? eventTitle : 'Session change'}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'event' && canBookEvents && (
        <section className="cit-card rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Plus className="h-4 w-4" aria-hidden /> {eventTitle}
            </h3>
            <Link to="/assistant" className="text-xs font-semibold text-indigo-700 hover:underline">
              Use the assistant instead →
            </Link>
          </div>

          {isAdmin && (
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Priority category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-xs"
              >
                {ADMIN_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-4">
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
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void validate()}
              disabled={busy}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
            >
              Check availability
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit for approval
            </button>
            <span className="text-xs text-neutral-500">
              {validation?.ok
                ? 'A validated slot is selected. Submitting records a pending request.'
                : 'Submit validates first; if no exact room is chosen, pick a feasible alternative below and submit again.'}
            </span>
          </div>

          {validation && (
            <div className="cit-anim-pop mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs font-semibold text-neutral-800">
                {validation.ok ? 'All hard checks pass' : 'Deterministic checks'}
              </p>
              {validation.violations.length > 0 && (
                <ul className="mt-1 space-y-1 text-xs text-rose-700">
                  {validation.violations.map((violation) => (
                    <li key={violation}>• {violation}</li>
                  ))}
                </ul>
              )}
              {validation.alternatives.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-neutral-700">Feasible alternatives</p>
                  <ul className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {validation.alternatives.map((alternative) => (
                      <li key={`${alternative.room_id}-${alternative.day}-${alternative.start_period}`}>
                        <button
                          type="button"
                          onClick={() => void chooseAlternative(alternative)}
                          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-xs text-neutral-700 hover:border-neutral-400"
                        >
                          <span className="font-semibold">{alternative.room_id}</span> · {alternative.day} P
                          {alternative.start_period}–P{alternative.end_period} · {alternative.type} ·{' '}
                          {alternative.capacity} seats
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {validation.ok && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready to submit.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === 'change' && canChange && options && (
        <section className="cit-card mt-4 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Clock3 className="h-4 w-4" aria-hidden /> Request a session change
            </h3>
            {isFaculty && (
              <Link to="/workspace" className="text-xs font-semibold text-indigo-700 hover:underline">
                Mark unavailability in My Workspace →
              </Link>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            A hard violation (room/faculty/group clash, capacity, fixed slot) is red and cannot be
            submitted. Soft preferences are orange and can still be reviewed.
          </p>
          <div className="mt-4">
            <SessionChangeForm
              user={user}
              sessions={changeSessions}
              rooms={options.rooms}
              semester={options.semester}
              onSubmitted={() => void loadRequests()}
            />
          </div>
        </section>
      )}

      {activeTab === 'change' && canChange && !data && (
        <div className="mt-4">
          <EmptyState
            icon={CalendarPlus}
            title="Generate the timetable first"
            description="Session changes are checked against the generated timetable."
          />
        </div>
      )}

      {((canBookEvents && submissions.length > 0) || changes.length > 0) && (
        <section className="cit-card mt-5 rounded-xl border border-neutral-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            {isAdmin || isCoordinator ? 'Requests in your scope' : 'My requests'}
          </h3>

          {canBookEvents && submissions.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Request</th>
                    <th className="px-3 py-2">Requester</th>
                    <th className="px-3 py-2">Slot</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Request reason</th>
                    <th className="px-3 py-2">Decision reason</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="cit-stagger-rows divide-y divide-neutral-100">
                  {submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-neutral-800">{submission.title}</p>
                        <p className="text-[11px] text-neutral-500">{submission.id}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-600">{submission.requester}</td>
                      <td className="px-3 py-2 text-xs text-neutral-600">
                        <p className="font-medium text-neutral-700">{submission.room_id ?? '—'}</p>
                        <p>{slotLabel(submission)}</p>
                      </td>
                      <td className="px-3 py-2 text-xs capitalize text-neutral-700">{submission.status}</td>
                      <td className="px-3 py-2 text-xs text-neutral-600">
                        {submission.request_reason?.trim() || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-600">{submission.reason ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {submission.status === 'pending' &&
                        (user.role === 'admin' ||
                          (user.role === 'department_coordinator' &&
                            canCoordinatorDecideRoom(
                              user,
                              String(submission.room_id ?? submission.requested_room ?? ''),
                            ))) ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void decide(submission, 'approved')}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void decide(submission, 'rejected')}
                              className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {changes.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Session-change requests
              </h4>
              <ul className="mt-1 divide-y divide-neutral-100">
                {changes.map((record) => (
                  <li key={record.id} className="py-2.5 text-xs text-neutral-700">
                    <p className="font-medium text-neutral-800">{record.text}</p>
                    <p className="mt-0.5 text-neutral-500">
                      {record.id} · {record.status}
                      {record.decided_by ? ` by ${record.decided_by}` : ''}
                      {record.reason ? ` — ${record.reason}` : ''}
                    </p>
                    {record.warnings && record.warnings.length > 0 && (
                      <p className="mt-0.5 text-amber-700">{record.warnings.join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ul>
              {(isAdmin || isCoordinator) && (
                <Link to="/approvals" className="mt-2 inline-block text-[11px] font-semibold text-neutral-900">
                  Decide pending requests in Approvals →
                </Link>
              )}
            </div>
          )}

          {submissions.length === 0 && changes.length === 0 && (
            <div className="mt-3">
              <EmptyState
                icon={Info}
                title="No requests yet"
                description="Submitted requests appear here with their status and decision reason."
              />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
