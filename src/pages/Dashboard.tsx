import { useMemo, useState } from 'react'
import {
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  AlertTriangle,
  Lock,
  XCircle,
} from 'lucide-react'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import {
  decideBooking,
  decideProposal,
  getData,
  type AppData,
} from '../lib/store'
import {
  dashboardStats,
  derivedConflicts,
  pendingDecisions,
  roomUtilisation,
  type PendingDecision,
} from '../lib/selectors'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { EmptyState, StatusNotice } from '../components/States'
import { DecisionDialog, type Decision } from '../components/DecisionDialog'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<AppData>(getData)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [target, setTarget] = useState<PendingDecision | null>(null)

  const stats = useMemo(() => (user ? dashboardStats(data, user) : null), [data, user])
  const queue = useMemo(() => (user ? pendingDecisions(data, user) : []), [data, user])
  const conflicts = useMemo(() => derivedConflicts(data), [data])
  const utilisation = useMemo(() => roomUtilisation(data), [data])

  if (!user || !stats) return null

  const isAdmin = user.role === 'admin'
  const isEventManager = user.role === 'event_manager'

  const cards = isAdmin
    ? [
        { icon: ClipboardCheck, label: 'Pending decisions', value: stats.pendingDecisions, hint: `${stats.actionableDecisions} you can decide`, tone: 'amber' as const },
        { icon: CalendarCheck2, label: 'Spectra requests', value: stats.spectraActive, hint: `${stats.spectraPending} pending`, tone: 'neutral' as const },
        { icon: AlertTriangle, label: 'Open conflicts', value: stats.conflicts, hint: 'recomputed from current data', tone: 'rose' as const },
        { icon: Building2, label: 'Avg room utilisation', value: `${stats.averageUtilisation}%`, hint: `${data.rooms.length} rooms · demo sessions`, tone: 'emerald' as const },
      ]
    : user.role === 'department_coordinator'
      ? [
          { icon: ClipboardCheck, label: 'Pending decisions', value: stats.pendingDecisions, hint: `${stats.actionableDecisions} in your scope`, tone: 'amber' as const },
          { icon: CalendarCheck2, label: 'Spectra requests', value: stats.spectraActive, hint: `${stats.spectraPending} pending`, tone: 'neutral' as const },
          { icon: AlertTriangle, label: 'Open conflicts', value: stats.conflicts, hint: 'recomputed from current data', tone: 'rose' as const },
          { icon: Building2, label: 'Avg room utilisation', value: `${stats.averageUtilisation}%`, hint: `${data.rooms.length} rooms · demo sessions`, tone: 'emerald' as const },
        ]
      : [
          { icon: CalendarCheck2, label: 'My requests', value: stats.myRequests, hint: 'submitted by you', tone: 'neutral' as const },
          { icon: CheckCircle2, label: 'Approved', value: stats.myApproved, hint: 'venue confirmed', tone: 'emerald' as const },
          { icon: XCircle, label: 'Rejected / alternative', value: stats.myRejected, hint: 'needs your review', tone: 'rose' as const },
          { icon: Clock3, label: 'In review', value: stats.myPending, hint: 'decision pending', tone: 'amber' as const },
        ]

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
      message: `${target.id} ${decision === 'approved' ? 'approved' : 'rejected'}. The reason is recorded in the audit log.`,
    })
    setTarget(null)
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.displayName}`}
        subtitle={`${ROLE_LABEL[user.role]}${
          user.department ? ` · ${user.department} department` : ''
        } · demo data stored locally`}
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Decision queue */}
        <section className="lg:col-span-2">
          <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {isEventManager ? 'Your pending requests' : 'Pending decisions'}
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                {isEventManager
                  ? 'Approvers decide these'
                  : `${stats.actionableDecisions} actionable by you`}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {queue.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState
                    icon={CheckCircle2}
                    title="Nothing waiting"
                    description="Every pending request has a decision. New requests appear here automatically."
                  />
                </div>
              ) : (
                queue.map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {item.kind === 'booking' ? 'Booking' : 'Change'}
                          </span>
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.id} · from <span className="font-medium">{item.requester}</span> ·{' '}
                          {timeAgo(item.submittedAt)}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                        {item.conflicts.length > 0 && (
                          <p className="mt-1 text-xs leading-relaxed text-neutral-700">
                            ⚠ {item.conflicts.join('; ')}
                          </p>
                        )}
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
                        <span className="inline-flex max-w-[15rem] shrink-0 items-start gap-1 text-[11px] leading-snug text-slate-400">
                          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                          {item.blockedReason}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Right column: utilisation + conflicts */}
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Room utilisation</h3>
            <p className="text-xs text-slate-400">Derived from demo sessions + approved bookings</p>
            <ul className="mt-4 space-y-3">
              {[...utilisation]
                .sort((a, b) => b.percent - a.percent)
                .slice(0, 5)
                .map((row) => (
                  <li key={row.room.id}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-slate-700">{row.room.name}</span>
                      <span className="text-slate-400">{row.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-neutral-500"
                        style={{ width: `${Math.max(row.percent, 1)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {row.occupiedPeriods} of {row.capacityPeriods} weekly periods
                    </p>
                  </li>
                ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Open conflicts</h3>
            <p className="text-xs text-slate-400">Deterministic checks, recomputed on load</p>
            <ul className="mt-3 space-y-3">
              {conflicts.length === 0 ? (
                <li className="text-sm text-slate-400">No conflicts — schedule is clean.</li>
              ) : (
                conflicts.slice(0, 5).map((conflict) => (
                  <li
                    key={conflict.id}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
                  >
                    <p className="text-xs font-semibold text-neutral-800">
                      <span className="mr-1.5 rounded bg-neutral-200 px-1 py-0.5 text-[10px]">
                        {conflict.code}
                      </span>
                      {conflict.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                      {conflict.detail}
                    </p>
                  </li>
                ))
              )}
            </ul>
            {conflicts.length > 5 && (
              <p className="mt-2 text-[11px] text-slate-400">
                +{conflicts.length - 5} more — open the timetable or bookings board for the rest.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Activity feed */}
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Recent actions</h3>
        <ul className="mt-3 space-y-2.5">
          {data.audit.slice(0, 6).map((event) => (
            <li key={event.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
              <span className="min-w-0 flex-1 text-slate-700">{event.action}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {event.actor} · {timeAgo(event.at)}
              </span>
            </li>
          ))}
        </ul>
      </section>

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
