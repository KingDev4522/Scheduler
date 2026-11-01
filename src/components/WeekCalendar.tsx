import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CalendarDays } from 'lucide-react'
import type { Booking, Faculty, Room, Session, StudentGroup } from '../lib/store'
import { PERIOD_TIMES } from '../lib/time'
import { SOFT_EASE } from '../lib/motion'
import { datasetDay, formatDate } from '../lib/semester'

const DAYS: Session['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const START_MINUTE = 8 * 60
const ROW_HEIGHT = 56
const PX_PER_MINUTE = ROW_HEIGHT / 60

const SESSION_COLORS = [
  'border-sky-200 bg-sky-50',
  'border-violet-200 bg-violet-50',
  'border-emerald-200 bg-emerald-50',
  'border-amber-200 bg-amber-50',
  'border-rose-200 bg-rose-50',
  'border-neutral-200 bg-neutral-50',
]

type HoverItem = {
  kind: 'session' | 'event'
  id: string
  left: number
  top: number
}

function minutesOf(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function colorFor(session: Session): string {
  let hash = 0
  for (const char of session.courseCode) hash = (hash * 31 + char.charCodeAt(0)) % SESSION_COLORS.length
  return SESSION_COLORS[hash]
}

function priorityLabel(priority: number): string {
  return priority === 1 ? 'Institute' : priority === 2 ? 'Department / guest' : 'Club'
}

export interface WeekCalendarProps {
  sessions: Session[]
  rooms: Room[]
  events?: Booking[]
  faculty?: Faculty[]
  groups?: StudentGroup[]
  title?: string
  subtitle?: string
  badge?: string
  endHour?: number
  showEvents?: boolean
  /** Mon–Fri ISO dates of the selected week, used to label each weekday with its date. */
  weekDates?: string[]
}

/**
 * A data-backed week view. It positions classes by their real period times and,
 * when supplied, overlays approved/alternative campus events. It does not invent
 * weeks or events that are not present in the official dataset.
 */
export function WeekCalendar({
  sessions,
  rooms,
  events = [],
  faculty = [],
  groups = [],
  title = 'Weekly teaching template',
  subtitle = 'Mon–Fri · P1 08:00–P9 17:00 · lunch 13:00–14:00 · P10–P13 events 18:00–22:00',
  badge = 'Week view',
  endHour = 18,
  showEvents = false,
  weekDates = [],
}: WeekCalendarProps) {
  const [hover, setHover] = useState<HoverItem | null>(null)
  const [selected, setSelected] = useState<{ kind: 'session' | 'event'; id: string } | null>(null)

  const roomName = useMemo(() => {
    const map = new Map(rooms.map((room) => [room.id, room.name]))
    return (id: string) => map.get(id) ?? id
  }, [rooms])

  const facultyInfo = useMemo(() => {
    const map = new Map(faculty.map((member) => [member.id, member]))
    return (id: string) => map.get(id)
  }, [faculty])

  const groupName = useMemo(() => {
    const map = new Map(groups.map((group) => [group.id, group.name]))
    return (id: string) => map.get(id) ?? id
  }, [groups])

  const hours = useMemo(() => {
    const values: number[] = []
    for (let hour = 8; hour <= endHour; hour += 1) values.push(hour)
    return values
  }, [endHour])

  const endMinute = endHour * 60
  const gridHeight = (endMinute - START_MINUTE) * PX_PER_MINUTE

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const day of DAYS) map.set(day, [])
    for (const session of sessions) {
      const start = PERIOD_TIMES[session.startPeriod]?.start
      const end = PERIOD_TIMES[session.startPeriod + session.periods - 1]?.end
      if (!start || !end || !map.has(session.day)) continue
      map.get(session.day)?.push(session)
    }
    return map
  }, [sessions])

  const visibleEvents = useMemo(
    () =>
      showEvents
        ? events.filter(
            (event) =>
              (event.status === 'approved' || event.status === 'alternative_offered') &&
              DAYS.includes(event.day),
          )
        : [],
    [events, showEvents],
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const day of DAYS) map.set(day, [])
    for (const event of visibleEvents) {
      const start = PERIOD_TIMES[event.startPeriod]?.start
      const end = PERIOD_TIMES[event.startPeriod + event.periods - 1]?.end
      if (!start || !end) continue
      map.get(event.day)?.push(event)
    }
    return map
  }, [visibleEvents])

  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  )
  const eventById = useMemo(
    () => new Map(visibleEvents.map((event) => [event.id, event])),
    [visibleEvents],
  )

  const showHover = (kind: 'session' | 'event', id: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    const width = 300
    const left = Math.max(8, Math.min(rect.right + 8, window.innerWidth - width - 12))
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 250))
    setHover({ kind, id, left, top })
  }

  const dateFor = (day: string) => weekDates.find((iso) => datasetDay(iso) === day)

  const details = (kind: 'session' | 'event', id: string) => {
    if (kind === 'session') {
      const session = sessionById.get(id)
      if (!session) return null
      const member = facultyInfo(session.facultyId)
      const start = PERIOD_TIMES[session.startPeriod]?.start
      const end = PERIOD_TIMES[session.startPeriod + session.periods - 1]?.end
      return (
        <div className="space-y-1 text-xs text-slate-700">
          <p className="text-sm font-semibold text-slate-900">
            {session.courseCode} — {session.courseName}
          </p>
          <p className="capitalize text-slate-500">
            {session.kind} · {session.day}
            {dateFor(session.day) ? ` ${formatDate(dateFor(session.day)!)}` : ''} · {start}–{end} ·{' '}
            {session.periods} period(s)
          </p>
          <p>
            <span className="font-semibold">Room:</span> {roomName(session.roomId)}
          </p>
          <p>
            <span className="font-semibold">Faculty:</span>{' '}
            {member?.name ?? session.facultyId}
            {member ? ` · max ${member.dailyLimit}h/day` : ''}
          </p>
          <p>
            <span className="font-semibold">Group:</span> {groupName(session.groupId)}
          </p>
          <p className="text-[11px] text-slate-400">Session ID: {session.id}</p>
        </div>
      )
    }
    const event = eventById.get(id)
    if (!event) return null
    const start = PERIOD_TIMES[event.startPeriod]?.start
    const end = PERIOD_TIMES[event.startPeriod + event.periods - 1]?.end
    return (
      <div className="space-y-1 text-xs text-slate-700">
        <p className="text-sm font-semibold text-slate-900">{event.title}</p>
        <p className="capitalize text-slate-500">
          {event.status.replace('_', ' ')} · {event.day}
          {dateFor(event.day) ? ` ${formatDate(dateFor(event.day)!)}` : ''} · {start}–{end} ·{' '}
          {event.periods} period(s)
        </p>
        <p>
          <span className="font-semibold">Room:</span> {roomName(event.roomId)}
        </p>
        <p>
          <span className="font-semibold">Requester:</span> {event.requester} · {event.organizer}
        </p>
        <p>
          <span className="font-semibold">Priority:</span>{' '}
          {event.category ? event.category.replace(/_/g, ' ') : priorityLabel(event.priority)} ·{' '}
          {event.expectedAttendees} expected
        </p>
        {event.decisionReason && (
          <p>
            <span className="font-semibold">Reason:</span> {event.decisionReason}
          </p>
        )}
      </div>
    )
  }

  return (
    <section className="cit-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays className="h-4 w-4 text-neutral-700" aria-hidden />
            {title}
          </h3>
          <p className="mt-0.5 text-xs font-medium text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showEvents && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden /> Events
            </span>
          )}
          <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-black">
            {badge}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] border-b border-slate-100 bg-slate-50/70">
            <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-black">Time</div>
            {DAYS.map((day) => (
              <div
                key={day}
                className="border-l border-slate-100 px-2 py-2 text-center text-sm font-bold text-black"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))]">
            <div className="relative" style={{ height: gridHeight }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-xs font-semibold text-black"
                  style={{ top: (hour * 60 - START_MINUTE) * PX_PER_MINUTE }}
                >
                  {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                </div>
              ))}
            </div>

            {DAYS.map((day) => {
              const daySessions = byDay.get(day) ?? []
              const dayEvents = eventsByDay.get(day) ?? []
              return (
                <div
                  key={day}
                  className="relative border-l border-slate-100"
                  style={{ height: gridHeight }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0 border-t border-slate-100"
                      style={{ top: (hour * 60 - START_MINUTE) * PX_PER_MINUTE }}
                    />
                  ))}

                  {daySessions.map((session, index) => {
                    const start = PERIOD_TIMES[session.startPeriod]?.start
                    const end = PERIOD_TIMES[session.startPeriod + session.periods - 1]?.end
                    if (!start || !end) return null
                    const startMinutes = minutesOf(start)
                    const endMinutes = minutesOf(end)
                    if (startMinutes < START_MINUTE || endMinutes > endMinute) return null
                    const top = (startMinutes - START_MINUTE) * PX_PER_MINUTE
                    const height = Math.max((endMinutes - startMinutes) * PX_PER_MINUTE - 4, 24)
                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, scale: 0.97, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        whileHover={{ scale: 1.02, zIndex: 20 }}
                        whileTap={{ scale: 0.995 }}
                        transition={{
                          duration: 0.34,
                          ease: SOFT_EASE,
                          delay: Math.min(index * 0.035, 0.4),
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${session.courseCode} ${session.courseName}, ${session.day} ${start} to ${end}, ${roomName(session.roomId)}`}
                        onMouseEnter={(event) => showHover('session', session.id, event.currentTarget)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={(event) => showHover('session', session.id, event.currentTarget)}
                        onBlur={() => setHover(null)}
                        onClick={() => setSelected({ kind: 'session', id: session.id })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelected({ kind: 'session', id: session.id })
                          }
                        }}
                        className={`absolute ${
                          showEvents ? 'left-1 right-[48%]' : 'inset-x-1'
                        } origin-center cursor-pointer overflow-hidden rounded-md border px-1.5 py-1 text-black shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${colorFor(session)}`}
                        style={{ top: top + 2, height }}
                      >
                        <p className="truncate text-[11px] font-bold leading-tight">
                          {session.kind === 'lab' ? 'LAB · ' : ''}
                          {session.courseCode}
                        </p>
                        <p className="truncate text-[10px] font-medium leading-tight">
                          {roomName(session.roomId)}
                        </p>
                        <p className="truncate text-[10px] font-medium leading-tight">
                          {start}–{end}
                        </p>
                      </motion.div>
                    )
                  })}

                  {dayEvents.map((event) => {
                    const start = PERIOD_TIMES[event.startPeriod]?.start
                    const end = PERIOD_TIMES[event.startPeriod + event.periods - 1]?.end
                    if (!start || !end) return null
                    const startMinutes = minutesOf(start)
                    const endMinutes = minutesOf(end)
                    if (startMinutes < START_MINUTE || endMinutes > endMinute) return null
                    const top = (startMinutes - START_MINUTE) * PX_PER_MINUTE
                    const height = Math.max((endMinutes - startMinutes) * PX_PER_MINUTE - 4, 24)
                    const approved = event.status === 'approved'
                    return (
                      <motion.div
                        key={`event-${event.id}`}
                        initial={{ opacity: 0, scale: 0.97, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        whileHover={{ scale: 1.02, zIndex: 30 }}
                        whileTap={{ scale: 0.995 }}
                        transition={{ duration: 0.3, ease: SOFT_EASE }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${event.title}, ${event.status}, ${event.day} ${start} to ${end}`}
                        onMouseEnter={(mouseEvent) => showHover('event', event.id, mouseEvent.currentTarget)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={(mouseEvent) => showHover('event', event.id, mouseEvent.currentTarget)}
                        onBlur={() => setHover(null)}
                        onClick={() => setSelected({ kind: 'event', id: event.id })}
                        onKeyDown={(keyEvent) => {
                          if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                            keyEvent.preventDefault()
                            setSelected({ kind: 'event', id: event.id })
                          }
                        }}
                        className={`absolute cursor-pointer overflow-hidden rounded-md border px-1.5 py-1 text-black shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                          showEvents ? 'left-[52%] right-1' : 'inset-x-1'
                        } ${
                          approved
                            ? 'border-amber-300 bg-amber-100'
                            : 'border-violet-300 bg-violet-100'
                        }`}
                        style={{ top: top + 2, height }}
                      >
                        <p className="truncate text-[11px] font-bold leading-tight">{event.title}</p>
                        <p className="truncate text-[10px] font-medium leading-tight">
                          {roomName(event.roomId)}
                        </p>
                        <p className="truncate text-[10px] font-medium leading-tight">
                          {start}–{end} · {approved ? 'Approved' : 'Alternative'}
                        </p>
                      </motion.div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 px-5 py-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded border border-sky-200 bg-sky-50" aria-hidden /> Class
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded border border-amber-300 bg-amber-100" aria-hidden /> Approved event
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded border border-violet-300 bg-violet-100" aria-hidden /> Alternative event
        </span>
        <span className="ml-auto">Hover for details · click to pin</span>
      </div>

      {selected && (
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">{details(selected.kind, selected.id)}</div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {hover && (
        <div
          className="pointer-events-none fixed z-[100] w-[300px] rounded-xl border border-neutral-200 bg-white p-3 shadow-2xl"
          style={{ left: hover.left, top: hover.top }}
          role="tooltip"
        >
          {hover.kind === 'event' && (
            <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              <AlertTriangle className="h-3 w-3" aria-hidden /> Campus event
            </p>
          )}
          {details(hover.kind, hover.id)}
        </div>
      )}
    </section>
  )
}
