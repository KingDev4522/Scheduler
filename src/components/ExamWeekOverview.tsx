import { Link } from 'react-router-dom'
import { CalendarDays, Clock3, DoorOpen, GraduationCap } from 'lucide-react'
import type { DatasetInfo, ScheduleResponse } from '../lib/api'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_LABEL: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
}

interface ExamRow {
  examId: string
  day: string
  session: string
  courseTitles: string[]
  groups: string[]
  rooms: string[]
  size: number | null
}

/**
 * Compact exam-week board for the dashboard. It renders only the exams present
 * in the official schedule; the exam week is the one that follows the teaching
 * week in the dataset, not a fabricated date range.
 */
export function ExamWeekOverview({
  dataset,
  schedule,
}: {
  dataset: DatasetInfo
  schedule: ScheduleResponse
}) {
  const definitions = new Map(dataset.entities.exams.map((exam) => [exam.id, exam]))
  const courses = new Map(dataset.entities.courses.map((course) => [course.id, course.title]))
  const rooms = new Map(dataset.entities.rooms.map((room) => [room.id, room.name]))

  const examSessions = dataset.entities.calendar.exam_week?.sessions?.length
    ? dataset.entities.calendar.exam_week.sessions
    : [
        { id: 'AM', start: '09:30', end: '11:30' },
        { id: 'PM', start: '14:00', end: '16:00' },
      ]

  const rows: ExamRow[] = schedule.schedule.exams.map((placed) => {
    const definition = definitions.get(placed.exam_id)
    return {
      examId: placed.exam_id,
      day: placed.day,
      session: placed.session,
      courseTitles: (definition?.course_ids ?? []).map((id) => courses.get(id) ?? id),
      groups: definition?.groups ?? [],
      rooms: placed.rooms.map((id) => rooms.get(id) ?? id),
      size: definition?.size ?? null,
    }
  })

  const examDays = dataset.entities.calendar.exam_week?.days?.length
    ? dataset.entities.calendar.exam_week.days
    : DAYS

  return (
    <section className="cit-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <GraduationCap className="h-4 w-4 text-neutral-700" aria-hidden />
            Exam week
          </h3>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            The week that follows the teaching week · {examDays.map((day) => DAY_LABEL[day] ?? day).join(', ')} ·
            half effective capacity per room
          </p>
        </div>
        <Link
          to="/exams"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Open full exam view →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[11px] font-semibold text-slate-600">
        {examSessions.map((session) => (
          <span key={session.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1">
            <Clock3 className="h-3 w-3" aria-hidden />
            {session.id} · {session.start}–{session.end}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {rows.length} official papers
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          No exam placements in the generated schedule yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Session
                </th>
                {examDays.map((day) => (
                  <th
                    key={day}
                    className="border-b border-l border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600"
                  >
                    {DAY_LABEL[day] ?? day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {examSessions.map((session) => (
                <tr key={session.id} className="align-top">
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-3">
                    <span className="text-xs font-bold text-slate-900">{session.id}</span>
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                      {session.start}–{session.end}
                    </span>
                  </td>
                  {examDays.map((day) => {
                    const cell = rows.filter((row) => row.day === day && row.session === session.id)
                    return (
                      <td key={day} className="border-b border-l border-slate-100 px-2 py-2">
                        {cell.length === 0 ? (
                          <span className="text-[11px] text-slate-300">—</span>
                        ) : (
                          <div className="space-y-2">
                            {cell.map((exam) => (
                              <div
                                key={exam.examId}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                                title={`${exam.examId} · ${exam.courseTitles.join(', ')} · ${exam.groups.join(', ')} · ${exam.rooms.join(', ')}`}
                              >
                                <p className="font-mono text-[11px] font-bold text-slate-900">
                                  {exam.examId}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-700">
                                  {exam.courseTitles.join(' · ') || 'Course unavailable'}
                                </p>
                                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                                  <DoorOpen className="h-3 w-3 shrink-0" aria-hidden />
                                  <span className="truncate">{exam.rooms.join(', ') || '—'}</span>
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {exam.groups.join(', ') || '—'}
                                  {exam.size !== null ? ` · ${exam.size} candidates` : ''}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
