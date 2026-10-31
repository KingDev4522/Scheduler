import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Lock, XCircle } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, StatusNotice } from '../components/States'
import { DecisionDialog, type Decision } from '../components/DecisionDialog'
import { useAuth } from '../lib/auth'
import { decideBooking, decideProposal, getData, type AppData } from '../lib/store'
import { pendingDecisions, type PendingDecision } from '../lib/selectors'

type Tab = 'pending' | 'history'
type KindFilter = 'all' | 'booking' | 'change'

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
  const [data, setData] = useState<AppData>(getData)
  const [tab, setTab] = useState<Tab>('pending')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [target, setTarget] = useState<PendingDecision | null>(null)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const pending = useMemo(
    () => (user ? pendingDecisions(data, user) : []),
    [data, user],
  )

  const history = useMemo(() => {
    const items: {
      kind: 'booking' | 'change'
      id: string
      title: string
      requester: string
      decidedBy?: string
      at: number
      label: string
      reason: string
    }[] = []

    for (const booking of data.bookings) {
      if (booking.status === 'pending' || booking.status === 'cancelled') continue
      items.push({
        kind: 'booking',
        id: booking.id,
        title: booking.title,
        requester: booking.requester,
        decidedBy: booking.decidedBy,
        at: booking.decidedAt ?? booking.updatedAt,
        label:
          booking.status === 'approved'
            ? 'Approved'
            : booking.status === 'rejected'
              ? 'Rejected'
              : 'Alternative offered',
        reason: booking.decisionReason ?? booking.note,
      })
    }

    for (const proposal of data.proposals) {
      if (proposal.status === 'pending') continue
      items.push({
        kind: 'change',
        id: proposal.id,
        title: proposal.title,
        requester: proposal.requester,
        decidedBy: proposal.decidedBy,
        at: proposal.decidedAt ?? proposal.submittedAt,
        label: proposal.status === 'approved' ? 'Approved' : 'Rejected',
        reason: `${proposal.detail} · ${proposal.movedCount} session(s) moved`,
      })
    }

    return items.sort((a, b) => b.at - a.at)
  }, [data])

  if (!user) return null

  const filteredPending = pending.filter(
    (item) => kindFilter === 'all' || item.kind === kindFilter,
  )
  const filteredHistory = history.filter(
    (item) => kindFilter === 'all' || item.kind === kindFilter,
  )

  const submitDecision = (decision: Decision, reason: string) => {
    if (!target) return
    const result =
      target.kind === 'booking'
        ? decideBooking(target.id, decision, user, reason)
        : decideProposal(target.id, decision, user, reason)

    if (!result.ok) {
      setFlash({ tone: 'error', message: result.error })
      setTarget(null)
      return
    }
    setData({ ...result.data })
    setFlash({
      tone: 'success',
      message: `${target.id} ${decision === 'approved' ? 'approved' : 'rejected'}. The decision and reason are audited.`,
    })
    setTarget(null)
  }

  return (
    <div>
      <PageHeader
        title="Approvals inbox"
        subtitle="Every pending booking decision and change proposal in one queue, with the requester, conflicts, reason and full audit trail."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setTab('pending')}
            aria-pressed={tab === 'pending'}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'pending' ? 'bg-white text-neutral-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending ({pending.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            aria-pressed={tab === 'history'}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'history' ? 'bg-white text-neutral-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
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
          <option value="change">Change proposals</option>
        </select>

        <span className="text-xs text-slate-500">
          {user.role === 'admin'
            ? 'Admin decides every item; your own requests stay locked.'
            : 'Your scope covers department lab requests; Admin decides the rest.'}
        </span>
      </div>

      {tab === 'pending' ? (
        filteredPending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Inbox is clear"
            description="No pending requests match this filter. New submissions appear here automatically."
          />
        ) : (
          <ul className="space-y-3">
            {filteredPending.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {item.kind === 'booking' ? 'Booking' : 'Change'}
                      </span>
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.id} · requester{' '}
                      <span className="font-medium text-slate-700">{item.requester}</span> ·{' '}
                      {timeAgo(item.submittedAt)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                  </div>

                  {item.canDecide ? (
                    <button
                      type="button"
                      onClick={() => setTarget(item)}
                      className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
                    >
                      Decide
                    </button>
                  ) : (
                    <span className="inline-flex max-w-[16rem] shrink-0 items-start gap-1 text-[11px] leading-snug text-slate-400">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {item.blockedReason}
                    </span>
                  )}
                </div>                  {item.conflicts.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {item.conflicts.map((conflict) => (
                      <li
                        key={conflict}
                        className="rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-800"
                      >
                        ⚠ {conflict}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      ) : filteredHistory.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No decisions recorded yet"
          description="Approved and rejected items appear here with their actor and reason."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
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
                      {item.id} · requester {item.requester}
                      {item.decidedBy ? ` · decided by ${item.decidedBy}` : ''} · {timeAgo(item.at)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.reason}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      item.label === 'Approved'
                        ? 'bg-neutral-100 text-neutral-800'
                        : item.label === 'Rejected'
                          ? 'bg-neutral-100 text-neutral-800'
                          : 'bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    {item.label === 'Approved' ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    ) : (
                      <XCircle className="h-3 w-3" aria-hidden />
                    )}
                    {item.label}
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
        conflicts={target?.conflicts ?? []}
        onClose={() => setTarget(null)}
        onSubmit={submitDecision}
      />
    </div>
  )
}
