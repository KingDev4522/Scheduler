import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, DoorOpen } from 'lucide-react'
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
import type { BookingFormOptions } from './BookingDraftForm'
import { DatePickerCalendar } from './DatePickerCalendar'

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
    : '—'

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

  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        No sessions are available to you for a change request.
      </p>
    )
  }

  if (initial?.kind && initial.kind !== 'move_session') {
    return (
      <div className="space-y-3">
        {flash && (
          <p
            className={`rounded-lg border px-3 py-2 text-xs ${
              flash.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {flash.message}
          </p>
        )}
        <p className="text-sm text-slate-700">
          This is a <span className="font-semibold">{initial.kind.replace(/_/g, ' ')}</span>{' '}
          request. Submit it for review; the deterministic workflow decides whether it can apply.
        </p>
        <label className="block text-xs font-medium text-neutral-600">
          Reason for this change <span className="text-rose-600">*</span>
          <textarea
            rows={2}
            value={requestReason}
            onChange={(event) => setRequestReason(event.target.value)}
            placeholder="Why is this change needed? The approver sees this."
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
          />
        </label>
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
              const record = await api.createChangeRequest(
                'Structured change request',
                user.username,
                {
                  ...(initial as unknown as Record<string, unknown>),
                  request_reason: requestReason.trim(),
                },
              )
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
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Submit for review
        </button>
      </div>
    )
  }

  const blocked = preview?.blocked ?? []
  const warnings = preview?.warnings ?? []

  return (
    <div className="space-y-4">
      {flash && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs ${
            flash.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {flash.message}
        </p>
      )}

      <label className="block text-xs font-medium text-neutral-600">
        Reason for this change <span className="text-rose-600">*</span>
        <textarea
          rows={2}
          value={requestReason}
          onChange={(event) => setRequestReason(event.target.value)}
          placeholder="Why does this session need to move? The approver sees this."
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-neutral-600">
          Session to move
          <select
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {sessions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.courseCode} — {item.courseName} · {item.day} P{item.startPeriod}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Current slot</p>
          <p>{current}</p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-neutral-600">Target date (first selected)</p>
        <DatePickerCalendar semester={semester} dates={dates} onChange={(next) => setDates(next.slice(0, 1))} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-neutral-600">
          From
          <select
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            {startTimeOptions().map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          To
          <select
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            {endTimeOptions().map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[14rem] flex-1 text-xs font-medium text-neutral-600">
          Room
          <select
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} — {room.capacity} seats · {room.type}
              </option>
            ))}
          </select>
        </label>
      </div>

      {resolved.error ? (
        <p className="text-xs text-rose-700">{resolved.error}</p>
      ) : (
        <p className="text-xs font-semibold text-slate-700">
          P{resolved.from_period}–P{resolved.to_period} · {resolved.duration} period
          {resolved.duration === 1 ? '' : 's'} · {startTime}–{endTime}
          {dates[0] ? ` · ${formatDate(dates[0])}` : ''}
        </p>
      )}

      {preview && (
        <div className="space-y-2">
          {blocked.length > 0 && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-900">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Blocked — this move violates a hard constraint
              </p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-rose-800">
                {blocked.map((item) => (
                  <li key={`${item.rule}-${item.detail}`}>
                    <span className="font-semibold">{item.rule}</span> · {item.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Soft warnings — submission is allowed
              </p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-amber-800">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {preview.ok && blocked.length === 0 && (
            <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Feasible — submit for review.
            </p>
          )}
          {alternatives.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-700">
                Deterministic alternatives
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {alternatives.map((alternative) => (
                  <button
                    key={`${alternative.room_id}-${alternative.day}-${alternative.start_period}`}
                    type="button"
                    onClick={() => {
                      setRoomId(alternative.room_id)
                      setStartTime(timeFromPeriod(alternative.start_period))
                      setEndTime(PERIOD_TIMES[alternative.end_period]?.end ?? endTime)
                      const iso = firstDateForDay(semester, alternative.day)
                      if (iso) setDates([iso])
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                  >
                    <DoorOpen className="mr-1 inline h-3 w-3" aria-hidden />
                    {alternative.room_id} · {alternative.day} P{alternative.start_period}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!preview?.ok) {
              setFlash({
                tone: 'error',
                message: preview
                  ? 'This move is blocked. Pick a feasible alternative or fix the red constraints, then submit.'
                  : 'Choose a valid target date, time and room; the slot check is still running.',
              })
              return
            }
            void submit()
          }}
          disabled={busy}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit for review
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Clock3 className="h-3 w-3" aria-hidden />
          The current timetable stays unchanged until an Admin approves.
        </span>
      </div>
    </div>
  )
}
