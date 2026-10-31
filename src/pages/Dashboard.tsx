import { useMemo, useState } from 'react'
import {
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { decideApproval, getData, type AppData } from '../lib/store'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'

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
  const [flash, setFlash] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin'

  const stats = useMemo(() => {
    const pendingApprovals = data.approvals.filter((a) => a.status === 'pending')
    const spectra = data.bookings.filter((b) => b.status !== 'cancelled')
    const myRequests = data.bookings.filter((b) => b.requester === user?.username)
    const avgUtil = Math.round(
      data.rooms.reduce((sum, r) => sum + r.utilisation, 0) / Math.max(data.rooms.length, 1),
    )
    return { pendingApprovals, spectra, myRequests, avgUtil }
  }, [data, user])

  const decision = (id: string, result: 'approved' | 'rejected') => {
    if (!user) return
    const next = decideApproval(id, result, user.username)
    setData({ ...next })
    const item = next.approvals.find((a) => a.id === id)
    setFlash(
      `${result === 'approved' ? 'Approved' : 'Rejected'} ${item?.id ?? id} — "${
        item?.title ?? ''
      }". Decision recorded in the audit log.`,
    )
    window.setTimeout(() => setFlash(null), 6000)
  }

  if (!user) return null

  const cards =
    user.role === 'admin'
      ? [
          { icon: ClipboardCheck, label: 'Pending approvals', value: stats.pendingApprovals.length, hint: 'awaiting your decision', tone: 'amber' as const },
          { icon: CalendarCheck2, label: 'Spectra requests', value: stats.spectra.length, hint: `${stats.spectra.filter((b) => b.status === 'pending').length} pending`, tone: 'indigo' as const },
          { icon: AlertTriangle, label: 'Open conflicts', value: data.conflicts.length, hint: 'from last validation run', tone: 'rose' as const },
          { icon: Building2, label: 'Avg room utilisation', value: `${stats.avgUtil}%`, hint: `${data.rooms.length} rooms`, tone: 'emerald' as const },
        ]
      : user.role === 'department_coordinator'
        ? [
            { icon: ClipboardCheck, label: 'Pending approvals', value: stats.pendingApprovals.length, hint: 'routed to you / admin', tone: 'amber' as const },
            { icon: CalendarCheck2, label: 'My requests', value: stats.myRequests.length, hint: `${stats.myRequests.filter((b) => b.status === 'pending').length} pending`, tone: 'indigo' as const },
            { icon: AlertTriangle, label: 'Open conflicts', value: data.conflicts.length, hint: 'department-related', tone: 'rose' as const },
            { icon: Building2, label: 'Avg room utilisation', value: `${stats.avgUtil}%`, hint: `${data.rooms.length} rooms`, tone: 'emerald' as const },
          ]
        : [
            { icon: CalendarCheck2, label: 'My requests', value: stats.myRequests.length, hint: 'submitted by you', tone: 'indigo' as const },
            {
              icon: CheckCircle2,
              label: 'Approved',
              value: stats.myRequests.filter((b) => b.status === 'approved').length,
              hint: 'venue confirmed',
              tone: 'emerald' as const,
            },
            {
              icon: XCircle,
              label: 'Rejected / alternative',
              value: stats.myRequests.filter((b) => b.status === 'rejected' || b.status === 'alternative_offered').length,
              hint: 'needs your review',
              tone: 'rose' as const,
            },
            {
              icon: Clock3,
              label: 'In review',
              value: stats.myRequests.filter((b) => b.status === 'pending').length,
              hint: 'decision pending',
              tone: 'amber' as const,
            },
          ]

  const visibleApprovals =
    user.role === 'event_manager' ? [] : data.approvals

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.displayName}`}
        subtitle={`${ROLE_LABEL[user.role]}${
          user.department ? ` · ${user.department} department` : ''
        } · demo data stored locally`}
      />

      {flash && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {flash}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Approvals */}
        <section className="lg:col-span-2">
          <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {user.role === 'event_manager' ? 'Recent activity' : 'Pending approvals'}
              </h3>
              {!isAdmin && user.role !== 'event_manager' && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                  Decisions are Admin-only
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {user.role === 'event_manager' ? (
                data.audit.slice(0, 6).map((event) => (
                  <div key={event.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700">{event.action}</p>
                      <p className="text-xs text-slate-400">
                        {event.actor} · {timeAgo(event.at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : visibleApprovals.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">
                  Nothing waiting — approvals inbox is clear.
                </p>
              ) : (
                visibleApprovals.map((approval) => (
                  <div key={approval.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{approval.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {approval.id} · from <span className="font-medium">{approval.requester}</span> ·{' '}
                          {approval.route} · {timeAgo(approval.submittedAt)}
                        </p>
                      </div>
                      {approval.status === 'pending' ? (
                        isAdmin ? (
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => decision(approval.id, 'approved')}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => decision(approval.id, 'rejected')}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            Pending
                          </span>
                        )
                      ) : (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            approval.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {approval.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      )}
                      <p className="w-full text-xs leading-relaxed text-slate-500">
                        {approval.detail}
                        {approval.conflicts.length > 0 && (
                          <span className="mt-1 block text-rose-600">
                            ⚠ Conflict: {approval.conflicts.join('; ')}
                          </span>
                        )}
                      </p>
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
            <p className="text-xs text-slate-400">Top rooms, demo values</p>
            <ul className="mt-4 space-y-3">
              {[...data.rooms]
                .sort((a, b) => b.utilisation - a.utilisation)
                .slice(0, 5)
                .map((room) => (
                  <li key={room.id}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-slate-700">{room.name}</span>
                      <span className="text-slate-400">{room.utilisation}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          room.utilisation >= 80
                            ? 'bg-rose-400'
                            : room.utilisation >= 60
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                        }`}
                        style={{ width: `${room.utilisation}%` }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Open conflicts</h3>
            <ul className="mt-3 space-y-3">
              {data.conflicts.length === 0 ? (
                <li className="text-sm text-slate-400">No conflicts — schedule is clean.</li>
              ) : (
                data.conflicts.map((conflict) => (
                  <li
                    key={conflict.id}
                    className="rounded-lg border border-rose-100 bg-rose-50/70 p-3"
                  >
                    <p className="text-xs font-semibold text-rose-700">{conflict.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-rose-600/90">
                      {conflict.detail}
                    </p>
                  </li>
                ))
              )}
            </ul>
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
    </div>
  )
}
