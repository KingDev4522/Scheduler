/**
 * Campus time model.
 *
 * Source of truth: docs/03_SCHEDULING_SOLVER_PRD.md §"Scope".
 * Monday–Friday. P1–P9 are academic; lunch sits between P5 and P6; P10–P13
 * (18:00–22:00) are event-only. A three-hour lab may only start at P2 or P6.
 */

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
export type Day = (typeof DAYS)[number]

export interface PeriodTime {
  period: number
  start: string
  end: string
}

/** Academic periods P1–P9. */
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type AcademicPeriod = (typeof PERIODS)[number]

/** Event-only periods P10–P13. */
export const EVENT_PERIODS = [10, 11, 12, 13] as const

export const PERIOD_TIMES: Record<number, PeriodTime> = {
  1: { period: 1, start: '08:00', end: '09:00' },
  2: { period: 2, start: '09:00', end: '10:00' },
  3: { period: 3, start: '10:00', end: '11:00' },
  4: { period: 4, start: '11:00', end: '12:00' },
  5: { period: 5, start: '12:00', end: '13:00' },
  6: { period: 6, start: '14:00', end: '15:00' },
  7: { period: 7, start: '15:00', end: '16:00' },
  8: { period: 8, start: '16:00', end: '17:00' },
  9: { period: 9, start: '17:00', end: '18:00' },
  10: { period: 10, start: '18:00', end: '19:00' },
  11: { period: 11, start: '19:00', end: '20:00' },
  12: { period: 12, start: '20:00', end: '21:00' },
  13: { period: 13, start: '21:00', end: '22:00' },
}

export const LUNCH_AFTER_PERIOD = 5
export const LUNCH_TIME = { start: '13:00', end: '14:00' } as const
export const LAST_ACADEMIC_PERIOD = 9
export const LAST_PERIOD = 13
export const LONG_SESSION_PERIODS = 3
export const LONG_SESSION_START_PERIODS = [2, 6] as const

export function isDay(value: string): value is Day {
  return (DAYS as readonly string[]).includes(value)
}

export function dayIndex(day: Day): number {
  return DAYS.indexOf(day)
}

/** All periods a session starting at `startPeriod` occupies. */
export function occupiedPeriods(startPeriod: number, periods: number): number[] {
  if (periods <= 0) return []
  return Array.from({ length: periods }, (_, i) => startPeriod + i)
}

/** True when the window covers part of P5 and part of P6 (hard constraint H09). */
export function spansLunch(startPeriod: number, periods: number): boolean {
  if (periods <= 0) return false
  return startPeriod <= LUNCH_AFTER_PERIOD && startPeriod + periods - 1 > LUNCH_AFTER_PERIOD
}

/** Two half-open period windows overlap? */
export function periodsOverlap(
  aStart: number,
  aPeriods: number,
  bStart: number,
  bPeriods: number,
): boolean {
  if (aPeriods <= 0 || bPeriods <= 0) return false
  const aEnd = aStart + aPeriods - 1
  const bEnd = bStart + bPeriods - 1
  return aStart <= bEnd && bStart <= aEnd
}

export function periodLabel(period: number): string {
  return `P${period}`
}

export function periodRangeLabel(startPeriod: number, periods: number): string {
  if (periods <= 1) return periodLabel(startPeriod)
  return `P${startPeriod}–P${startPeriod + periods - 1}`
}

export function timeRangeLabel(startPeriod: number, periods: number): string {
  const first = PERIOD_TIMES[startPeriod]
  const lastPeriod = startPeriod + Math.max(periods, 1) - 1
  const last = PERIOD_TIMES[lastPeriod]
  if (!first || !last) return ''
  return `${first.start}–${last.end}`
}

export interface WindowValidation {
  ok: boolean
  code?: 'OUT_OF_RANGE' | 'CROSSES_LUNCH' | 'BAD_LAB_START'
  message?: string
}

/** Validate a period window against the academic grid (H09 + restricted lab starts). */
export function validateAcademicWindow(startPeriod: number, periods: number): WindowValidation {
  if (
    !Number.isInteger(startPeriod) ||
    !Number.isInteger(periods) ||
    periods < 1 ||
    startPeriod < 1 ||
    startPeriod + periods - 1 > LAST_ACADEMIC_PERIOD
  ) {
    return {
      ok: false,
      code: 'OUT_OF_RANGE',
      message: `A ${periods}-period session starting at P${startPeriod} falls outside P1–P9.`,
    }
  }
  if (spansLunch(startPeriod, periods)) {
    return {
      ok: false,
      code: 'CROSSES_LUNCH',
      message: `P${startPeriod}–P${startPeriod + periods - 1} crosses the 13:00–14:00 lunch break.`,
    }
  }
  if (
    periods === LONG_SESSION_PERIODS &&
    !(LONG_SESSION_START_PERIODS as readonly number[]).includes(startPeriod)
  ) {
    return {
      ok: false,
      code: 'BAD_LAB_START',
      message: `Three-hour labs may only start at P2 or P6 (requested P${startPeriod}).`,
    }
  }
  return { ok: true }
}

/** Map an academic or event period to its grid row (header is row 1, lunch is row 7). */
export function periodGridRow(period: number): number {
  if (period <= LUNCH_AFTER_PERIOD) return period + 1
  if (period <= LAST_ACADEMIC_PERIOD) return period + 2
  return period + 2
}

export function compareWindows(
  aStart: number,
  aPeriods: number,
  bStart: number,
  bPeriods: number,
): number {
  if (aStart !== bStart) return aStart - bStart
  return bPeriods - aPeriods
}
