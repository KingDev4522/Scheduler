import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { BookingDraft, BookingWindow } from '../lib/api'
import { PERIOD_TIMES } from '../lib/time'
import { SOFT_EASE } from '../lib/motion'
import type { Semester } from '../lib/semester'
import type { OccupancyCheck } from '../lib/api'
import {
  dateToWeek,
  datasetDay,
  endTimeOptions,
  formatDate,
  resolveWindow,
  startTimeOptions,
  timeFromPeriod,
} from '../lib/semester'
import { DatePickerCalendar } from './DatePickerCalendar'
import { AvailabilityPanel } from './AvailabilityPanel'

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
  const fromPeriod = resolved.error ? firstWindow?.from_period ?? 10 : resolved.from_period
  const toPeriod = resolved.error ? firstWindow?.to_period ?? 11 : resolved.to_period
  const selectedRoom = options.rooms.find((room) => room.id === draft.requested_room)
  const overCapacity =
    selectedRoom !== undefined &&
    draft.attendance !== null &&
    draft.attendance > selectedRoom.capacity
  const spare =
    selectedRoom !== undefined && draft.attendance !== null
      ? selectedRoom.capacity - draft.attendance
      : null

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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="booking-title" className="mb-1 block text-xs font-medium text-neutral-600">
            Event title
          </label>
          <input
            id="booking-title"
            value={draft.title}
            onChange={(event) => update('title', event.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
          />
        </div>
        <div>
          <label htmlFor="booking-attendance" className="mb-1 block text-xs font-medium text-neutral-600">
            Attendance
          </label>
          <input
            id="booking-attendance"
            type="number"
            min={1}
            value={draft.attendance ?? ''}
            onChange={(event) =>
              update('attendance', event.target.value === '' ? null : Number(event.target.value))
            }
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
          />
        </div>
      </div>

      <div>
        <label htmlFor="booking-reason" className="mb-1 block text-xs font-medium text-neutral-600">
          Reason for this request <span className="text-rose-600">*</span>
        </label>
        <textarea
          id="booking-reason"
          rows={2}
          value={draft.request_reason ?? ''}
          onChange={(event) => update('request_reason', event.target.value)}
          placeholder="Why is this venue needed? e.g. Club orientation for first-year students."
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
        />
        <p className="mt-1 text-[11px] text-neutral-500">
          Shown to the approver and kept with the request after the decision. Do not put a decision
          here; the approver writes that separately.
        </p>
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-neutral-600">Date(s)</legend>
        <p className="mb-2 text-[11px] text-neutral-500">
          Pick one or more days. Only upcoming weekdays in the semester weeks are allowed; the exam
          week is closed. Each date resolves to its weekday and week number.
        </p>
        <DatePickerCalendar semester={options.semester} dates={dates} onChange={setDates} />
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-neutral-600">Time</legend>
        <p className="mb-2 text-[11px] text-neutral-500">
          One period = one hour. The period range and duration are derived from these times — no
          separate duration field.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="booking-start" className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
              From
            </label>
            <select
              id="booking-start"
              value={startTime}
              onChange={(event) => setTimes(event.target.value, endTime)}
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
            >
              {startTimeOptions().map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="booking-end" className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">
              To
            </label>
            <select
              id="booking-end"
              value={endTime}
              onChange={(event) => setTimes(startTime, event.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
            >
              {endTimeOptions().map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>
          {!resolved.error && (
            <p className="pb-1.5 text-xs font-semibold text-slate-700">
              P{resolved.from_period}–P{resolved.to_period} · {resolved.duration} period
              {resolved.duration === 1 ? '' : 's'} · {startTime}–{endTime}
            </p>
          )}
        </div>
        {timeError && <p className="mt-1 text-xs text-rose-700">{timeError}</p>}
      </fieldset>

      {dates.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Resolved for {dates.length} date{dates.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            {dates.map((iso) => {
              const day = datasetDay(iso)
              const week = options.semester ? dateToWeek(options.semester, iso) : null
              return (
                <li key={iso}>
                  <span className="font-semibold">{formatDate(iso)}</span>
                  {week ? ` · Week ${week.number} (${week.phase})` : ''}
                  {day ? ` · ${day}` : ''} · P{fromPeriod}–P{toPeriod}
                </li>
              )
            })}
          </ul>
          {draft.windows.length !== dates.length && (
            <p className="mt-1 text-[11px] text-slate-500">
              {dates.length} date(s) → {draft.windows.length} weekday window(s); the dataset schedules
              per weekday, so repeated weekdays map to one window.
            </p>
          )}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-neutral-600">What is already booked at this slot</p>
        <AvailabilityPanel
          checks={availability}
          loading={availabilityLoading}
          hint="Pick date(s), time and (optionally) a room to see the existing class, event, exam or block."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-neutral-600">Room types</legend>
          <div className="flex flex-wrap gap-2">
            {options.roomTypes.map((type) => (
              <label key={type} className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={draft.room_types.includes(type)}
                  onChange={() => update('room_types', toggle(draft.room_types, type))}
                  className="h-3.5 w-3.5 rounded border-neutral-300"
                />
                {type}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-neutral-600">Facilities</legend>
          <div className="flex flex-wrap gap-2">
            {options.needs.map((need) => (
              <label key={need} className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={draft.needs.includes(need)}
                  onChange={() => update('needs', toggle(draft.needs, need))}
                  className="h-3.5 w-3.5 rounded border-neutral-300"
                />
                {need}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${showGroups ? 'sm:grid-cols-2' : ''}`}>
        <div>
          <label htmlFor="booking-room" className="mb-1 block text-xs font-medium text-neutral-600">
            Preferred room (optional)
          </label>
          <select
            id="booking-room"
            value={draft.requested_room ?? ''}
            onChange={(event) => update('requested_room', event.target.value || null)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Any suitable room</option>
            {options.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} — {room.capacity} seats · {room.type}
              </option>
            ))}
          </select>
          {selectedRoom ? (
            <div
              className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                overCapacity
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              <p className="font-semibold">
                {selectedRoom.name} · {selectedRoom.capacity} seats · {selectedRoom.type}
                {selectedRoom.accessible ? ' · accessible' : ''}
              </p>
              <p>
                {draft.attendance !== null
                  ? overCapacity
                    ? `Attendance ${draft.attendance} exceeds capacity by ${
                        draft.attendance - selectedRoom.capacity
                      }.`
                    : `Attendance ${draft.attendance} · ${spare} seat(s) spare.`
                  : `Capacity ${selectedRoom.capacity}; enter the attendance to compare.`}
              </p>
              {selectedRoom.features.length > 0 && (
                <p className="text-[10px] opacity-80">Features: {selectedRoom.features.join(', ')}</p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              {draft.attendance !== null
                ? `Needs a room with at least ${draft.attendance} seats.`
                : 'Pick a room to see its capacity.'}
            </p>
          )}
        </div>
        {showGroups && (
          <div>
            <label htmlFor="booking-groups" className="mb-1 block text-xs font-medium text-neutral-600">
              Groups that must stay free (admin only)
            </label>
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
              className="h-24 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs"
            >
              {options.groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Use only when the event needs these students to be free (H13). The booking is blocked
              if they have a class at the chosen slot.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {draft.windows.length > 0 && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: SOFT_EASE }}
            className="text-[11px] text-neutral-500"
          >
            Requested windows: {draft.windows.map((window) => `${window.day} P${window.from_period}–P${window.to_period}`).join(' · ')}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
