import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import type { BoardRow } from '../lib/bookingBoard'
import { formatSlot, formatSlotTime, TIER_LABEL } from '../lib/bookingBoard'
import { SOFT_EASE } from '../lib/motion'
import { cn } from '../lib/utils'
import { StatusPill } from './BookingStatus'
import { PeriodTape } from './PeriodTape'

/**
 * Types the solver's reason out one character at a time. Under reduced motion,
 * or once the reveal is over, the full sentence is simply there.
 */
function useTypewriter(text: string, active: boolean, delay = 240, speed = 13) {
  const reduce = useReducedMotion()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!active) {
      setCount(0)
      return
    }
    if (reduce || !text) {
      setCount(text.length)
      return
    }
    setCount(0)
    let index = 0
    let interval = 0
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 1
        setCount(index)
        if (index >= text.length) window.clearInterval(interval)
      }, speed)
    }, delay)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(interval)
    }
  }, [text, active, reduce, delay, speed])

  return { shown: text.slice(0, count), typing: count < text.length }
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-slate-500">{label}</dt>
      <dd className="truncate text-[13px] text-slate-800">{value}</dd>
    </div>
  )
}

export function BookingDetailDialog({
  row,
  onClose,
}: {
  row: BoardRow | null
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const reason = row?.reason ?? ''
  const { shown, typing } = useTypewriter(reason, row !== null)

  useEffect(() => {
    if (!row) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [row, onClose])

  const asked = row?.windows[0] ?? null
  const capacity = row?.roomCapacity ?? null
  const ratio = capacity && capacity > 0 ? row!.attendance / capacity : 0
  const over = Boolean(capacity && row && row.attendance > capacity)
  const unmatched =
    row?.roomFeatures && row.needs.length
      ? row.needs.filter(
          (need) => !row.roomFeatures.some((feature) => feature.toLowerCase() === need.toLowerCase()),
        )
      : []

  return (
    <AnimatePresence>
      {row ? (
        <motion.div
          key="booking-detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: SOFT_EASE }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-detail-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 28, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ duration: 0.34, ease: SOFT_EASE }}
            className="max-h-[88svh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white outline-none sm:rounded-2xl"
          >
            {/* Head */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={row.status} />
                  <span className="text-[12px] tabular-nums text-slate-500">{row.id}</span>
                </div>
                <h3
                  id="booking-detail-title"
                  className="mt-2 text-[19px] font-semibold leading-tight tracking-[-0.01em] text-slate-900"
                >
                  {row.title}
                </h3>
                <p className="mt-1 text-[13px] text-slate-600">
                  {row.requester} · {row.categoryLabel} · {TIER_LABEL[row.tier]} tier
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close request details"
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-300"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              {/* Asked against granted */}
              <section aria-label="Slot comparison" className="space-y-3">
                {asked ? (
                  <div>
                    <PeriodTape
                      from={asked.from}
                      to={asked.to}
                      tone="asked"
                      label={`Asked for ${formatSlot(asked)}${
                        row.windows.length > 1 ? ` (and ${row.windows.length - 1} more window${row.windows.length > 2 ? 's' : ''})` : ''
                      }`}
                    />
                  </div>
                ) : null}

                {row.granted ? (
                  <div>
                    <PeriodTape
                      from={row.granted.from}
                      to={row.granted.to}
                      tone={row.moved ? 'alternative' : 'granted'}
                      labelled
                      label={`Given ${formatSlot(row.granted)} · ${formatSlotTime(row.granted)}`}
                    />
                  </div>
                ) : (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">
                    No venue holds this request. Nothing is drawn on the week.
                  </p>
                )}

                {row.moved && asked ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                    Placed outside every window this request asked for.
                  </p>
                ) : null}
              </section>

              {/* Room and headcount */}
              <section aria-label="Venue and headcount">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <MetaRow label="Venue" value={row.roomName ?? 'None assigned'} />
                  <MetaRow label="Building" value={row.roomBuilding ?? 'Not recorded'} />
                  <MetaRow
                    label="Expected"
                    value={`${row.attendance.toLocaleString('en-GB')}${
                      capacity ? ` of ${capacity.toLocaleString('en-GB')}` : ''
                    }`}
                  />
                </dl>

                {capacity ? (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        initial={{ width: reduce ? `${Math.min(1, ratio) * 100}%` : 0 }}
                        animate={{ width: `${Math.min(1, ratio) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.15, ease: SOFT_EASE }}
                        className={cn('h-full rounded-full', over ? 'bg-rose-500' : 'bg-emerald-500')}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-slate-500">
                      {over
                        ? `Over capacity by ${(row.attendance - capacity).toLocaleString('en-GB')} seats.`
                        : `${Math.round(ratio * 100)}% of the seats in ${row.roomName}.`}
                    </p>
                  </div>
                ) : null}
              </section>

              {/* Facilities */}
              {row.needs.length > 0 ? (
                <section aria-label="Facilities requested">
                  <p className="text-[12px] text-slate-500">Facilities requested</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {row.needs.map((need) => {
                      const missing = unmatched.includes(need)
                      return (
                        <li
                          key={need}
                          className={cn(
                            'rounded border px-1.5 py-0.5 text-[12px]',
                            missing
                              ? 'border-amber-200 bg-amber-50 text-amber-900'
                              : 'border-slate-200 bg-slate-50 text-slate-700',
                          )}
                        >
                          {need.replace(/_/g, ' ')}
                          {missing ? ' · not in this room' : ''}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {/* The reason, typed out */}
              <section aria-label="The solver's reason">
                <p className="text-[12px] text-slate-500">The solver's reason</p>
                <p className="mt-1 text-[14px] leading-relaxed text-slate-800">
                  {shown}
                  {typing ? (
                    <motion.span
                      aria-hidden
                      animate={{ opacity: [1, 0.15, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-slate-500"
                    />
                  ) : null}
                </p>
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
