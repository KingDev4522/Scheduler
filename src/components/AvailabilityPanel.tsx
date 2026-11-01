import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { OccupancyCheck } from '../lib/api'
import { formatDate } from '../lib/semester'

const TONE = {
  free: {
    wrap: 'border-emerald-200 bg-emerald-50',
    text: 'text-emerald-900',
    icon: CheckCircle2,
    label: 'Free',
  },
  warning: {
    wrap: 'border-amber-300 bg-amber-50',
    text: 'text-amber-900',
    icon: AlertTriangle,
    label: 'Warning',
  },
  blocked: {
    wrap: 'border-rose-300 bg-rose-50',
    text: 'text-rose-900',
    icon: AlertTriangle,
    label: 'Blocked',
  },
} as const

export function AvailabilityPanel({
  checks,
  loading,
  hint = 'Pick dates and a room to see what is already booked at that slot.',
}: {
  checks: OccupancyCheck[] | null
  loading: boolean
  hint?: string
}) {
  if (loading && !checks) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Checking what is already booked…
      </div>
    )
  }
  if (!checks || checks.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {hint}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {checks.map((check) => {
        const tone = TONE[check.severity]
        const Icon = tone.icon
        return (
          <div key={check.date} className={`rounded-lg border px-3 py-2 ${tone.wrap}`}>
            <p className={`flex flex-wrap items-center gap-1.5 text-xs font-semibold ${tone.text}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {tone.label} · {formatDate(check.date)}
              {check.week ? ` · Week ${check.week}` : ''}
              {check.room_name ? ` · ${check.room_name}` : ''}
              {check.capacity ? ` · ${check.capacity} seats` : ''}
            </p>
            <p className={`mt-0.5 text-xs leading-relaxed ${tone.text}`}>{check.message}</p>

            {check.entries.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {check.entries.map((entry, index) => (
                  <li
                    key={`${entry.kind}-${entry.source_id ?? index}-${entry.title}`}
                    className="rounded border border-white/70 bg-white/70 px-2 py-1 text-[11px] text-slate-700"
                  >
                    <span
                      className={`mr-1.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                        entry.severity === 'blocked'
                          ? 'bg-rose-200 text-rose-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {entry.kind}
                    </span>
                    <span className="font-semibold">{entry.title}</span>
                    {entry.detail ? ` — ${entry.detail}` : ''}
                    {entry.status ? ` · ${entry.status.replace(/_/g, ' ')}` : ''}
                  </li>
                ))}
              </ul>
            )}

            {check.candidates && check.candidates.length > 0 && (
              <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {check.candidates.map((candidate) => (
                  <li
                    key={candidate.room_id}
                    className="rounded border border-white/70 bg-white/70 px-2 py-1 text-[11px] text-slate-700"
                  >
                    <span className="font-semibold">{candidate.room_name}</span>
                    {candidate.capacity ? ` · ${candidate.capacity} seats` : ''}
                    {' · '}
                    <span
                      className={
                        candidate.severity === 'free'
                          ? 'text-emerald-700'
                          : candidate.severity === 'warning'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                      }
                    >
                      {candidate.severity}
                    </span>
                    {candidate.severity !== 'free' ? ` — ${candidate.message}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
