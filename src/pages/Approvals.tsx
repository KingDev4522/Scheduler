import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, Lock, XCircle } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, StatusNotice } from '../components/States'
import { DecisionDialog, type Decision } from '../components/DecisionDialog'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import { api, type BookingSubmission, type ChangeRequestRecord } from '../lib/api'
import { canCoordinatorDecideRoom } from '../lib/departments'

type Tab = 'pending' | 'history'
type KindFilter = 'all' | 'booking' | 'change'

interface QueueItem {
  kind: 'booking' | 'change'
  id: string
  title: string
  requester: string
  detail: string
  /** Why the requester asked; distinct from the decision reason. */
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
  const [tab, setTab] = useState<Tab>('pending')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
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
        detail: `${roomId || 'no room'} · ${submission.day ?? '—'} P${submission.start_period ?? '—'}–P${submission.end_period ?? '—'} · ${submission.attendance ?? '—'} expected${
          requestReason ? ` · requester reason: ${requestReason}` : ''
        }`,
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
      // PS: Admin approves timetable changes; coordinators request them.
      const canDecide = !self && user.role === 'admin'
      const requestReason = String(
        change.request_reason ??
          (change.draft as Record<string, unknown>)?.request_reason ??
          '',
      ).trim()
      out.push({
        kind: 'change',
        id: change.id,
        title: change.text,
        requester: change.requester,
        detail: `${String(change.draft.kind ?? 'change')} · ${sessionId || 'no session'} · ${change.follow_up?.length ? `${change.follow_up.length} clarification(s)` : 'draft ready'}${
          requestReason ? ` · requester reason: ${requestReason}` : ''
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
  }, [submissions, changes, user, official.dataset])

  if (!user) return null

  // Admin sees everyone; a coordinator only sees their own plus the department
  // lab bookings they are allowed to decide, and the decisions they made.
  const scoped = items.filter((item) => {
    if (user.role === 'admin') return true
    if (user.role !== 'department_coordinator') return false
    if (item.requester === user.username) return true
    if (item.kind === 'booking' && item.canDecide) return true
    return String((item.raw as { decided_by?: string | null }).decided_by ?? '') === user.username
  })

  const pending = scoped.filter((item) => item.status === 'pending')
  const history = scoped.filter((item) => item.status !== 'pending')
  const filteredPending = pending.filter((item) => kindFilter === 'all' || item.kind === kindFilter)
  const filteredHistory = history.filter((item) => kindFilter === 'all' || item.kind === kindFilter)

  const submitDecision = async (decision: Decision, reason: string) => {
    if (!target) return
    try {
      if (target.kind === 'booking') {
        await api.decideBookingSubmission(target.id, decision, reason, user.username)
      } else {
        await api.decideChangeRequest(target.id, decision, reason, user.username)
      }
      setFlash({
        tone: 'success',
        message: `${target.id} ${decision === 'approved' ? 'approved' : 'rejected'} and recorded.`,
      })
      setTarget(null)
      await Promise.all([load(), official.refresh()])
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Decision failed.',
      })
      setTarget(null)
    }
  }

  return (
    <div className="cit-page">
      <PageHeader
        title="Approvals inbox"
        subtitle="Official disruption proposals, ad-hoc bookings and faculty change requests. Every decision is authorized by the backend."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}

      {official.schedule?.proposal_status === 'pending' && official.schedule.diff && (
        <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Official disruption proposal</h3>
          <p className="mt-1 text-xs text-amber-800">
            {official.schedule.diff.moved_count} session(s) moved ·{' '}
            {official.schedule.diff.room_only_changed} room-only ·{' '}
            {official.schedule.diff.time_changed} time change · hard violations{' '}
            {official.schedule.after_summary?.hard_violation_count ?? '—'}
          </p>
          {user.role === 'admin' ? (
            <div className="mt-3 flex gap-2">
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
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve proposal
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
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-50"
              >
                Reject proposal
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-800">Admin approval is required before it applies.</p>
          )}
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setTab('pending')}
            aria-pressed={tab === 'pending'}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === 'pending' ? 'bg-white text-neutral-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            Pending ({pending.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            aria-pressed={tab === 'history'}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === 'history' ? 'bg-white text-neutral-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            History ({history.length})
          </button>
        </div>

        <label htmlFor="approval-kind" className="text-xs font-medium text-slate-600">
          Type
        </label>
        <select
          id="approval-kind"
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value as KindFilter)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800"
        >
          <option value="all">All items</option>
          <option value="booking">Bookings</option>
          <option value="change">Change requests</option>
        </select>

        <span className="text-xs text-slate-500">
          {user.role === 'admin'
            ? 'Admin decides every item; your own requests stay locked.'
            : 'You decide your department’s lab bookings; Admin decides timetable changes and everything else.'}
        </span>
        <Link to="/official" className="ml-auto text-xs font-semibold text-neutral-900 hover:underline">
          Official report →
        </Link>
      </div>

      {loading ? (
        <EmptyState icon={ClipboardCheck} title="Loading approvals…" description="Reading the official queue." />
      ) : tab === 'pending' ? (
        filteredPending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Inbox is clear"
            description="No pending official items match this filter."
          />
        ) : (
          <ul className="cit-stagger space-y-3">
            {filteredPending.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {item.kind === 'booking' ? 'Booking' : 'Change'}
                      </span>
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.id} · requester <span className="font-medium text-slate-700">{item.requester}</span> · {timeAgo(item.at)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                    {item.requestReason && (
                      <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                        <span className="font-semibold">Request reason:</span> {item.requestReason}
                      </p>
                    )}
                  </div>
                  {item.canDecide ? (
                    <button
                      type="button"
                      onClick={() => setTarget(item)}
                      className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                    >
                      Decide
                    </button>
                  ) : (
                    <span className="inline-flex max-w-[16rem] shrink-0 items-start gap-1 text-[11px] leading-snug text-slate-400">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {item.blockedReason}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : filteredHistory.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No decisions recorded yet" description="Approved and rejected items appear here." />
      ) : (
        <div className="cit-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="cit-stagger divide-y divide-slate-100">
            {filteredHistory.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {item.kind === 'booking' ? 'Booking' : 'Change'}
                      </span>
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.id} · requester {item.requester} · {timeAgo(item.at)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                    {item.requestReason && (
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-semibold">Request reason:</span> {item.requestReason}
                      </p>
                    )}
                    {String((item.raw as { reason?: unknown }).reason ?? '').trim() && (
                      <p className="mt-0.5 text-xs text-slate-600">
                        <span className="font-semibold">Decision reason:</span>{' '}
                        {String((item.raw as { reason?: unknown }).reason)}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-800">
                    {item.status === 'approved' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {item.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DecisionDialog
        open={target !== null}
        title={target ? `${target.id} — ${target.title}` : ''}
        detail={target?.detail}
        conflicts={[]}
        onClose={() => setTarget(null)}
        onSubmit={(decision, reason) => void submitDecision(decision, reason)}
      />
    </div>
  )
}
