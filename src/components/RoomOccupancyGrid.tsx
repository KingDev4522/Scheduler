import type { Booking, Room, Session } from '../lib/store'
import type { RoomBlock } from '../lib/api'
import type { Semester } from '../lib/semester'
import { phaseLabel, weekLabel } from '../lib/semester'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EXAM_PERIODS: Record<string, number[]> = { AM: [2, 3, 4], PM: [6, 7, 8] }

interface ExamPlacement {
  exam_id: string
  day: string
  session: string
  rooms: string[]
}

interface CellEntry {
  id: string
  kind: 'class' | 'event' | 'exam' | 'block'
  title: string
  detail: string
  day: string
  start: number
  periods: number
}

/** CSS grid row for a period: header 1, P1..P5 rows 2..6, lunch 7, P6..P13 rows 8..15. */
function rowOf(period: number): number {
  return period <= 5 ? period + 1 : period + 2
}

const TONE: Record<CellEntry['kind'], string> = {
  class: 'border-sky-300 bg-sky-50 text-sky-900',
  event: 'border-amber-300 bg-amber-50 text-amber-900',
  exam: 'border-violet-300 bg-violet-50 text-violet-900',
  block: 'border-rose-300 bg-rose-50 text-rose-900',
}

export function RoomOccupancyGrid({
  room,
  week,
  semester,
  sessions,
  bookings,
  exams,
  blocks,
}: {
  room: Room
  week: number
  semester: Semester
  sessions: Session[]
  bookings: Booking[]
  exams: ExamPlacement[]
  blocks: RoomBlock[]
}) {
  const info = semester.weeks.find((item) => item.number === week)
  const phase = info?.phase ?? 'teaching'
  const days = phase === 'exams' ? DAYS : DAYS.slice(0, 5)
  const entries: CellEntry[] = []

  if (phase !== 'exams') {
    for (const session of sessions) {
      if (session.roomId !== room.id) continue
      entries.push({
        id: session.id,
        kind: 'class',
        title: `${session.courseCode} · ${session.courseName}`,
        detail: `${session.kind} · ${session.facultyId} · ${session.groupId}`,
        day: session.day,
        start: session.startPeriod,
        periods: session.periods,
      })
    }
  }

  if (phase === 'spectra') {
    for (const booking of bookings) {
      if (booking.roomId !== room.id) continue
      if (booking.status !== 'approved' && booking.status !== 'alternative_offered') continue
      entries.push({
        id: booking.id,
        kind: 'event',
        title: booking.title,
        detail: `${booking.requester} · ${booking.status.replace('_', ' ')}`,
        day: booking.day,
        start: booking.startPeriod,
        periods: booking.periods,
      })
    }
  }

  if (phase === 'exams') {
    for (const exam of exams) {
      if (!exam.rooms.includes(room.id)) continue
      const periods = EXAM_PERIODS[exam.session] ?? []
      if (periods.length === 0) continue
      entries.push({
        id: `${exam.exam_id}-${exam.session}`,
        kind: 'exam',
        title: exam.exam_id,
        detail: `${exam.session} session`,
        day: exam.day,
        start: periods[0],
        periods: periods.length,
      })
    }
  }

  for (const block of blocks) {
    if (block.room_id !== room.id) continue
    for (const period of block.periods) {
      entries.push({
        id: `${block.room_id}-${block.day}-${period}`,
        kind: 'block',
        title: 'Blocked',
        detail: block.reason,
        day: block.day,
        start: period,
        periods: 1,
      })
    }
  }

  return (
    <section className="cit-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {room.name} · occupancy
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {weekLabel(semester, week)} · {phaseLabel(phase)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-4 rounded border border-sky-300 bg-sky-50" /> Class
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-4 rounded border border-amber-300 bg-amber-50" /> Event
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-4 rounded border border-violet-300 bg-violet-50" /> Exam
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-4 rounded border border-rose-300 bg-rose-50" /> Blocked
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[760px]"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
            gridTemplateRows: '2.25rem repeat(5, 3rem) 2rem repeat(8, 3rem)',
          }}
        >
          <div className="flex items-center justify-center border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Period
          </div>
          {days.map((day, index) => (
            <div
              key={day}
              className={`flex items-center justify-center border-b border-l border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 ${
                index === days.length - 1 ? '' : ''
              }`}
            >
              {day}
            </div>
          ))}

          {Array.from({ length: 13 }, (_, index) => index + 1).map((period) => (
            <div
              key={`time-${period}`}
              className={`flex flex-col justify-center border-b border-slate-100 px-2 py-1 ${
                period >= 10 ? 'bg-slate-50/60 text-slate-500' : 'bg-slate-50 text-slate-700'
              }`}
              style={{ gridColumn: 1, gridRow: rowOf(period) }}
            >
              <span className="text-[11px] font-semibold">P{period}</span>
              <span className="text-[9px]">{period >= 10 ? 'event-only' : ''}</span>
            </div>
          ))}

          {Array.from({ length: 13 }, (_, index) => index + 1).map((period) =>
            days.map((day, dayIndex) => (
              <div
                key={`cell-${day}-${period}`}
                className={`border-b border-l border-slate-100 ${
                  period >= 10 ? 'bg-slate-50/40' : 'bg-white'
                }`}
                style={{ gridColumn: dayIndex + 2, gridRow: rowOf(period) }}
              />
            )),
          )}

          <div
            className="flex items-center justify-center border-b border-slate-100 bg-slate-50 text-[10px] font-semibold text-slate-600"
            style={{ gridColumn: 1, gridRow: 7 }}
          >
            Lunch
          </div>
          <div
            className="flex items-center justify-center border-b border-l border-slate-100 bg-slate-50 text-[10px] font-medium text-slate-500"
            style={{ gridColumn: `2 / span ${days.length}`, gridRow: 7 }}
          >
            13:00–14:00 · no session or event
          </div>

          {entries.map((entry) => {
            const dayIndex = days.indexOf(entry.day)
            if (dayIndex < 0) return null
            return (
              <div
                key={`${entry.kind}-${entry.id}`}
                title={`${entry.title} — ${entry.detail}`}
                className={`z-10 m-0.5 overflow-hidden rounded border px-1.5 py-1 text-[10px] leading-tight ${TONE[entry.kind]}`}
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: `${rowOf(entry.start)} / span ${entry.periods}`,
                }}
              >
                <p className="truncate font-semibold">{entry.title}</p>
                <p className="truncate opacity-80">{entry.detail}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
