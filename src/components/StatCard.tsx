import type { LucideIcon } from 'lucide-react'

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'amber' | 'emerald' | 'rose'
}) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-900',
    amber: 'bg-neutral-50 text-neutral-600',
    emerald: 'bg-neutral-50 text-neutral-600',
    rose: 'bg-neutral-50 text-neutral-600',
  } as const

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
          {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
        </div>
      </div>
    </div>
  )
}
