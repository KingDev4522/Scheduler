import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export const fieldInput =
  'h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 transition-colors placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950'

export const fieldTextarea = cn(fieldInput, 'h-auto py-2 leading-relaxed')

export function FormSection({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h4 className="text-[13px] font-semibold text-slate-900">{title}</h4>
        {hint ? <p className="text-[12px] text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[12px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-md border px-2 text-[12px] transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950',
        active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
      )}
    >
      {children}
    </button>
  )
}
