import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type SessionAvailability } from '../lib/api'
import type { SessionUser } from '../lib/auth'
import type { Session } from '../lib/store'
import { PERIOD_TIMES } from '../lib/time'
import type { Semester } from '../lib/semester'
import {
  datasetDay,
  endTimeOptions,
  formatDate,
  resolveWindow,
  startTimeOptions,
  timeFromPeriod,
  weekDates,
} from '../lib/semester'
import { cn } from '../lib/utils'
import type { BookingFormOptions } from './BookingDraftForm'
import { DatePickerCalendar } from './DatePickerCalendar'
import { PeriodTape } from './PeriodTape'
import { Field, FormSection, fieldInput, fieldTextarea } from './FormBits'

export interface SessionChangeInitial {
  kind?: string | null
  request_reason?: string | null
  session_id?: string | null
  day?: string | null
  start_period?: number | null
  room_id?: string | null
  course_id?: string | null
}

function firstDateForDay(semester: Semester | null, day: string | null | undefined): string | null {
  if (!semester || !semester.weeks.length || !day) return null
  const week = semester.weeks[0]
  return weekDates(semester, week.number).find((iso) => datasetDay(iso) === day) ?? null
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: 'rose' | 'amber' | 'emerald'
  title: string
  children?: React.ReactNode
}) {
  const ink =
    tone === 'rose' ? 'text-rose-800' : tone === 'amber' ? 'text-amber-900' : 'text-emerald-800'
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <p className={cn('text-[13px] font-semibold', ink)}>{title}</p>
      {children}
    </div>
  )
}

export function SessionChangeForm({
  user,
  sessions,
  rooms,
  semester,
  initial,
  onSubmitted,
}: {
  user: SessionUser
  sessions: Session[]
  rooms: BookingFormOptions['rooms']
  semester: Semester | null
  initial?: SessionChangeInitial | null
  onSubmitted?: () => void
}) {
  const initialSession =
    sessions.find((session) => session.id === initial?.session_id) ?? sessions[0] ?? null
  const [sessionId, setSessionId] = useState(initialSession?.id ?? '')
  const session = sessions.find((item) => item.id === sessionId) ?? null
  const [dates, setDates] = useState<string[]>(() => {
    const day = initial?.day ?? initialSession?.day ?? null
    const iso = firstDateForDay(semester, day)
    return iso ? [iso] : []
  })
  const [startTime, setStartTime] = useState(() =>
    timeFromPeriod(initial?.start_period ?? initialSession?.startPeriod ?? 10),
  )
  const [endTime, setEndTime] = useState(() => {
    const start = initial?.start_period ?? initialSession?.startPeriod ?? 10
    const periods = initialSession?.periods ?? 1
    return PERIOD_TIMES[start + periods - 1]?.end ?? '11:00'
  })
  const [roomId, setRoomId] = useState(initial?.room_id ?? initialSession?.roomId ?? '')
  const [requestReason, setRequestReason] = useState(initial?.request_reason ?? '')
  const [preview, setPreview] = useState<SessionAvailability | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!session) return
    setStartTime(timeFromPeriod(session.startPeriod))
    setEndTime(PERIOD_TIMES[session.startPeriod + session.periods - 1]?.end ?? '')
    setRoomId(session.roomId)
    const iso = firstDateForDay(semester, session.day)
    if (iso) setDates([iso])
  }, [sessionId, session, semester])

  const day = dates[0] ? datasetDay(dates[0]) : null
  const resolved = resolveWindow(startTime, endTime)
  const startPeriod = resolved.error ? null : resolved.from_period
  const current = session
    ? `${session.day} P${session.startPeriod}–P${session.startPeriod + session.periods - 1} · ${
        rooms.find((room) => room.id === session.roomId)?.name ?? session.roomId
      }`
    : '–'

  useEffect(() => {
    if (!session || !day || !startPeriod || !roomId) {
      setPreview(null)
      return undefined
    }
    let active = true
    const timer = window.setTimeout(() => {
      api
        .sessionAvailability(
          { session_id: session.id, day, start_period: startPeriod, room_id: roomId },
          user.username,
        )
        .then((result) => {
          if (active) setPreview(result)
        })
        .catch(() => {
          if (active) setPreview(null)
        })
    }, 300)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [session, day, startPeriod, roomId, user.username])

  const alternatives = useMemo(() => preview?.alternatives ?? [], [preview])

  const submit = async () => {
    if (!session || !day || !startPeriod || !roomId) return
    if (!requestReason.trim()) {
      setFlash({
        tone: 'error',
        message: 'Add a short reason for this change. The approver sees it, so it cannot be blank.',
      })
      return
    }
    setBusy(true)
    setFlash(null)
    try {
      const roomName = rooms.find((room) => room.id === roomId)?.name ?? roomId
      const text = `Move ${session.courseCode} to ${day} P${startPeriod} in ${roomName}`
      const record = await api.createChangeRequest(text, user.username, {
        kind: 'move_session',
        request_reason: requestReason.trim(),
        session_id: session.id,
        day,
        start_period: startPeriod,
        room_id: roomId,
        groups: [],
      })
      setFlash({ tone: 'success', message: `${record.id} submitted for review.` })
      onSubmitted?.()
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Submission failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  const flashNode = flash ? (
    <p
      className={cn(
        'rounded-lg border border-slate-200 px-3 py-2 text-[13px]',
        flash.tone === 'success' ? 'text-emerald-800' : 'text-rose-800',
      )}
    >
      {flash.message}
    </p>
  ) : null

  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-[13px] text-slate-500">
        No sessions are available to you for a change request.
      </p>
    )
  }

  if (initial?.kind && initial.kind !== 'move_session') {
    return (
      <div className="max-w-xl space-y-4">
        {flashNode}
        <p className="text-[13px] leading-relaxed text-slate-600">
          This is a <span className="font-medium text-slate-800">{initial.kind.replace(/_/g, ' ')}</span>{' '}
          request. Submit it for review; the deterministic workflow decides whether it can apply.
        </p>
        <Field label="Reason for this change" required>
          <textarea
            rows={3}
            value={requestReason}
            onChange={(event) => setRequestReason(event.target.value)}
            placeholder="Why is this change needed? The approver sees this."
            className={fieldTextarea}
          />
        </Field>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!requestReason.trim()) {
              setFlash({
                tone: 'error',
                message: 'Add a short reason for this change before submitting.',
              })
              return
            }
            setBusy(true)
            setFlash(null)
            try {
              const record = await api.createChangeRequest('Structured change request', user.username, {
                ...(initial as unknown as Record<string, unknown>),
                request_reason: requestReason.trim(),
              })
              setFlash({ tone: 'success', message: `${record.id} submitted for review.` })
              onSubmitted?.()
            } catch (error) {
              setFlash({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Submission failed.',
              })
            } finally {
              setBusy(false)
            }
          }}
          className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          Submit for review
        </button>
      </div>
    )
  }

  const blocked = preview?.blocked ?? []
  const warnings = preview?.warnings ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        {flashNode}

        <FormSection title="The session" hint="The timetable stays as it is until an Admin approves.">
          <Field label="Session to move">
            <select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className={fieldInput}
            >
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.courseCode} · {item.courseName} · {item.day} P{item.startPeriod}
                </option>
              ))}
            </select>
          </Field>

          {session ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <PeriodTape
                from={session.startPeriod}
                to={session.startPeriod + session.periods - 1}
                tone="asked"
                labelled
              />
              <p className="mt-2 text-[12px] tabular-nums text-slate-600">Now at {current}</p>
            </div>
          ) : null}
        </FormSection>

        <FormSection title="Move it to" hint="The target date, time and room.">
          <Field label="Target date">
            <DatePickerCalendar
              semester={semester}
              dates={dates}
              onChange={(next) => setDates(next.slice(0, 1))}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From">
              <select
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={fieldInput}
              >
                {startTimeOptions().map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To">
              <select
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
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

          <Field label="Room">
            <select
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className={fieldInput}
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.capacity} seats · {room.type}
                </option>
              ))}
            </select>
          </Field>

          {resolved.error ? (
            <p className="text-[12px] text-rose-700">{resolved.error}</p>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <PeriodTape from={resolved.from_period} to={resolved.to_period} tone="granted" labelled />
              <p className="mt-2 text-[12px] tabular-nums text-slate-600">
                P{resolved.from_period}–P{resolved.to_period} · {resolved.duration} period
                {resolved.duration === 1 ? '' : 's'} · {startTime}–{endTime}
                {dates[0] ? ` · ${formatDate(dates[0])}` : ''}
              </p>
            </div>
          )}
        </FormSection>

        <FormSection title="Why" hint="The approver reads this, and it stays on the record.">
          <Field label="Reason for this change" required>
            <textarea
              rows={3}
              value={requestReason}
              onChange={(event) => setRequestReason(event.target.value)}
              placeholder="Why does this session need to move?"
              className={fieldTextarea}
            />
          </Field>
        </FormSection>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!preview?.ok) {
                setFlash({
                  tone: 'error',
                  message: preview
                    ? 'This move is blocked. Pick a feasible alternative or clear the red constraints, then submit.'
                    : 'Choose a valid target date, time and room; the slot check is still running.',
                })
                return
              }
              void submit()
            }}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit for review
          </button>
          <span className="text-[12px] text-slate-500">
            Nothing changes until an Admin approves the request.
          </span>
        </div>
      </div>

      <aside className="min-w-0">
        <div className="sticky top-4 space-y-2">
          <h4 className="text-[13px] font-semibold text-slate-900">Will this move fit?</h4>
          <p className="text-[12px] text-slate-500">
            Checked against rooms, faculty, groups, capacity and fixed slots.
          </p>

          {blocked.length > 0 ? (
            <Notice tone="rose" title="Blocked by a hard constraint">
              <ul className="mt-1 space-y-1">
                {blocked.map((item) => (
                  <li key={`${item.rule}-${item.detail}`} className="text-[12px] leading-relaxed text-rose-800">
                    <span className="font-medium">{item.rule}</span> · {item.detail}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {warnings.length > 0 ? (
            <Notice tone="amber" title="Soft warnings, still submittable">
              <ul className="mt-1 space-y-1">
                {warnings.map((warning) => (
                  <li key={warning} className="text-[12px] leading-relaxed text-amber-900">
                    {warning}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {preview && preview.ok && blocked.length === 0 ? (
            <Notice tone="emerald" title="Feasible" />
          ) : null}

          {!preview ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
              Pick a target date, time and room to run the check.
            </p>
          ) : null}

          {alternatives.length > 0 ? (
            <div className="rounded-lg border border-slate-200 px-3 py-2.5">
              <p className="text-[12px] text-slate-500">Slots that would work</p>
              <ul className="mt-1.5 space-y-1">
                {alternatives.map((alternative) => (
                  <li key={`${alternative.room_id}-${alternative.day}-${alternative.start_period}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setRoomId(alternative.room_id)
                        setStartTime(timeFromPeriod(alternative.start_period))
                        setEndTime(PERIOD_TIMES[alternative.end_period]?.end ?? endTime)
                        const iso = firstDateForDay(semester, alternative.day)
                        if (iso) setDates([iso])
                      }}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-left text-[12px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-300"
                    >
                      <span className="text-slate-900">{alternative.room_id}</span>
                      <span className="text-slate-500">
                        {' · '}
                        {alternative.day} P{alternative.start_period}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
