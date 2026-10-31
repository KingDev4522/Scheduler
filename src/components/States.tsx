import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-10 text-center"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-200 text-neutral-700">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-neutral-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-neutral-600">{description}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </button>
      )}
    </div>
  )
}

/** Skeleton used while localStorage-backed data hydrates. */
export function LoadingState({
  label = 'Loading data…',
  rows = 3,
}: {
  label?: string
  rows?: number
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-700" aria-hidden />
        {label}
      </p>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="h-12 w-full animate-pulse rounded-lg border border-slate-100 bg-slate-100/70"
          />
        ))}
      </div>
    </div>
  )
}

/** Inline, dismissible outcome notice used after a write. */
export function StatusNotice({
  tone,
  children,
}: {
  tone: 'success' | 'error'
  children: ReactNode
}) {
  const styles =
    tone === 'success'
      ? 'border-neutral-200 bg-neutral-50 text-neutral-800'
      : 'border-neutral-200 bg-neutral-50 text-neutral-800'
  return (
    <div role="status" className={`mb-4 rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  )
}
