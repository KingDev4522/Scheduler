import { cn } from '../lib/utils'

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

/** P1–P13 with the 13:00 lunch break drawn as a real gap between P5 and P6. */
const TRACKS = 'repeat(5, minmax(0, 1fr)) 6px repeat(8, minmax(0, 1fr))'

function columnOf(period: number): number {
  return period <= 5 ? period : period + 1
}

export type TapeTone = 'granted' | 'alternative' | 'asked' | 'refused'

const FILL: Record<TapeTone, string> = {
  granted: 'bg-emerald-500',
  alternative: 'bg-amber-500',
  asked: 'border border-dashed border-slate-300 bg-slate-50',
  refused: 'bg-rose-400',
}

const LABELS: { period: number; text: string }[] = [
  { period: 1, text: 'P1' },
  { period: 5, text: 'P5' },
  { period: 6, text: 'P6' },
  { period: 9, text: 'P9' },
  { period: 13, text: 'P13' },
]

export function PeriodTape({
  from,
  to,
  tone,
  labelled = false,
  label,
}: {
  from: number
  to: number
  tone: TapeTone
  labelled?: boolean
  label?: string
}) {
  return (
    <div>
      {label ? <p className="mb-1 text-[12px] text-slate-500">{label}</p> : null}
      <div
        className="grid gap-y-0"
        style={{ gridTemplateColumns: TRACKS }}
        role="img"
        aria-label={`Periods ${from} to ${to} on the campus grid`}
      >
        {PERIODS.map((period) => {
          const on = period >= from && period <= to
          return (
            <div
              key={period}
              style={{ gridColumn: columnOf(period) }}
              className={cn('h-2.5 rounded-[2px]', on ? FILL[tone] : 'bg-slate-100')}
            />
          )
        })}
      </div>
      {labelled ? (
        <div className="mt-1 grid" style={{ gridTemplateColumns: TRACKS }} aria-hidden>
          {LABELS.map((item) => (
            <span
              key={item.period}
              style={{ gridColumn: columnOf(item.period) }}
              className="text-center text-[11px] tabular-nums text-slate-400"
            >
              {item.text}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
