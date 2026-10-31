import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  Send,
  Trash2,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, StatusNotice } from '../components/States'
import { useAuth } from '../lib/auth'
import {
  api,
  type AvailabilityEntry,
  type BookingSubmission,
  type ChangeRequestRecord,
  type DatasetInfo,
} from '../lib/api'

const OFFICIAL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI']
const PERIODS = Array.from({ length: 13 }, (_, index) => index + 1)

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed.'
}

export default function Workspace() {
  const { user } = useAuth()
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [facultyId, setFacultyId] = useState('')
  const [entries, setEntries] = useState<AvailabilityEntry[]>([])
  const [day, setDay] = useState('MON')
  const [periods, setPeriods] = useState<number[]>([])
  const [reason, setReason] = useState('')
  const [availabilityName, setAvailabilityName] = useState('')

  const [requestText, setRequestText] = useState('')
  const [changeRequests, setChangeRequests] = useState<ChangeRequestRecord[]>([])
  const [bookings, setBookings] = useState<BookingSubmission[]>([])
  const [policyOrder, setPolicyOrder] = useState<string[]>([])

  const isFaculty = user?.role === 'faculty'
  const isAdmin = user?.role === 'admin'
  const isClub = user?.role === 'event_manager'

  const loadAvailability = useCallback(
    async (id?: string) => {
      if (!user || (!isFaculty && !isAdmin)) return
      try {
        const result = await api.facultyAvailability(id, user.username)
        setFacultyId(result.faculty_id)
        setEntries(result.unavailable ?? [])
        setAvailabilityName(result.name)
        setDay(result.unavailable?.[0]?.day ?? 'MON')
      } catch (error) {
        setFlash({ tone: 'error', message: messageOf(error) })
      }
    },
    [user, isFaculty, isAdmin],
  )

  const loadRequests = useCallback(async () => {
    if (!user) return
    try {
      const result = await api.changeRequests(user.username)
      setChangeRequests(result.items)
    } catch (error) {
      setFlash({ tone: 'error', message: messageOf(error) })
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    void loadRequests()
    if (isFaculty) void loadAvailability()
    if (isAdmin) {
      api
        .dataset(user.username)
        .then((result) => {
          setDataset(result)
          const first = result.entities.faculty[0]?.id
          if (first) {
            setFacultyId(first)
            void loadAvailability(first)
          }
        })
        .catch(() => undefined)
      api
        .policy(user.username)
        .then((result) => setPolicyOrder(result.priority_order))
        .catch(() => undefined)
    }
    if (isClub) {
      api
        .listBookings(user.username)
        .then((result) => setBookings(result.items))
        .catch(() => undefined)
    }
  }, [user, isFaculty, isAdmin, isClub, loadAvailability, loadRequests])

  const selectedFaculty = useMemo(
    () => dataset?.entities.faculty.find((member) => member.id === facultyId),
    [dataset, facultyId],
  )

  if (!user) return null

  const addEntry = () => {
    if (periods.length === 0) {
      setFlash({ tone: 'error', message: 'Choose at least one period.' })
      return
    }
    setEntries((current) => [
      ...current.filter((entry) => entry.day !== day),
      { day, periods: [...periods].sort((a, b) => a - b), reason: reason.trim() || 'Marked unavailable' },
    ])
    setPeriods([])
    setReason('')
  }

  const saveAvailability = async () => {
    setBusy(true)
    setFlash(null)
    try {
      const result = await api.setFacultyAvailability(
        entries,
        user.username,
        isAdmin ? facultyId : undefined,
      )
      setEntries(result.unavailable)
      setFlash({ tone: 'success', message: 'Availability saved. The next generate uses it.' })
    } catch (error) {
      setFlash({ tone: 'error', message: messageOf(error) })
    } finally {
      setBusy(false)
    }
  }

  const submitChange = async () => {
    if (requestText.trim().length < 5) {
      setFlash({ tone: 'error', message: 'Describe the change first.' })
      return
    }
    setBusy(true)
    setFlash(null)
    try {
      const record = await api.createChangeRequest(requestText.trim(), user.username)
      setChangeRequests((current) => [record, ...current])
      setRequestText('')
      setFlash({
        tone: 'success',
        message: `${record.id} saved for Admin review. Nothing changes until it is approved.`,
      })
    } catch (error) {
      setFlash({ tone: 'error', message: messageOf(error) })
    } finally {
      setBusy(false)
    }
  }

  const cancelBooking = async (booking: BookingSubmission) => {
    const reasonText = window.prompt('Reason for cancelling this request?', 'Plan changed')
    if (reasonText === null) return
    setBusy(true)
    setFlash(null)
    try {
      await api.cancelBooking(booking.id, reasonText || 'Plan changed', user.username)
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id ? { ...item, status: 'cancelled', reason: reasonText } : item,
        ),
      )
      setFlash({ tone: 'success', message: `${booking.id} cancelled.` })
    } catch (error) {
      setFlash({ tone: 'error', message: messageOf(error) })
    } finally {
      setBusy(false)
    }
  }

  const decideChange = async (record: ChangeRequestRecord, decision: 'approved' | 'rejected') => {
    const reasonText = window.prompt(
      `Reason to ${decision === 'approved' ? 'approve' : 'reject'} ${record.id}?`,
      '',
    )
    if (reasonText === null) return
    if (reasonText.trim().length < 3) {
      setFlash({ tone: 'error', message: 'A reason of at least 3 characters is required.' })
      return
    }
    setBusy(true)
    try {
      await api.decideChangeRequest(record.id, decision, reasonText.trim(), user.username)
      setChangeRequests((current) =>
        current.map((item) =>
          item.id === record.id
            ? { ...item, status: decision, decided_by: user.username, reason: reasonText.trim() }
            : item,
        ),
      )
      setFlash({ tone: 'success', message: `${record.id} ${decision}.` })
    } catch (error) {
      setFlash({ tone: 'error', message: messageOf(error) })
    } finally {
      setBusy(false)
    }
  }

  const savePolicy = async () => {
    setBusy(true)
    setFlash(null)
    try {
      const result = await api.setPolicy(policyOrder, user.username)
      setPolicyOrder(result.priority_order)
      setFlash({ tone: 'success', message: 'Priority order saved. The next generate uses it.' })
    } catch (error) {
      setFlash({ tone: 'error', message: messageOf(error) })
    } finally {
      setBusy(false)
    }
  }

  const movePolicy = (index: number, delta: number) => {
    setPolicyOrder((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <div>
      <PageHeader
        title="My workspace"
        subtitle="Role-specific actions: faculty availability and change requests, club cancellations, and Admin review."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}

      {(isFaculty || isAdmin) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <UserRound className="h-4 w-4 text-neutral-700" aria-hidden />
              Faculty unavailability
            </h3>
            <span className="text-xs text-slate-500">
              {availabilityName || selectedFaculty?.name || 'Faculty member'}
            </span>
          </div>

          {isAdmin && dataset && (
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Faculty member
              <select
                value={facultyId}
                onChange={(event) => {
                  setFacultyId(event.target.value)
                  void loadAvailability(event.target.value)
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {dataset.entities.faculty.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.department}
                  </option>
                ))}
              </select>
            </label>
          )}

          <ul className="mt-3 space-y-2">
            {entries.length === 0 ? (
              <li className="text-sm text-slate-400">No unavailability recorded.</li>
            ) : (
              entries.map((entry) => (
                <li
                  key={`${entry.day}-${entry.periods.join('-')}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {entry.day} · P{entry.periods.join(', P')}
                    </p>
                    <p className="text-xs text-slate-500">{entry.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEntries((current) =>
                        current.filter((item) => item !== entry),
                      )
                    }
                    aria-label={`Remove ${entry.day} unavailability`}
                    className="rounded p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              Day
              <select
                value={day}
                onChange={(event) => setDay(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
              >
                {OFFICIAL_DAYS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Reason
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Department meeting"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PERIODS.map((period) => {
              const active = periods.includes(period)
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() =>
                    setPeriods((current) =>
                      active ? current.filter((value) => value !== period) : [...current, period],
                    )
                  }
                  aria-pressed={active}
                  className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                    active
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  P{period}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addEntry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add block
            </button>
            <button
              type="button"
              onClick={() => void saveAvailability()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
              Save availability
            </button>
          </div>
        </section>
      )}

      {(isFaculty || isAdmin) && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Send className="h-4 w-4 text-neutral-700" aria-hidden />
            Request a session change
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Describe a move, cancellation or extra session. Gemini extracts the target; the
            deterministic workflow and Admin decide what happens.
          </p>
          <textarea
            rows={3}
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            placeholder="Move CS201 tutorial from Monday P3 to Tuesday P6, room LT-2"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void submitChange()}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" aria-hidden /> Submit for review
          </button>
        </section>
      )}

      {isClub && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays className="h-4 w-4 text-neutral-700" aria-hidden />
            My booking requests
          </h3>
          {bookings.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={CalendarDays}
                title="No requests yet"
                description="Submit a request from Manual Booking or the AI Assistant."
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {bookings.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {String(booking.title ?? booking.id)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {booking.id} · {String(booking.status)}
                      {booking.reason ? ` · ${String(booking.reason)}` : ''}
                    </p>
                  </div>
                  {['pending', 'approved', 'alternative_offered'].includes(String(booking.status)) && (
                    <button
                      type="button"
                      onClick={() => void cancelBooking(booking)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      Cancel request
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock3 className="h-4 w-4 text-neutral-700" aria-hidden />
            Spectra priority order
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Highest priority first. Saving clears the current generated schedule so the policy is
            applied on the next generate.
          </p>
          <ol className="mt-3 space-y-1.5">
            {policyOrder.map((category, index) => (
              <li
                key={category}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
              >
                <span className="text-xs font-medium text-slate-700">
                  {index + 1}. {category.replace(/_/g, ' ')}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => movePolicy(index, -1)}
                    disabled={index === 0}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => movePolicy(index, 1)}
                    disabled={index === policyOrder.length - 1}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] disabled:opacity-40"
                  >
                    Down
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => void savePolicy()}
            disabled={busy || policyOrder.length === 0}
            className="mt-3 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Save priority order
          </button>
        </section>
      )}

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock3 className="h-4 w-4 text-neutral-700" aria-hidden />
            Change requests
          </h3>
          <Link to="/approvals" className="text-xs font-semibold text-neutral-900">
            Open approvals →
          </Link>
        </div>
        {changeRequests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No change requests yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {changeRequests.map((record) => (
              <li key={record.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{record.text}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {record.id} · {record.requester} · {record.status}
                      {record.decided_by ? ` · decided by ${record.decided_by}` : ''}
                    </p>
                    {record.follow_up.length > 0 && (
                      <p className="mt-1 text-xs text-amber-700">{record.follow_up[0]}</p>
                    )}
                    {record.reason && <p className="mt-1 text-xs text-slate-600">{record.reason}</p>}
                  </div>
                  {isAdmin && record.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void decideChange(record, 'approved')}
                        className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void decideChange(record, 'rejected')}
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-xs text-slate-500">
        Manual booking remains available at <Link to="/manual" className="font-semibold text-neutral-900">Manual Booking</Link>{' '}
        even if the AI provider is unavailable. Nothing here bypasses deterministic validation.
      </p>
    </div>
  )
}
