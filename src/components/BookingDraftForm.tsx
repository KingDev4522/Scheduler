import { useEffect, useState } from 'react'
import type { BookingDraft, BookingWindow, OccupancyCheck } from '../lib/api'
import { PERIOD_TIMES } from '../lib/time'
import type { Semester } from '../lib/semester'
import {
  dateToWeek,
  datasetDay,
  endTimeOptions,
  formatDate,
  resolveWindow,
  startTimeOptions,
  timeFromPeriod,
} from '../lib/semester'
import { cn } from '../lib/utils'
import { DatePickerCalendar } from './DatePickerCalendar'
import { AvailabilityPanel } from './AvailabilityPanel'
import { PeriodTape } from './PeriodTape'
import { Field, FormSection, ToggleChip, fieldInput, fieldTextarea } from './FormBits'

export interface BookingFormOptions {
  days: string[]
  roomTypes: string[]
  needs: string[]
  groups: string[]
  rooms: {
    id: string
    name: string
    capacity: number
    type: string
    accessible: boolean
    features: string[]
  }[]
  semester: Semester | null
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/** One dataset window per distinct weekday; the dataset has no week dimension. */
function buildWindows(dates: string[], fromPeriod: number, toPeriod: number): BookingWindow[] {
  const seen = new Set<string>()
  const out: BookingWindow[] = []
  for (const iso of dates) {
    const day = datasetDay(iso)
    if (!day) continue
    const key = `${day}:${fromPeriod}-${toPeriod}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ day, from_period: fromPeriod, to_period: toPeriod })
  }
  return out
}

export function BookingDraftForm({
  draft,
  onChange,
  options,
  showGroups = false,
  availability = null,
  availabilityLoading = false,
}: {
  draft: BookingDraft
  onChange: (draft: BookingDraft) => void
  options: BookingFormOptions
  /** Admin-only: keep selected student groups free (H13). */
  showGroups?: boolean
  /** Live occupancy for the selected dates/time/room. */
  availability?: OccupancyCheck[] | null
  availabilityLoading?: boolean
}) {
  const update = <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) =>
    onChange({ ...draft, [key]: value })

  const dates = draft.dates ?? []
  const firstWindow = draft.windows[0]
  const [startTime, setStartTime] = useState(timeFromPeriod(firstWindow?.from_period ?? 10))
  const [endTime, setEndTime] = useState(PERIOD_TIMES[firstWindow?.to_period ?? 11]?.end ?? '20:00')
  const [timeError, setTimeError] = useState<string | null>(null)

  useEffect(() => {
    const window = draft.windows[0]
    if (!window) return
    setStartTime(timeFromPeriod(window.from_period))
    setEndTime(PERIOD_TIMES[window.to_period]?.end ?? '')
    setTimeError(null)
  }, [draft.windows])

  const resolved = resolveWindow(startTime, endTime)
  const fromPeriod = resolved.error ? (firstWindow?.from_period ?? 10) : resolved.from_period
  const toPeriod = resolved.error ? (firstWindow?.to_period ?? 11) : resolved.to_period
  const selectedRoom = options.rooms.find((room) => room.id === draft.requested_room)
  const overCapacity =
    selectedRoom !== undefined && draft.attendance !== null && draft.attendance > selectedRoom.capacity
  const ratio =
    selectedRoom && selectedRoom.capacity > 0 && draft.attendance !== null
      ? draft.attendance / selectedRoom.capacity
      : 0

  const setDates = (next: string[]) => {
    onChange({
      ...draft,
      dates: next,
      windows: buildWindows(next, fromPeriod, toPeriod),
      duration_periods: toPeriod - fromPeriod + 1,
    })
  }

  const setTimes = (nextStart: string, nextEnd: string) => {
    setStartTime(nextStart)
    setEndTime(nextEnd)
    const result = resolveWindow(nextStart, nextEnd)
    setTimeError(result.error ?? null)
    if (result.error) return
    onChange({
      ...draft,
      windows: buildWindows(dates, result.from_period, result.to_period),
      duration_periods: result.duration,
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <FormSection title="The event" hint="What it is and how many people come.">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Title" htmlFor="booking-title" required>
              <input
                id="booking-title"
                value={draft.title}
                onChange={(event) => update('title', event.target.value)}
                placeholder="Spectra closing ceremony"
                className={fieldInput}
              />
            </Field>
            <Field label="Expected" htmlFor="booking-attendance">
              <input
                id="booking-attendance"
                type="number"
                min={1}
                value={draft.attendance ?? ''}
                onChange={(event) =>
                  update('attendance', event.target.value === '' ? null : Number(event.target.value))
                }
                className={cn(fieldInput, 'tabular-nums')}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="When" hint="One period is one hour.">
          <Field label="Date" htmlFor="booking-dates">
            <DatePickerCalendar semester={options.semester} dates={dates} onChange={setDates} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From" htmlFor="booking-start">
              <select
                id="booking-start"
                value={startTime}
                onChange={(event) => setTimes(event.target.value, endTime)}
                className={fieldInput}
              >
                {startTimeOptions().map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To" htmlFor="booking-end">
              <select
                id="booking-end"
                value={endTime}
                onChange={(event) => setTimes(startTime, event.target.value)}
                className={fieldInput}
              >
                {endTimeOptions().map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {resolved.error ? (
            <p className="text-[12px] text-rose-700">{resolved.error}</p>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <PeriodTape
                from={resolved.from_period}
                to={resolved.to_period}
                tone="granted"
                labelled
              />
              <p className="mt-2 text-[12px] tabular-nums text-slate-600">
                P{resolved.from_period}–P{resolved.to_period} · {resolved.duration} period
                {resolved.duration === 1 ? '' : 's'} · {startTime}–{endTime}
              </p>
            </div>
          )}
          {timeError ? <p className="text-[12px] text-rose-700">{timeError}</p> : null}

          {dates.length > 0 ? (
            <ul className="space-y-1">
              {dates.map((iso) => {
                const day = datasetDay(iso)
                const week = options.semester ? dateToWeek(options.semester, iso) : null
                return (
                  <li key={iso} className="text-[12px] text-slate-600">
                    <span className="text-slate-800">{formatDate(iso)}</span>
                    {week ? ` · Week ${week.number} (${week.phase})` : ''}
                    {day ? ` · ${day}` : ''} · P{fromPeriod}–P{toPeriod}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </FormSection>

        <FormSection title="Where" hint="Leave the room open and the solver picks for you.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-slate-700">Room types</p>
              <div className="flex flex-wrap gap-1.5">
                {options.roomTypes.map((type) => (
                  <ToggleChip
                    key={type}
                    active={draft.room_types.includes(type)}
                    onClick={() => update('room_types', toggle(draft.room_types, type))}
                  >
                    {type.replace(/_/g, ' ')}
                  </ToggleChip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-slate-700">Facilities</p>
              <div className="flex flex-wrap gap-1.5">
                {options.needs.map((need) => (
                  <ToggleChip
                    key={need}
                    active={draft.needs.includes(need)}
                    onClick={() => update('needs', toggle(draft.needs, need))}
                  >
                    {need.replace(/_/g, ' ')}
                  </ToggleChip>
                ))}
              </div>
            </div>
          </div>

          <Field label="Preferred room" htmlFor="booking-room" hint="Optional.">
            <select
              id="booking-room"
              value={draft.requested_room ?? ''}
              onChange={(event) => update('requested_room', event.target.value || null)}
              className={fieldInput}
            >
              <option value="">Any suitable room</option>
              {options.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.capacity} seats · {room.type}
                </option>
              ))}
            </select>
          </Field>

          {selectedRoom ? (
            <div className="rounded-lg border border-slate-200 px-3 py-2.5">
              <p className="text-[13px] text-slate-800">
                {selectedRoom.name}
                <span className="text-slate-500">
                  {' · '}
                  {selectedRoom.capacity} seats · {selectedRoom.type}
                  {selectedRoom.accessible ? ' · accessible' : ''}
                </span>
              </p>
              {draft.attendance !== null ? (
                <>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full', overCapacity ? 'bg-rose-500' : 'bg-emerald-500')}
                      style={{ width: `${Math.min(1, Math.abs(ratio)) * 100}%` }}
                    />
                  </div>
                  <p className={cn('mt-1.5 text-[12px]', overCapacity ? 'text-rose-700' : 'text-slate-500')}>
                    {overCapacity
                      ? `${draft.attendance} expected, ${draft.attendance - selectedRoom.capacity} over capacity.`
                      : `${draft.attendance} of ${selectedRoom.capacity} seats · ${
                          selectedRoom.capacity - draft.attendance
                        } spare.`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[12px] text-slate-500">Enter the expected attendance to compare.</p>
              )}
              {selectedRoom.features.length > 0 ? (
                <p className="mt-1 text-[12px] text-slate-500">
                  Has {selectedRoom.features.join(', ')}
                </p>
              ) : null}
            </div>
          ) : draft.attendance !== null ? (
            <p className="text-[12px] text-slate-500">
              Needs a room that seats at least {draft.attendance}.
            </p>
          ) : null}
        </FormSection>

        {showGroups ? (
          <FormSection title="Groups that must stay free" hint="Admin only.">
            <Field
              label="Student groups"
              htmlFor="booking-groups"
              hint="The booking is blocked when one of these groups has a class at the chosen slot."
            >
              <select
                id="booking-groups"
                multiple
                value={draft.mandatory_for_groups}
                onChange={(event) =>
                  update(
                    'mandatory_for_groups',
                    Array.from(event.target.selectedOptions).map((option) => option.value),
                  )
                }
                className={cn(fieldInput, 'h-24 py-1')}
              >
                {options.groups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </Field>
          </FormSection>
        ) : null}

        <FormSection title="Why" hint="The approver reads this, and it stays on the record.">
          <Field label="Reason for this request" htmlFor="booking-reason" required>
            <textarea
              id="booking-reason"
              rows={3}
              value={draft.request_reason ?? ''}
              onChange={(event) => update('request_reason', event.target.value)}
              placeholder="Club orientation for first-year students."
              className={fieldTextarea}
            />
          </Field>
        </FormSection>
      </div>

      <aside className="min-w-0">
        <div className="sticky top-4">
          <h4 className="text-[13px] font-semibold text-slate-900">What already holds this slot</h4>
          <p className="mb-2 mt-0.5 text-[12px] text-slate-500">
            Classes, events, exams and blocks on the chosen dates.
          </p>
          <AvailabilityPanel
            checks={availability}
            loading={availabilityLoading}
            hint="Pick a date, a time and a room to check the slot against the timetable."
          />
        </div>
      </aside>
    </div>
  )
}
