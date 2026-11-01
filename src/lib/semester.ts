/**
 * Derived semester calendar (UI layer).
 *
 * The official dataset has no dates, so the backend derives week 1–8 from the
 * dataset's Spectra-week timestamp and sends it as `semester`. This module only
 * does deterministic date/period maths on top of it — no fabricated schedules.
 */

import { PERIOD_TIMES } from './time'

export type WeekPhase = 'teaching' | 'spectra' | 'exams'

export interface SemesterWeek {
  number: number
  monday: string
  friday: string
  phase: WeekPhase
}

export interface Semester {
  fest_week: number
  exam_week: number
  anchor_date: string
  semester_start: string
  semester_end: string | null
  weeks: SemesterWeek[]
  assumption: string
}

export const WEEKDAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

const DAY_MS = 86_400_000

export function parseIso(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

export function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return isoOf(new Date(parseIso(iso).getTime() + days * DAY_MS))
}

export function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return isoOf(local)
}

export function weekdayShort(iso: string): (typeof WEEKDAY_SHORT)[number] {
  return WEEKDAY_SHORT[(parseIso(iso).getUTCDay() + 6) % 7]
}

export function isWeekend(iso: string): boolean {
  const day = parseIso(iso).getUTCDay()
  return day === 0 || day === 6
}

/** Weekday used by the dataset windows (MON–FRI); null for weekends. */
export function datasetDay(iso: string): string | null {
  return isWeekend(iso) ? null : weekdayShort(iso)
}

export function dateToWeek(semester: Semester | null, iso: string): SemesterWeek | null {
  if (!semester) return null
  const target = parseIso(iso).getTime()
  for (const week of semester.weeks) {
    const start = parseIso(week.monday).getTime()
    if (target >= start && target < start + 7 * DAY_MS) return week
  }
  return null
}

export function weekDates(semester: Semester, number: number, includeWeekend = false): string[] {
  const week = semester.weeks.find((item) => item.number === number)
  if (!week) return []
  const length = includeWeekend ? 7 : 5
  return Array.from({ length }, (_, index) => addDays(week.monday, index))
}

export function phaseLabel(phase: WeekPhase): string {
  return phase === 'spectra' ? 'Spectra' : phase === 'exams' ? 'Midsem exams' : 'Teaching'
}

/** A date can be booked when it is a weekday inside a bookable (non-exam) week, not in the past. */
export function isSelectable(semester: Semester | null, iso: string, today = todayIso()): boolean {
  if (!semester || iso < today || isWeekend(iso)) return false
  const week = dateToWeek(semester, iso)
  return week !== null && week.phase !== 'exams'
}

/** Monday-first month grid (6 rows × 7 days) of ISO dates. */
export function monthMatrix(year: number, monthIndex: number): string[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const offset = (first.getUTCDay() + 6) % 7 // days since Monday
  const start = new Date(first.getTime() - offset * DAY_MS)
  return Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => isoOf(new Date(start.getTime() + (row * 7 + col) * DAY_MS))),
  )
}

/** Calendar months spanned by the semester (start → end), oldest first. */
export function semesterMonths(semester: Semester): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = []
  const start = parseIso(semester.semester_start)
  const end = parseIso(semester.semester_end ?? semester.weeks[semester.weeks.length - 1]?.friday ?? semester.semester_start)
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  while (cursor.getTime() <= last.getTime()) {
    out.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return out
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDate(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatShortDate(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function weekLabel(semester: Semester, number: number): string {
  const week = semester.weeks.find((item) => item.number === number)
  if (!week) return `Week ${number}`
  return `Week ${number} · ${formatShortDate(week.monday)} – ${formatShortDate(week.friday)} · ${phaseLabel(week.phase)}`
}

// -- clock <-> period -------------------------------------------------------

export function timeFromPeriod(period: number): string {
  return PERIOD_TIMES[period]?.start ?? ''
}

/** The period that starts exactly at `time` (e.g. 14:00 -> P6). */
export function periodStartingAt(time: string): number | null {
  for (const [key, value] of Object.entries(PERIOD_TIMES)) {
    if (value.start === time) return Number(key)
  }
  return null
}

/** The period that ends exactly at `time` (e.g. 10:00 -> P2, 13:00 -> P5). */
export function periodEndingAt(time: string): number | null {
  for (const [key, value] of Object.entries(PERIOD_TIMES)) {
    if (value.end === time) return Number(key)
  }
  return null
}

/** Valid start boundaries: 08:00–12:00 (P1–P5) and 14:00–21:00 (P6–P13). */
export function startTimeOptions(): string[] {
  return Object.values(PERIOD_TIMES)
    .map((value) => value.start)
    .sort()
}

/** Valid end boundaries: 09:00–13:00 and 15:00–22:00 (lunch 14:00 is not an end). */
export function endTimeOptions(): string[] {
  return Object.values(PERIOD_TIMES)
    .map((value) => value.end)
    .sort()
}

export interface ResolvedWindow {
  from_period: number
  to_period: number
  duration: number
  error?: string
}

export function resolveWindow(fromTime: string, toTime: string): ResolvedWindow {
  if (!fromTime || !toTime) {
    return { from_period: 0, to_period: 0, duration: 0, error: 'Choose a start and end time.' }
  }
  if (toTime <= fromTime) {
    return { from_period: 0, to_period: 0, duration: 0, error: 'End time must be after the start time.' }
  }
  // Lunch (13:00–14:00) is not a slot: no window may overlap it.
  if (fromTime < '14:00' && toTime > '13:00') {
    return {
      from_period: 0,
      to_period: 0,
      duration: 0,
      error: 'This window crosses lunch (13:00–14:00). Use a morning and an afternoon window instead.',
    }
  }
  const from = periodStartingAt(fromTime)
  const to = periodEndingAt(toTime)
  if (from === null || to === null) {
    return { from_period: 0, to_period: 0, duration: 0, error: 'Use times on the hour, from 08:00 to 22:00.' }
  }
  return { from_period: from, to_period: to, duration: to - from + 1 }
}

export function describeWindow(fromTime: string, toTime: string): string {
  const resolved = resolveWindow(fromTime, toTime)
  if (resolved.error) return resolved.error
  return `P${resolved.from_period}–P${resolved.to_period} · ${resolved.duration} period${resolved.duration === 1 ? '' : 's'} · ${fromTime}–${toTime}`
}
