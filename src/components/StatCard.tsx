import type { LucideIcon } from 'lucide-react'

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'indigo',
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  tone?: 'indigo' | 'amber' | 'emerald' | 'rose'
}) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
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
