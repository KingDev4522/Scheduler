import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import { api, type BookingSubmission, type ChangeRequestRecord } from '../lib/api'
import { canCoordinatorDecideRoom } from '../lib/departments'
import { toBookingStatus } from '../lib/bookingBoard'
import { SOFT_EASE } from '../lib/motion'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { EmptyState, StatusNotice } from '../components/States'
import { DecisionDialog, type Decision } from '../components/DecisionDialog'
import { StatusPill } from '../components/BookingStatus'
import { BookingStatusCards, statusCardsFromCounts, type StatusFilter } from '../components/BookingStatusCards'

interface QueueItem {
  kind: 'booking' | 'change'
  id: string
  title: string
  requester: string
  detail: string
  requestReason?: string
  at: number
  status: string
  canDecide: boolean
  blockedReason?: string
  raw: BookingSubmission | ChangeRequestRecord
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Approvals() {
  const { user } = useAuth()
  const official = useOfficial()
  const [submissions, setSubmissions] = useState<BookingSubmission[]>([])
  const [changes, setChanges] = useState<ChangeRequestRecord[]>([])
  const [kindFilter, setKindFilter] = useState<'all' | 'booking' | 'change'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [target, setTarget] = useState<QueueItem | null>(null)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [bookingResponse, changeResponse] = await Promise.all([
        api.listBookings(user.username),
        api.changeRequests(user.username),
      ])
      setSubmissions(bookingResponse.items)
      setChanges(changeResponse.items)
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not load approvals.',
      })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo<QueueItem[]>(() => {
    if (!user) return []
    const out: QueueItem[] = []
    for (const submission of submissions) {
      const roomId = String(submission.room_id ?? submission.requested_room ?? '')
      const self = String(submission.requester ?? '').toLowerCase() === user.username.toLowerCase()
      const canDecide =
        !self &&
        (user.role === 'admin' ||
          (user.role === 'department_coordinator' && canCoordinatorDecideRoom(user, roomId)))
      const requestReason = String(submission.request_reason ?? '').trim()
      out.push({
        kind: 'booking',
        id: submission.id,
        title: String(submission.title ?? submission.id),
        requester: String(submission.requester ?? 'unknown'),
        detail: `${roomId || 'no room'} · ${submission.day ?? '–'} P${submission.start_period ?? '–'}–P${submission.end_period ?? '–'} · ${submission.attendance ?? '–'} expected`,
        requestReason,
        at: new Date(submission.submitted_at ?? Date.now()).getTime(),
        status: submission.status,
        canDecide,
        blockedReason: self
          ? 'You cannot decide your own request.'
          : user.role === 'admin'
            ? undefined
            : 'Only the owning department coordinator may decide this venue.',
        raw: submission,
      })
    }
    for (const change of changes) {
      const sessionId = String((change.draft as Record<string, unknown>)?.session_id ?? '')
      const self = change.requester.toLowerCase() === user.username.toLowerCase()
      const canDecide = !self && user.role === 'admin'
      const requestReason = String(
        change.request_reason ?? (change.draft as Record<string, unknown>)?.request_reason ?? '',
      ).trim()
      out.push({
        kind: 'change',
        id: change.id,
        title: change.text,
        requester: change.requester,
        detail: `${String(change.draft.kind ?? 'change').replace(/_/g, ' ')} · ${sessionId || 'no session'} · ${
          change.follow_up?.length ? `${change.follow_up.length} clarification(s)` : 'draft ready'
        }`,
        requestReason,
        at: new Date(change.submitted_at).getTime(),
        status: change.status,
        canDecide,
        blockedReason: self
          ? 'You cannot decide your own request.'
          : 'Timetable changes are decided by Admin only.',
        raw: change,
      })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [submissions, changes, user])

  const scoped = useMemo(() => {
    if (!user) return []
    return items.filter((item) => {
      if (user.role === 'admin') return true
      if (user.role !== 'department_coordinator') return false
      if (item.requester === user.username) return true
      if (item.kind === 'booking' && item.canDecide) return true
      return String((item.raw as { decided_by?: string | null }).decided_by ?? '') === user.username
    })
  }, [items, user])

  const counts = useMemo(() => {
    const next = {
      all: scoped.length,
      pending: 0,
      approved: 0,
      alternative_offered: 0,
      rejected: 0,
      cancelled: 0,
    }
    for (const item of scoped) {
      const status = toBookingStatus(item.status)
      next[status] = (next[status] ?? 0) + 1
    }
    return next
  }, [scoped])

  const visible = useMemo(() => {
    const status = statusFilter === 'all' ? null : statusFilter
    return scoped.filter((item) => {
      if (status && toBookingStatus(item.status) !== status) return false
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false
      return true
    })
  }, [scoped, statusFilter, kindFilter])

  const submitDecision = async (decision: Decision, reason: string) => {
    if (!target) return
    const item = target
    setTarget(null)
    try {
      if (item.kind === 'booking') {
        await api.decideBookingSubmission(item.id, decision, reason, user!.username)
      } else {
        await api.decideChangeRequest(item.id, decision, reason, user!.username)
      }
      setFlash({
        tone: 'success',
        message: `${item.id} ${decision === 'approved' ? 'approved' : 'rejected'} and recorded.`,
      })
      await Promise.all([load(), official.refresh()])
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Decision failed.',
      })
    }
  }

  if (!user) return null

  const cards = statusCardsFromCounts(counts)
  const proposal = official.schedule?.proposal_status === 'pending' ? official.schedule : null

  return (
    <div className="cit-page">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Approvals</h2>
          <p className="mt-1 max-w-[56ch] text-[14px] leading-relaxed text-slate-600">
            {counts.pending} waiting on a decision · {counts.approved} approved · {counts.rejected}{' '}
            refused
            {proposal ? ' · 1 official disruption proposal' : ''}
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
            to="/changes"
            className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Build a change
          </Link>
        </div>
      </header>

      {flash ? (
        <div className="mt-4">
          <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>
        </div>
      ) : null}

      {proposal && proposal.diff ? (
        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-amber-900">
                Official disruption proposal
              </h3>
              <p className="mt-0.5 text-[12px] text-amber-800">
                {proposal.diff.moved_count} session(s) moved · {proposal.diff.room_only_changed}{' '}
                room-only · {proposal.diff.time_changed} time change · hard violations{' '}
                {proposal.after_summary?.hard_violation_count ?? '–'}
              </p>
            </div>
            {user.role === 'admin' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await official.approveProposal()
                    setFlash(
                      ok
                        ? { tone: 'success', message: 'Official proposal approved and applied.' }
                        : { tone: 'error', message: official.error ?? 'Approval failed.' },
                    )
                  }}
                  disabled={official.busy}
                  className="h-8 rounded-lg bg-neutral-900 px-3 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await official.rejectProposal()
                    setFlash(
                      ok
                        ? { tone: 'success', message: 'Official proposal rejected.' }
                        : { tone: 'error', message: official.error ?? 'Rejection failed.' },
                    )
                  }}
                  disabled={official.busy}
                  className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-[12px] font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ) : (
              <p className="text-[12px] text-amber-800">Admin approval is required before it applies.</p>
            )}
          </div>
        </section>
      ) : null}

      <div className="mt-5">
        <BookingStatusCards cards={cards} selected={statusFilter} onSelect={setStatusFilter} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value as 'all' | 'booking' | 'change')}
          aria-label="Filter by request type"
          className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 transition-colors hover:border-slate-400 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-300"
        >
          <option value="all">Everything</option>
          <option value="booking">Venue requests</option>
          <option value="change">Session changes</option>
        </select>
        <p className="text-[12px] tabular-nums text-slate-500">
          {visible.length} of {scoped.length} shown
        </p>
        <p className="ml-auto hidden text-[12px] text-slate-500 sm:block">
          {user.role === 'admin'
            ? 'Admin decides every item; your own requests stay locked.'
            : 'You decide your department’s lab bookings; Admin decides the rest.'}
        </p>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="cit-skeleton h-4 w-40" />
            <div className="mt-3 space-y-2">
              <div className="cit-skeleton h-3 w-full" />
              <div className="cit-skeleton h-3 w-2/3" />
            </div>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={statusFilter === 'pending' ? 'Inbox is clear' : 'Nothing in this view'}
            description="No official items match these filters. Try another status or request type."
          />
        ) : (
          <ul className="cit-stagger divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {visible.map((item) => (
              <motion.li
                key={`${item.kind}-${item.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: SOFT_EASE }}
                className="px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      <span className="tabular-nums">{item.id}</span>
                      {' · '}
                      {item.requester}
                      {' · '}
                      {timeAgo(item.at)}
                      {' · '}
                      {item.kind === 'booking' ? 'venue request' : 'session change'}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{item.detail}</p>
                    {item.requestReason ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-700">
                        {item.requestReason}
                      </p>
                    ) : null}
                    {String((item.raw as { reason?: unknown }).reason ?? '').trim() ? (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                        Decision: {String((item.raw as { reason?: unknown }).reason)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusPill status={toBookingStatus(item.status)} />
                    {toBookingStatus(item.status) === 'pending' ? (
                      item.canDecide ? (
                        <button
                          type="button"
                          onClick={() => setTarget(item)}
                          className="h-8 rounded-lg bg-neutral-900 px-3 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950"
                        >
                          Decide
                        </button>
                      ) : (
                        <span className={cn('max-w-[14rem] text-right text-[12px] leading-snug text-slate-400')}>
                          {item.blockedReason}
                        </span>
                      )
                    ) : null}
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <DecisionDialog
        open={target !== null}
        title={target ? `${target.id} · ${target.title}` : ''}
        detail={target?.detail}
        conflicts={[]}
        onClose={() => setTarget(null)}
        onSubmit={(decision, reason) => void submitDecision(decision, reason)}
      />
    </div>
  )
}
