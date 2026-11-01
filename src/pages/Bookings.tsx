import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarCheck2, Search, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import { api, type BookingSubmission, type ChangeRequestRecord } from '../lib/api'
import { buildBookingBoard, categoryLabel, TIER_LABEL } from '../lib/bookingBoard'
import { DAYS, type Day } from '../lib/time'
import { findNav, navLabel } from '../lib/nav'
import type { BookingStatus } from '../lib/store'
import { EmptyState, ErrorState } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { BookingStatusCards, statusCardsFromCounts, type StatusFilter } from '../components/BookingStatusCards'
import { FestWeekBoard } from '../components/FestWeekBoard'
import { RequestLedger } from '../components/RequestLedger'
import { StatusPill } from '../components/BookingStatus'
import { cn } from '../lib/utils'

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Every tier' },
  { value: '1', label: TIER_LABEL[1] },
  { value: '2', label: TIER_LABEL[2] },
  { value: '3', label: TIER_LABEL[3] },
]

const KNOWN_STATUSES: BookingStatus[] = [
  'pending',
  'approved',
  'alternative_offered',
  'rejected',
  'cancelled',
]

function asStatus(value: string): BookingStatus {
  return KNOWN_STATUSES.includes(value as BookingStatus) ? (value as BookingStatus) : 'pending'
}

function controlClass(extra?: string) {
  return cn(
    'h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 transition-colors',
    'hover:border-slate-400 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
    'dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950',
    extra,
  )
}

/** One short sentence naming what the solver did with the board. */
function findingLine(counts: Record<'all' | BookingStatus, number>) {
  const parts: string[] = []
  if (counts.approved) {
    parts.push(`${counts.all === counts.approved ? 'All' : counts.approved} of ${counts.all} placed inside the window they asked for`)
  }
  if (counts.alternative_offered) parts.push(`${counts.alternative_offered} offered a slot outside it`)
  if (counts.pending) parts.push(`${counts.pending} still waiting on a decision`)
  if (counts.rejected) parts.push(`${counts.rejected} refused`)
  if (counts.cancelled) parts.push(`${counts.cancelled} withdrawn`)
  return parts.join(' · ')
}

export default function Bookings() {
  const { user } = useAuth()
  const official = useOfficial()
  const [params, setParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [tier, setTier] = useState('all')
  const [day, setDay] = useState<'all' | Day>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [myBookings, setMyBookings] = useState<BookingSubmission[]>([])
  const [myChanges, setMyChanges] = useState<ChangeRequestRecord[]>([])

  const roomFilter = params.get('room') ?? 'all'
  const setRoomFilter = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('room')
    else next.set('room', value)
    setParams(next, { replace: true })
  }

  const loadMine = useCallback(async () => {
    if (!user) return
    try {
      const [bookings, changes] = await Promise.all([
        api.listBookings(user.username),
        api.changeRequests(user.username),
      ])
      setMyBookings(bookings.items)
      setMyChanges(changes.items)
    } catch {
      // The solver board still works when the personal lists cannot be read.
    }
  }, [user])

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  const board = useMemo(() => {
    if (!official.dataset || !official.schedule) return null
    return buildBookingBoard(official.dataset, official.schedule)
  }, [official.dataset, official.schedule])

  const isApprover =
    user?.role === 'admin' || user?.role === 'department_coordinator'

  const adhoc = useMemo(() => {
    if (!user) return []
    const items: {
      id: string
      label: string
      detail: string
      status: string
      mine: boolean
      reason?: string
    }[] = []
    for (const item of myBookings) {
      if (item.requester !== user.username && !isApprover) continue
      items.push({
        id: item.id,
        label: item.title ?? item.id,
        detail: [item.room_id ?? item.requested_room ?? 'no venue', item.day ?? '']
          .filter(Boolean)
          .join(' · '),
        status: String(item.status),
        mine: item.requester === user.username,
        reason: (item.reason as string | null) ?? undefined,
      })
    }
    for (const item of myChanges) {
      if (item.requester !== user.username && !isApprover) continue
      items.push({
        id: item.id,
        label: item.text,
        detail: 'session change',
        status: item.status,
        mine: item.requester === user.username,
        reason: item.reason ?? undefined,
      })
    }
    return items.sort((a, b) => Number(b.mine) - Number(a.mine))
  }, [myBookings, myChanges, user, isApprover])

  const manualNav = findNav('/manual')
  const manualLabel = user && manualNav ? navLabel(manualNav, user.role) : 'Request a venue'

  const selectRow = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  // Bring the chosen request into view: the week board and the ledger share one selection.
  useEffect(() => {
    if (!selectedId) return
    const desktop =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches
    const target =
      document.getElementById(`${desktop ? 'ledger' : 'ledger-m'}-${selectedId}`) ??
      document.getElementById(`ledger-${selectedId}`)
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
  }, [selectedId])

  const filtered = useMemo(() => {
    if (!board) return []
    const needle = query.trim().toLowerCase()
    return board.rows.filter((row) => {
      if (roomFilter !== 'all' && row.granted?.roomId !== roomFilter && row.requestedRoom !== roomFilter) {
        return false
      }
      if (tier !== 'all' && String(row.tier) !== tier) return false
      if (day !== 'all' && row.granted?.day !== day && row.windows[0]?.day !== day) return false
      if (
        needle &&
        !`${row.id} ${row.title} ${row.requester} ${row.roomName ?? ''} ${row.categoryLabel}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false
      }
      return true
    })
  }, [board, query, roomFilter, tier, day])

  const scopedCounts = useMemo(() => {
    const counts = {
      all: filtered.length,
      pending: 0,
      approved: 0,
      alternative_offered: 0,
      rejected: 0,
      cancelled: 0,
    }
    for (const row of filtered) counts[row.status] = (counts[row.status] ?? 0) + 1
    return counts
  }, [filtered])

  const visible = useMemo(
    () => (status === 'all' ? filtered : filtered.filter((row) => row.status === status)),
    [filtered, status],
  )

  const hasFilters =
    query.trim() !== '' || status !== 'all' || tier !== 'all' || day !== 'all' || roomFilter !== 'all'

  const clearFilters = useCallback(() => {
    setQuery('')
    setStatus('all')
    setTier('all')
    setDay('all')
    setSelectedId(null)
    const next = new URLSearchParams(params)
    next.delete('room')
    setParams(next, { replace: true })
  }, [params, setParams])

  if (!user) return null

  if (official.loading && !official.dataset && !official.error) {
    return <PageSkeleton label="Loading the venue board…" variant="table" cards={4} rows={8} />
  }

  if (official.error && !official.health) {
    return (
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Venue requests</h2>
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

  if (!board) {
    return (
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Venue requests</h2>
        <div className="mt-4">
          <EmptyState
            icon={CalendarCheck2}
            title="No official bookings board yet"
            description="This board is built from the official dataset and the solver's decisions. Generate the schedule to fill it."
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

  const weekRows = visible.filter((row) => row.granted !== null)
  const cards = statusCardsFromCounts(scopedCounts)
  const pendingInScope = adhoc.filter((item) => item.status === 'pending' && !item.mine).length

  return (
    <div className="cit-page">
      {/* Title row */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">
            Venue requests
          </h2>
          <p className="mt-1 max-w-[52ch] text-[14px] leading-relaxed text-slate-600">
            {findingLine(scopedCounts)}
            {board.festWeek ? ` · ${board.festWeek}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/official"
            className="hidden h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          >
            Official report
          </Link>
          <Link
            to={isApprover ? '/approvals' : '/manual'}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950"
          >
            {isApprover ? 'Open approvals' : manualLabel}
            {isApprover && pendingInScope > 0 ? (
              <span className="rounded-full bg-white/20 px-1.5 text-[12px] tabular-nums">
                {pendingInScope}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      {/* Ad-hoc queue: the requests that live outside the solver board */}
      {adhoc.length > 0 ? (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3">
            <h3 className="text-[15px] font-semibold text-slate-900">Requests outside the board</h3>
            <p className="text-[12px] text-slate-500">
              {adhoc.filter((item) => item.mine).length} of yours ·{' '}
              {adhoc.filter((item) => !item.mine).length} from others
            </p>
          </div>
          <ul className="cit-stagger divide-y divide-slate-100">
            {adhoc.map((item) => (
              <li key={`${item.id}-${item.status}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{item.label}</p>
                  <p className="truncate text-[12px] text-slate-500">
                    <span className="tabular-nums">{item.id}</span> · {item.detail}
                    {item.reason ? ` · ${item.reason}` : ''}
                  </p>
                </div>
                <StatusPill status={asStatus(item.status)} className="shrink-0" />
              </li>
            ))}
          </ul>
          {isApprover ? (
            <div className="border-t border-slate-100 px-4 py-2">
              <Link
                to="/approvals"
                className="text-[12px] font-medium text-slate-700 transition-colors hover:text-slate-900"
              >
                Decide these in the approvals inbox
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Status count cards: the answer, and the filter */}
      <div className="mt-5">
        <BookingStatusCards cards={cards} selected={status} onSelect={setStatus} />
      </div>

      {/* Scope row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Request, ID, club or venue"
            aria-label="Search requests"
            className={controlClass('w-full pl-8 pr-8 placeholder:text-slate-400')}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        <select
          value={roomFilter}
          onChange={(event) => setRoomFilter(event.target.value)}
          aria-label="Filter by venue"
          className={controlClass()}
        >
          <option value="all">All venues</option>
          {board.rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>

        <select
          value={day}
          onChange={(event) => setDay(event.target.value as 'all' | Day)}
          aria-label="Filter by day"
          className={controlClass()}
        >
          <option value="all">All days</option>
          {DAYS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          value={tier}
          onChange={(event) => setTier(event.target.value)}
          aria-label="Filter by priority tier"
          className={controlClass()}
        >
          {TIER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        ) : null}

        <p className="ml-auto shrink-0 text-[12px] tabular-nums text-slate-500">
          {visible.length} of {board.rows.length} shown
        </p>
      </div>

      {/* The fest week */}
      <div className="mt-4">
        {weekRows.length > 0 ? (
          <FestWeekBoard
            rows={weekRows}
            semester={official.dataset?.semester ?? null}
            selectedId={selectedId}
            onSelect={selectRow}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6">
            <p className="text-[13px] text-slate-500">
              Nothing in this view holds a venue, so the week has no slots to draw.
            </p>
          </div>
        )}
      </div>

      {/* The ledger */}
      <div className="mt-4">
        <RequestLedger
          rows={visible}
          selectedId={selectedId}
          onSelect={selectRow}
          onClearFilters={clearFilters}
        />
      </div>

      {/* Footer: where the numbers come from */}
      <footer className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-slate-500">
            {official.dataset?.dataset_id ?? 'official dataset'} ·{' '}
            {official.dataset?.institute ?? 'Chilika Institute of Technology'} ·{' '}
            {board.hardViolations === null
              ? 'validator not run'
              : `${board.hardViolations} hard violation${board.hardViolations === 1 ? '' : 's'}`}
          </p>
          {board.largestRoom ? (
            <p className="mt-0.5 text-[12px] text-slate-500">
              Largest venue is {board.largestRoom.name}, seating {board.largestRoom.capacity}.
              {board.rows.some((row) => row.oversized)
                ? ` One request asked for more people than that.`
                : ''}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-slate-500">Ranked</span>
          {board.policyOrder.map((category) => (
            <span
              key={category}
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
            >
              {categoryLabel(category)}
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}
