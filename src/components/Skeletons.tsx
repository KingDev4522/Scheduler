import { cn } from '../lib/utils'

export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn('cit-skeleton rounded-md', className)} />
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Bone className="h-10 w-10 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-3 w-24" />
              <Bone className="h-6 w-16" />
            </div>
          </div>
          <Bone className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="space-y-2">
          <Bone className="h-4 w-44" />
          <Bone className="h-3 w-64 max-w-full" />
        </div>
        <Bone className="h-6 w-28 rounded-full" />
      </div>

      <div className="hidden items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 sm:flex">
        <Bone className="h-3 w-14" />
        <Bone className="h-3 flex-1 max-w-[18rem]" />
        <Bone className="h-3 w-16" />
        <Bone className="h-3 w-20" />
        <Bone className="h-3 w-16" />
        <Bone className="h-3 w-24" />
      </div>

      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-5 py-4">
            <Bone className="h-4 w-14 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-full max-w-[22rem]" />
              <Bone className="h-3 w-2/3 max-w-[14rem]" />
            </div>
            <Bone className="hidden h-6 w-16 shrink-0 rounded-full sm:block" />
            <Bone className="h-6 w-20 shrink-0 rounded-full" />
            <Bone className="hidden h-4 w-24 shrink-0 lg:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="space-y-2">
          <Bone className="h-4 w-40" />
          <Bone className="h-3 w-56 max-w-full" />
        </div>
        <Bone className="h-6 w-24 rounded-full" />
      </div>

      <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] border-b border-slate-100 bg-slate-50/60">
        <div className="px-2 py-2">
          <Bone className="h-3 w-8" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="border-l border-slate-100 px-2 py-2">
            <Bone className="mx-auto h-3 w-8" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))]">
        <div className="space-y-5 p-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Bone key={index} className="h-3 w-9" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="relative h-72 border-l border-slate-100">
            <Bone className="absolute inset-x-1.5 top-4 h-12" />
            <Bone className="absolute inset-x-1.5 top-28 h-16" />
            <Bone className="absolute inset-x-1.5 top-56 h-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <Bone className="h-4 w-40" />
        <Bone className="mt-2 h-3 w-56 max-w-full" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-start gap-3 px-5 py-4">
            <Bone className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-2/3" />
              <Bone className="h-3 w-1/2" />
            </div>
            <Bone className="h-6 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Bone className="h-4 w-48" />
        <Bone className="mt-2 h-3 w-72 max-w-full" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Bone key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <Bone className="mt-4 h-20 w-full rounded-lg" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Bone className="h-9 w-32 rounded-lg" />
          <Bone className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Bone className="h-4 w-36" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: rows }, (_, index) => (
            <Bone key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function PageSkeleton({
  label = 'Loading…',
  variant = 'split',
  cards = 0,
  rows = 6,
}: {
  label?: string
  variant?: 'split' | 'table' | 'calendar' | 'form' | 'list' | 'dashboard'
  cards?: number
  rows?: number
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="cit-page">
      <span className="sr-only">{label}</span>

      <div className="mb-5 space-y-2">
        <Bone className="h-6 w-64 max-w-[70%]" />
        <Bone className="h-4 w-full max-w-xl" />
      </div>

      {cards > 0 && <CardsSkeleton count={cards} />}

      <div className={cards > 0 ? 'mt-5' : undefined}>
        {variant === 'table' && <TableSkeleton rows={rows} />}
        {variant === 'calendar' && <CalendarSkeleton />}
        {variant === 'form' && <FormSkeleton rows={Math.min(rows, 5)} />}
        {variant === 'list' && <ListSkeleton rows={rows} />}
        {variant === 'split' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ListSkeleton rows={rows} />
            </div>
            <div className="space-y-5">
              <ListSkeleton rows={3} />
              <ListSkeleton rows={3} />
            </div>
          </div>
        )}
        {variant === 'dashboard' && (
          <>
            <CalendarSkeleton />
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ListSkeleton rows={4} />
              </div>
              <div className="space-y-5">
                <ListSkeleton rows={3} />
                <ListSkeleton rows={3} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
