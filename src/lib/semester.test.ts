import { describe, expect, it } from 'vitest'
import {
  dateToWeek,
  isSelectable,
  monthMatrix,
  resolveWindow,
  weekdayShort,
  weekDates,
  weekLabel,
  type Semester,
} from './semester'

const weeks = [
  { number: 1, monday: '2026-12-21', friday: '2026-12-25', phase: 'teaching' as const },
  { number: 2, monday: '2026-12-28', friday: '2027-01-01', phase: 'teaching' as const },
  { number: 3, monday: '2027-01-04', friday: '2027-01-08', phase: 'teaching' as const },
  { number: 4, monday: '2027-01-11', friday: '2027-01-15', phase: 'teaching' as const },
  { number: 5, monday: '2027-01-18', friday: '2027-01-22', phase: 'teaching' as const },
  { number: 6, monday: '2027-01-25', friday: '2027-01-29', phase: 'teaching' as const },
  { number: 7, monday: '2027-02-01', friday: '2027-02-05', phase: 'spectra' as const },
  { number: 8, monday: '2027-02-08', friday: '2027-02-12', phase: 'exams' as const },
]

const semester: Semester = {
  fest_week: 7,
  exam_week: 8,
  anchor_date: '2027-02-01',
  semester_start: '2026-12-21',
  semester_end: '2027-02-12',
  weeks,
  assumption: 'derived',
}

describe('semester date maths', () => {
  it('maps a date to its week', () => {
    expect(dateToWeek(semester, '2027-02-03')?.number).toBe(7)
    expect(dateToWeek(semester, '2026-12-24')?.number).toBe(1)
    expect(dateToWeek(semester, '2027-02-09')?.number).toBe(8)
    expect(dateToWeek(semester, '2027-05-01')).toBeNull()
  })

  it('derives the weekday', () => {
    expect(weekdayShort('2027-02-01')).toBe('MON')
    expect(weekdayShort('2027-02-05')).toBe('FRI')
    expect(weekdayShort('2027-02-06')).toBe('SAT')
  })

  it('lists the teaching dates of a week', () => {
    expect(weekDates(semester, 7)).toEqual([
      '2027-02-01',
      '2027-02-02',
      '2027-02-03',
      '2027-02-04',
      '2027-02-05',
    ])
  })

  it('only allows upcoming weekdays in bookable weeks', () => {
    expect(isSelectable(semester, '2027-02-02', '2027-01-15')).toBe(true)
    expect(isSelectable(semester, '2026-11-01', '2027-01-15')).toBe(false) // not in semester
    expect(isSelectable(semester, '2027-02-02', '2027-03-01')).toBe(false) // past
    expect(isSelectable(semester, '2027-02-06', '2027-01-15')).toBe(false) // weekend
    expect(isSelectable(semester, '2027-02-09', '2027-01-15')).toBe(false) // exam week
  })

  it('builds a Monday-first month grid', () => {
    const grid = monthMatrix(2027, 1) // February 2027
    expect(grid).toHaveLength(6)
    expect(grid[0]).toHaveLength(7)
    expect(grid[0][0]).toBe('2027-02-01')
  })

  it('labels a week with dates and phase', () => {
    expect(weekLabel(semester, 7)).toContain('Week 7')
    expect(weekLabel(semester, 7)).toContain('Spectra')
  })
})

describe('clock to period conversion', () => {
  it('converts an afternoon window', () => {
    expect(resolveWindow('14:00', '16:00')).toMatchObject({
      from_period: 6,
      to_period: 7,
      duration: 2,
    })
  })

  it('converts a single morning period', () => {
    expect(resolveWindow('12:00', '13:00')).toMatchObject({ from_period: 5, to_period: 5, duration: 1 })
  })

  it('rejects a lunch-crossing window', () => {
    expect(resolveWindow('12:00', '14:00').error).toMatch(/lunch/i)
  })

  it('rejects a reversed window', () => {
    expect(resolveWindow('16:00', '14:00').error).toMatch(/after/i)
  })

  it('rejects off-grid times', () => {
    expect(resolveWindow('08:30', '10:00').error).toBeTruthy()
  })

  it('converts an evening event window', () => {
    expect(resolveWindow('18:00', '20:00')).toMatchObject({ from_period: 10, to_period: 11, duration: 2 })
  })
})
