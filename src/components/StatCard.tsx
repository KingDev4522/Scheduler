import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)
  const previous = useRef(0)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      previous.current = value
      return
    }

    const from = previous.current
    const start = performance.now()
    const duration = 720
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (value - from) * eased)
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        previous.current = value
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduce])

  const rounded = Number.isInteger(value) ? Math.round(display) : display.toFixed(1)
  return (
    <>
      {rounded}
      {suffix}
    </>
  )
}

function splitValue(value: string | number): { numeric: number | null; suffix: string } {
  if (typeof value === 'number') return { numeric: value, suffix: '' }
  const match = value.match(/^(-?\d+(?:\.\d+)?)(.*)$/)
  if (!match) return { numeric: null, suffix: value }
  return { numeric: Number(match[1]), suffix: match[2] }
}

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

  const { numeric, suffix } = splitValue(value)

  return (
    <div className="cit-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">
            {numeric === null ? value : <CountUp value={numeric} suffix={suffix} />}
          </p>
          {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
        </div>
      </div>
    </div>
  )
}
