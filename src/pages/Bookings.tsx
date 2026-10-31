import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck2, Filter, Lock, ShieldAlert } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, StatusNotice } from '../components/States'
import { BookingStatusBadge, PriorityBadge } from '../components/Badges'
import { DecisionDialog, type Decision } from '../components/DecisionDialog'
import { useAuth } from '../lib/auth'
import {
  decideBooking,
  getData,
  type AppData,
  type Booking,
  type BookingPriority,
  type BookingStatus,
} from '../lib/store'
import { DAYS, periodRangeLabel, timeRangeLabel, type Day } from '../lib/time'
import {
  bookingDecisionPermission,
  bookingLocation,
  derivedConflicts,
  visibleBookings,
} from '../lib/selectors'

type StatusFilter = BookingStatus | 'all'
type PriorityFilter = BookingPriority | 'all'
type DayFilter = Day | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'alternative_offered', label: 'Alternative offered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'All tiers' },
  { value: 1, label: 'Tier 1 · institute' },
  { value: 2, label: 'Tier 2 · department' },
  { value: 3, label: 'Tier 3 · club' },
]

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
  { value: 'all', label: 'All days' },
  ...DAYS.map((day) => ({ value: day as DayFilter, label: day })),
]

export default function Bookings() {
  const { user } = useAuth()
  const [data, setData] = useState<AppData>(getData)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [target, setTarget] = useState<Booking | null>(null)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const roomFilter = params.get('room') ?? 'all'

  const setRoomFilter = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('room')
    else next.set('room', value)
    setParams(next, { replace: true })
  }

  const conflictsByBooking = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const conflict of derivedConflicts(data)) {
      for (const bookingId of conflict.bookingIds ?? []) {
        const list = map.get(bookingId) ?? []
        list.push(`${conflict.code}: ${conflict.title}`)
        map.set(bookingId, list)
      }
    }
    return map
  }, [data])

  if (!user) return null

  const scoped = visibleBookings(data, user)
  const needle = query.trim().toLowerCase()

  const filtered = scoped.filter((booking) => {
    if (roomFilter !== 'all' && booking.roomId !== roomFilter) return false
    if (statusFilter !== 'all' && booking.status !== statusFilter) return false
    if (priorityFilter !== 'all' && booking.priority !== priorityFilter) return false
    if (dayFilter !== 'all' && booking.day !== dayFilter) return false
    if (mineOnly && booking.requester !== user.username) return false
    if (
      needle &&
      !`${booking.id} ${booking.title} ${booking.organizer} ${booking.requester} ${booking.roomId}`
        .toLowerCase()
        .includes(needle)
    ) {
      return false
    }
    return true
  })

  const summary = {
    total: scoped.length,
    pending: scoped.filter((booking) => booking.status === 'pending').length,
    approved: scoped.filter((booking) => booking.status === 'approved').length,
    rejected: scoped.filter((booking) => booking.status === 'rejected').length,
    alternative: scoped.filter((booking) => booking.status === 'alternative_offered').length,
    cancelled: scoped.filter((booking) => booking.status === 'cancelled').length,
  }

  const hasFilters =
    roomFilter !== 'all' ||
    query.trim() !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    dayFilter !== 'all' ||
    mineOnly

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setDayFilter('all')
    setMineOnly(false)
    setRoomFilter('all')
  }

  const submitDecision = (decision: Decision, reason: string) => {
    if (!target) return
    const result = decideBooking(target.id, decision, user, reason)
    if (!result.ok) {
      setFlash({ tone: 'error', message: result.error })
      setTarget(null)
      return
    }
    setData({ ...result.data })
    setFlash({
      tone: 'success',
      message: `${target.id} ${decision === 'approved' ? 'approved' : 'rejected'}. The decision and reason are in the audit log.`,
    })
    setTarget(null)
  }

  const roomName = (roomId: string) => data.rooms.find((room) => room.id === roomId)?.name ?? roomId

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle="The Spectra decision board — all 25 venue requests with priority, status and a grounded reason. Decisions are persisted locally and audited."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}

      <p className="mb-4 text-xs text-slate-500">
        {summary.total} requests visible to you ·{' '}
        <span className="font-medium text-neutral-700">{summary.pending} pending</span> ·{' '}
        <span className="font-medium text-neutral-600">{summary.approved} approved</span> ·{' '}
        <span className="font-medium text-neutral-700">{summary.rejected} rejected</span> ·{' '}
        <span className="font-medium text-neutral-600">{summary.alternative} alternative</span> ·{' '}
        <span className="font-medium text-neutral-500">{summary.cancelled} cancelled</span>
      </p>

      {/* Role scope explanation */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        {user.role === 'admin' && (
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" aria-hidden />
            <span>
              <span className="font-semibold text-slate-800">Admin decisions.</span> You can decide
              every pending request. Requests you raised yourself stay locked to another approver.
            </span>
          </p>
        )}
        {user.role === 'department_coordinator' && (
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" aria-hidden />
            <span>
              <span className="font-semibold text-slate-800">Department scope.</span> You can decide
              requests for {user.department ?? 'your department'} lab venues only; Admin decides
              everything else. Your own requests always need another approver.
            </span>
          </p>
        )}
        {user.role === 'event_manager' && (
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" aria-hidden />
            <span>
              <span className="font-semibold text-slate-800">Your requests only.</span> You can
              submit, track and cancel requests; an Admin or the owning department coordinator makes
              the decision. You can never approve your own request.
            </span>
          </p>
        )}
      </div>

      {/* Filters */}
      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-neutral-700" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="booking-search" className="mb-1 block text-xs font-medium text-slate-600">
              Search
            </label>
            <input
              id="booking-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID, title, organizer, requester"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="booking-status" className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="booking-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="booking-priority" className="mb-1 block text-xs font-medium text-slate-600">
              Priority
            </label>
            <select
              id="booking-priority"
              value={String(priorityFilter)}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value === 'all' ? 'all' : (Number(event.target.value) as BookingPriority),
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="booking-room" className="mb-1 block text-xs font-medium text-slate-600">
              Room
            </label>
            <select
              id="booking-room"
              value={roomFilter}
              onChange={(event) => setRoomFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="all">All rooms</option>
              {data.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="booking-day" className="text-xs font-medium text-slate-600">
              Day
            </label>
            <select
              id="booking-day"
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value as DayFilter)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800"
            >
              {DAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {user.role !== 'event_manager' && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(event) => setMineOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-neutral-900"
              />
              Only my requests
            </label>
          )}
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="No requests match these filters"
          description="Try a different status, priority or room, or clear the filters to see the full board."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3">Request</th>
                  <th scope="col" className="px-4 py-3">Venue &amp; time</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Reason</th>
                  <th scope="col" className="px-4 py-3 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((booking) => {
                  const permission = bookingDecisionPermission(data, booking, user)
                  const conflicts = conflictsByBooking.get(booking.id) ?? []
                  return (
                    <tr key={booking.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{booking.title}</p>
                        <p className="text-xs text-slate-500">
                          {booking.id} · {booking.organizer}
                        </p>
                        <p className="text-[11px] text-slate-400">Requester: {booking.requester}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{roomName(booking.roomId)}</p>
                        <p className="text-xs text-slate-500">
                          {booking.day} {periodRangeLabel(booking.startPeriod, booking.periods)} ·{' '}
                          {timeRangeLabel(booking.startPeriod, booking.periods)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {booking.expectedAttendees} expected
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={booking.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <BookingStatusBadge status={booking.status} />
                        {booking.decidedBy && (
                          <p className="mt-1 text-[11px] text-slate-400">by {booking.decidedBy}</p>
                        )}
                      </td>
                      <td className="max-w-[18rem] px-4 py-3">
                        <p className="text-xs leading-relaxed text-slate-600">
                          {booking.decisionReason ?? booking.note}
                        </p>
                        {conflicts.length > 0 && (
                          <p className="mt-1 text-[11px] font-medium text-neutral-700">
                            ⚠ {conflicts.length} check{conflicts.length === 1 ? '' : 's'} flagged
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {booking.status !== 'pending' ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : permission.allowed ? (
                          <button
                            type="button"
                            onClick={() => setTarget(booking)}
                            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
                          >
                            Decide
                          </button>
                        ) : (
                          <span className="inline-flex max-w-[13rem] items-start gap-1 text-left text-[11px] leading-snug text-slate-400">
                            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                            {permission.reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((booking) => {
              const permission = bookingDecisionPermission(data, booking, user)
              const conflicts = conflictsByBooking.get(booking.id) ?? []
              return (
                <article
                  key={booking.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">{booking.title}</h3>
                      <p className="text-xs text-slate-500">
                        {booking.id} · {booking.organizer}
                      </p>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Venue</p>
                      <p className="font-medium text-slate-800">{roomName(booking.roomId)}</p>
                      <p className="text-slate-500">
                        {booking.day} {periodRangeLabel(booking.startPeriod, booking.periods)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Priority</p>
                      <PriorityBadge priority={booking.priority} />
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    {booking.decisionReason ?? booking.note}
                  </p>

                  {conflicts.length > 0 && (
                    <p className="mt-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700">
                      ⚠ {conflicts.join(' · ')}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-400">
                      Requested by {booking.requester}
                      {booking.decidedBy ? ` · decided by ${booking.decidedBy}` : ''}
                    </p>
                    {booking.status === 'pending' &&
                      (permission.allowed ? (
                        <button
                          type="button"
                          onClick={() => setTarget(booking)}
                          className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
                        >
                          Decide
                        </button>
                      ) : (
                        <span className="inline-flex max-w-[11rem] items-start gap-1 text-right text-[11px] leading-snug text-slate-400">
                          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                          {permission.reason}
                        </span>
                      ))}
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}

      <DecisionDialog
        open={target !== null}
        title={target ? `${target.id} — ${target.title}` : ''}
        detail={target ? `${target.requester} · ${target.organizer} · ${bookingLocation(data, target)}` : undefined}
        conflicts={target ? conflictsByBooking.get(target.id) ?? [] : []}
        onClose={() => setTarget(null)}
        onSubmit={submitDecision}
      />
    </div>
  )
}
