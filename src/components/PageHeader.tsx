import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Construction } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { findNav } from '../lib/nav'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  const location = useLocation()
  // The sticky header already shows the route's name — only repeat it when the
  // page has a more specific title of its own (e.g. "Help & demo accounts").
  const showTitle = title !== findNav(location.pathname)?.label

  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {showTitle && <h2 className="text-xl font-semibold text-slate-900">{title}</h2>}
        {subtitle && (
          <p className={`max-w-3xl text-base font-medium text-black ${showTitle ? 'mt-1' : ''}`}>
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  )
}

/** Consistent placeholder for modules that arrive in the next milestone. */
export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  features,
}: {
  icon: LucideIcon
  title: string
  description: string
  features: string[]
}) {
  return (
    <div>
      <PageHeader title={title} subtitle="Module scaffolded — implementation in progress" />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 md:p-8">          <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
          <Construction className="h-3.5 w-3.5" aria-hidden />
          Coming next
        </p>
        <div className="mt-4 flex items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-slate-600">{description}</p>
            <ul className="mt-4 space-y-2">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
