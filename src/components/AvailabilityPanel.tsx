import { cn } from '../lib/utils'
import type { OccupancyCheck } from '../lib/api'
import { formatDate } from '../lib/semester'

const TONE = {
  free: { ink: 'text-emerald-800', label: 'Free' },
  warning: { ink: 'text-amber-900', label: 'Tight' },
  blocked: { ink: 'text-rose-800', label: 'Blocked' },
} as const

export function AvailabilityPanel({
  checks,
  loading,
  hint = 'Pick dates and a room to see what already holds that slot.',
}: {
  checks: OccupancyCheck[] | null
  loading: boolean
  hint?: string
}) {
  if (loading && !checks) {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <span className="sr-only">Checking what already holds this slot.</span>
        <div className="cit-skeleton h-3 w-40" />
        <div className="cit-skeleton h-3 w-full" />
        <div className="cit-skeleton h-3 w-2/3" />
      </div>
    )
  }

  if (!checks || checks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
        {hint}
      </p>
    )
  }

  return (
    <ul className="space-y-2.5">
      {checks.map((check) => {
        const tone = TONE[check.severity]
        return (
          <li key={check.date} className="rounded-lg border border-slate-200 px-3 py-2.5">
            <p className="text-[13px] text-slate-800">
              <span className={cn('font-semibold', tone.ink)}>{tone.label}</span>
              {' · '}
              {formatDate(check.date)}
              {check.week ? ` · Week ${check.week}` : ''}
              {check.room_name ? ` · ${check.room_name}` : ''}
              {check.capacity ? ` · ${check.capacity} seats` : ''}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{check.message}</p>

            {check.entries.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {check.entries.map((entry, index) => (
                  <li
                    key={`${entry.kind}-${entry.source_id ?? index}-${entry.title}`}
                    className="text-[12px] leading-relaxed text-slate-600"
                  >
                    <span
                      className={cn(
                        'font-medium',
                        entry.severity === 'blocked' ? 'text-rose-700' : 'text-amber-800',
                      )}
                    >
                      {entry.kind.replace(/_/g, ' ')}
                    </span>
                    {' · '}
                    <span className="text-slate-800">{entry.title}</span>
                    {entry.detail ? <span className="text-slate-500"> · {entry.detail}</span> : null}
                    {entry.status ? (
                      <span className="text-slate-500"> · {entry.status.replace(/_/g, ' ')}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {check.candidates && check.candidates.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {check.candidates.map((candidate) => (
                  <li key={candidate.room_id} className="text-[12px] leading-relaxed text-slate-600">
                    <span className="text-slate-800">{candidate.room_name}</span>
                    {candidate.capacity ? (
                      <span className="text-slate-500"> · {candidate.capacity} seats</span>
                    ) : null}
                    <span className={cn('font-medium', TONE[candidate.severity].ink)}>
                      {' · '}
                      {TONE[candidate.severity].label}
                    </span>
                    {candidate.severity !== 'free' ? (
                      <span className="text-slate-500"> · {candidate.message}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
