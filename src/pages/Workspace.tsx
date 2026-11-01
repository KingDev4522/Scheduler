import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth'
import { SOFT_EASE } from '../lib/motion'
import { cn } from '../lib/utils'
import { toBookingStatus } from '../lib/bookingBoard'
import {
  api,
  type AvailabilityEntry,
  type BookingSubmission,
  type ChangeRequestRecord,
  type DatasetInfo,
} from '../lib/api'
import { StatusNotice } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { DecisionDialog, type Decision } from '../components/DecisionDialog'
import { StatusPill } from '../components/BookingStatus'
import { Field, FormSection, ToggleChip, fieldInput, fieldTextarea } from '../components/FormBits'

const OFFICIAL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI']
/** Teaching periods only. P10-P13 are event-only and must not be marked as teaching time. */
const PERIODS = Array.from({ length: 9 }, (_, index) => index + 1)
const EVENT_PERIODS = [10, 11, 12, 13]

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed.'
}

export default function Workspace() {
  const { user } = useAuth()
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [booting, setBooting] = useState(true)

  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [facultyId, setFacultyId] = useState('')
  const [entries, setEntries] = useState<AvailabilityEntry[]>([])
  const [day, setDay] = useState('MON')
  const [periods, setPeriods] = useState<number[]>([])
  const [reason, setReason] = useState('')
  const [availabilityName, setAvailabilityName] = useState('')

  const [requestText, setRequestText] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [changeRequests, setChangeRequests] = useState<ChangeRequestRecord[]>([])
  const [bookings, setBookings] = useState<BookingSubmission[]>([])
  const [policyOrder, setPolicyOrder] = useState<string[]>([])
  const [changeTarget, setChangeTarget] = useState<ChangeRequestRecord | null>(null)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('Plan changed')

  const isFaculty = user?.role === 'faculty'
  const isAdmin = user?.role === 'admin'
  const isClub = user?.role === 'event_manager'
  const isCoordinator = user?.role === 'department_coordinator'

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
    if (!user) {
      setBooting(false)
      return
    }

    let active = true
    const bootstrap = async () => {
      try {
        await loadRequests()
        if (!active) return

        if (isFaculty) await loadAvailability()
        if (!active) return

        if (isAdmin || isCoordinator) {
          try {
            const result = await api.dataset(user.username)
            if (!active) return
            setDataset(result)
            if (isAdmin) {
              const first = result.entities.faculty[0]?.id
              if (first) {
                setFacultyId(first)
                await loadAvailability(first)
              }
            }
          } catch {
            /* the page still works without the dataset */
          }

          if (isAdmin) {
            try {
              const result = await api.policy(user.username)
              if (active) setPolicyOrder(result.priority_order)
            } catch {
              /* ignore */
            }
          }
        }

        try {
          const result = await api.listBookings(user.username)
          if (active) setBookings(result.items)
        } catch {
          /* ignore */
        }
      } finally {
        if (active) setBooting(false)
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [user, isFaculty, isAdmin, isClub, isCoordinator, loadAvailability, loadRequests])

  const selectedFaculty = useMemo(
    () => dataset?.entities.faculty.find((member) => member.id === facultyId),
    [dataset, facultyId],
  )

  const decided = useMemo(() => {
    const me = user?.username ?? ''
    const rows = [
      ...bookings
        .filter((item) => item.requester === me || item.decided_by === me)
        .map((item) => ({
          key: `booking-${item.id}`,
          label: String(item.title ?? item.id),
          status: item.status,
          reason: item.reason ?? '',
          decidedBy: item.decided_by ?? '',
          decidedAt: item.decided_at ?? '',
        })),
      ...changeRequests
        .filter((item) => item.requester === me || item.decided_by === me)
        .map((item) => ({
          key: `change-${item.id}`,
          label: item.text,
          status: item.status,
          reason: item.reason ?? '',
          decidedBy: item.decided_by ?? '',
          decidedAt: item.decided_at ?? '',
        })),
    ]
    return rows
      .filter((row) => row.status === 'approved' || row.status === 'rejected')
      .sort((a, b) => String(b.decidedAt || '').localeCompare(String(a.decidedAt || '')))
      .slice(0, 5)
  }, [bookings, changeRequests])

  if (!user) return null

  if (booting) {
    return <PageSkeleton label="Loading your workspace…" variant="form" rows={4} />
  }

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
      const result = await api.setFacultyAvailability(entries, user.username, isAdmin ? facultyId : undefined)
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
    if (changeReason.trim().length < 3) {
      setFlash({
        tone: 'error',
        message: 'Add a short reason for this change. The approver sees it.',
      })
      return
    }
    setBusy(true)
    setFlash(null)
    try {
      const record = await api.createChangeRequest(requestText.trim(), user.username, null, changeReason.trim())
      setChangeRequests((current) => [record, ...current])
      setRequestText('')
      setChangeReason('')
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

  const cancelBooking = async (bookingId: string) => {
    setBusy(true)
    setFlash(null)
    try {
      await api.cancelBooking(bookingId, cancelReason || 'Plan changed', user.username)
      setBookings((current) =>
        current.map((item) =>
          item.id === bookingId ? { ...item, status: 'cancelled', reason: cancelReason } : item,
        ),
      )
      setFlash({ tone: 'success', message: `${bookingId} cancelled.` })
      setCancelTarget(null)
    } catch (error) {
      setFlash({ tone: 'error', message: messageOf(error) })
    } finally {
      setBusy(false)
    }
  }

  const decideChange = async (decision: Decision, reasonText: string) => {
    if (!changeTarget) return
    const record = changeTarget
    setChangeTarget(null)
    setBusy(true)
    try {
      await api.decideChangeRequest(record.id, decision, reasonText, user.username)
      setChangeRequests((current) =>
        current.map((item) =>
          item.id === record.id
            ? { ...item, status: decision, decided_by: user.username, reason: reasonText }
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

  const myBookings = bookings.filter((item) => item.requester === user.username)
  const openChanges = changeRequests.filter((item) => item.status === 'pending').length

  return (
    <div className="cit-page">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">My workspace</h2>
          <p className="mt-1 max-w-[56ch] text-[14px] leading-relaxed text-slate-600">
            {myBookings.length} booking request{myBookings.length === 1 ? '' : 's'} ·{' '}
            {changeRequests.length} session change{changeRequests.length === 1 ? '' : 's'} ·{' '}
            {openChanges} open
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/manual"
            className="hidden h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          >
            Manual booking
          </Link>
          <Link
            to="/approvals"
            className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Open approvals
          </Link>
        </div>
      </header>

      {flash ? (
        <div className="mt-4">
          <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {(isFaculty || isAdmin) && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-3">
                <h3 className="text-[15px] font-semibold text-slate-900">Unavailability</h3>
                <p className="text-[12px] text-slate-500">
                  {availabilityName || selectedFaculty?.name || 'Faculty member'}
                </p>
              </div>

              <div className="px-5 py-4">
                {isAdmin && dataset ? (
                  <Field label="Faculty member" htmlFor="workspace-faculty">
                    <select
                      id="workspace-faculty"
                      value={facultyId}
                      onChange={(event) => {
                        setFacultyId(event.target.value)
                        void loadAvailability(event.target.value)
                      }}
                      className={fieldInput}
                    >
                      {dataset.entities.faculty.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} · {member.department}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                <div className={cn(isAdmin && dataset ? 'mt-4' : '')}>
                  <p className="mb-1.5 text-[13px] font-medium text-slate-700">Blocked slots</p>
                  {entries.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-[12px] text-slate-500">
                      No unavailability recorded.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {entries.map((entry) => (
                        <li
                          key={`${entry.day}-${entry.periods.join('-')}`}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] tabular-nums text-slate-800">
                              {entry.day} · P{entry.periods.join(', P')}
                            </p>
                            <p className="text-[12px] text-slate-500">{entry.reason}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEntries((current) => current.filter((item) => item !== entry))}
                            aria-label={`Remove ${entry.day} unavailability`}
                            className="shrink-0 rounded px-1.5 py-0.5 text-[12px] text-slate-500 transition-colors hover:text-rose-700"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[100px_minmax(0,1fr)]">
                  <Field label="Day" htmlFor="workspace-day">
                    <select
                      id="workspace-day"
                      value={day}
                      onChange={(event) => setDay(event.target.value)}
                      className={fieldInput}
                    >
                      {OFFICIAL_DAYS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Reason" htmlFor="workspace-reason">
                    <input
                      id="workspace-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Department meeting"
                      className={fieldInput}
                    />
                  </Field>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-[13px] font-medium text-slate-700">Periods</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PERIODS.map((period) => (
                      <ToggleChip
                        key={period}
                        active={periods.includes(period)}
                        onClick={() =>
                          setPeriods((current) =>
                            current.includes(period)
                              ? current.filter((value) => value !== period)
                              : [...current, period].sort((a, b) => a - b),
                          )
                        }
                      >
                        P{period}
                      </ToggleChip>
                    ))}
                    {EVENT_PERIODS.map((period) => (
                      <span
                        key={period}
                        title="Event-only slot; not a teaching period"
                        className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2 text-[12px] text-slate-400"
                      >
                        P{period}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] text-slate-500">
                    Teaching P1–P9 · 08:00–18:00 · lunch 13:00–14:00 between P5 and P6. P10–P13 are
                    event-only and never counted in faculty load.
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addEntry}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-400"
                  >
                    Add block
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAvailability()}
                    disabled={busy}
                    className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                  >
                    Save availability
                  </button>
                </div>
              </div>
            </section>
          )}

          {(isFaculty || isAdmin || isCoordinator) && (
            <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <FormSection
                title="Request a session change"
                hint="An Admin decides; nothing moves until then."
              >
                <Field label="The change" htmlFor="workspace-change" required>
                  <textarea
                    id="workspace-change"
                    rows={3}
                    value={requestText}
                    onChange={(event) => setRequestText(event.target.value)}
                    placeholder="Move CS201 tutorial from Monday P3 to Tuesday P6, room LT-2"
                    className={fieldTextarea}
                  />
                </Field>
                <Field label="Reason" htmlFor="workspace-change-reason" required>
                  <input
                    id="workspace-change-reason"
                    value={changeReason}
                    onChange={(event) => setChangeReason(event.target.value)}
                    placeholder="Why does this need to move?"
                    className={fieldInput}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => void submitChange()}
                  disabled={busy}
                  className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                >
                  Submit for review
                </button>
              </FormSection>
            </section>
          )}

          {isClub && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-3">
                <h3 className="text-[15px] font-semibold text-slate-900">My booking requests</h3>
                <p className="text-[12px] tabular-nums text-slate-500">{myBookings.length}</p>
              </div>
              {myBookings.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-slate-500">
                  Nothing yet. Submit a request from Manual Booking or the AI Assistant.
                </p>
              ) : (
                <ul className="cit-stagger divide-y divide-slate-100">
                  {myBookings.map((booking) => (
                    <li key={booking.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-slate-800">
                            {String(booking.title ?? booking.id)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            <span className="tabular-nums">{booking.id}</span>
                            {booking.reason ? ` · ${String(booking.reason)}` : ''}
                          </p>
                        </div>
                        <StatusPill status={toBookingStatus(String(booking.status))} className="shrink-0" />
                      </div>

                      {['pending', 'approved', 'alternative_offered'].includes(String(booking.status)) ? (
                        cancelTarget === booking.id ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              value={cancelReason}
                              onChange={(event) => setCancelReason(event.target.value)}
                              aria-label="Reason for cancelling"
                              className={cn(fieldInput, 'h-8 max-w-xs')}
                            />
                            <button
                              type="button"
                              onClick={() => void cancelBooking(booking.id)}
                              disabled={busy}
                              className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[12px] font-medium text-rose-800 transition-colors hover:bg-rose-100 disabled:opacity-50"
                            >
                              Confirm cancellation
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelTarget(null)}
                              className="h-8 rounded-lg px-2 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                            >
                              Keep it
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(booking.id)}
                            className="mt-2 h-8 rounded-lg border border-slate-300 px-3 text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-400"
                          >
                            Cancel request
                          </button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {isAdmin && policyOrder.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <FormSection
                title="Priority order"
                hint="Highest first. Saving clears the generated schedule."
              >
                <ol className="space-y-1">
                  {policyOrder.map((category, index) => (
                    <li
                      key={category}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5"
                    >
                      <span className="text-[13px] text-slate-700">
                        <span className="mr-1.5 tabular-nums text-slate-400">{index + 1}</span>
                        {category.replace(/_/g, ' ')}
                      </span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => movePolicy(index, -1)}
                          disabled={index === 0}
                          className="rounded border border-slate-200 px-2 py-0.5 text-[12px] text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-40"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => movePolicy(index, 1)}
                          disabled={index === policyOrder.length - 1}
                          className="rounded border border-slate-200 px-2 py-0.5 text-[12px] text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-40"
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
                  disabled={busy}
                  className="h-8 rounded-lg bg-neutral-900 px-3 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                >
                  Save priority order
                </button>
              </FormSection>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3">
              <h3 className="text-[15px] font-semibold text-slate-900">Change requests</h3>
              <p className="text-[12px] tabular-nums text-slate-500">
                {changeRequests.length} · {openChanges} open
              </p>
            </div>
            {changeRequests.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-slate-500">No change requests yet.</p>
            ) : (
              <ul className="cit-stagger divide-y divide-slate-100">
                {changeRequests.map((record) => (
                  <motion.li
                    key={record.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: SOFT_EASE }}
                    className="px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-[13px] font-medium text-slate-800">{record.text}</p>
                      <StatusPill status={toBookingStatus(record.status)} className="shrink-0" />
                    </div>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      <span className="tabular-nums">{record.id}</span> · {record.requester}
                      {record.decided_by ? ` · ${record.decided_by}` : ''}
                    </p>
                    {record.request_reason ||
                    ((record.draft as Record<string, unknown>)?.request_reason as string | undefined) ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-700">
                        {record.request_reason ??
                          ((record.draft as Record<string, unknown>)?.request_reason as string)}
                      </p>
                    ) : null}
                    {record.reason ? (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                        Decision: {record.reason}
                      </p>
                    ) : null}
                    {record.follow_up.length > 0 ? (
                      <p className="mt-0.5 text-[12px] text-amber-700">{record.follow_up[0]}</p>
                    ) : null}
                    {record.alternatives && record.alternatives.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {record.alternatives.slice(0, 3).map((alternative) => (
                          <li
                            key={`${alternative.session_id}-${alternative.day}-${alternative.start_period}-${alternative.room_id}`}
                            className="text-[12px] tabular-nums text-slate-600"
                          >
                            {alternative.room_id} · {alternative.day} P{alternative.start_period}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {record.status === 'pending' &&
                    user.role === 'admin' &&
                    record.requester !== user.username ? (
                      <button
                        type="button"
                        onClick={() => setChangeTarget(record)}
                        className="mt-2 h-8 rounded-lg bg-neutral-900 px-3 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800"
                      >
                        Decide
                      </button>
                    ) : null}
                  </motion.li>
                ))}
              </ul>
            )}
          </section>

          {decided.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[15px] font-semibold text-slate-900">Recent decisions</h3>
                <p className="text-[12px] text-slate-500">On your requests, newest first.</p>
              </div>
              <ul className="cit-stagger divide-y divide-slate-100">
                {decided.map((row) => (
                  <motion.li
                    key={row.key}
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
                      {row.decidedBy ? `${row.decidedBy} · ` : ''}
                      {row.reason || 'No reason recorded.'}
                    </p>
                  </motion.li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <DecisionDialog
        open={changeTarget !== null}
        title={changeTarget ? `${changeTarget.id} · ${changeTarget.text}` : ''}
        detail={changeTarget ? `${changeTarget.requester} · session change` : undefined}
        onClose={() => setChangeTarget(null)}
        onSubmit={(decision, text) => void decideChange(decision, text)}
      />
    </div>
  )
}
