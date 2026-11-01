import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Filter,
  GraduationCap,
  Search,
  Users,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { useOfficial } from '../hooks/useOfficial'

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_LABEL: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
}
const SESSION_TIME: Record<string, string> = {
  AM: '09:30–11:30',
  PM: '14:00–16:00',
}

export default function Exams() {
  const { dataset, schedule, loading, error } = useOfficial()
  const [query, setQuery] = useState('')
  const [dayFilter, setDayFilter] = useState('all')
  const [sessionFilter, setSessionFilter] = useState('all')

  const rows = useMemo(() => {
    if (!dataset || !schedule) return []
    const definitions = new Map(dataset.entities.exams.map((exam) => [exam.id, exam]))
    const courses = new Map(dataset.entities.courses.map((course) => [course.id, course.title]))
    const rooms = new Map(dataset.entities.rooms.map((room) => [room.id, room.name]))
    return schedule.schedule.exams
      .map((placed) => {
        const definition = definitions.get(placed.exam_id)
        return {
          ...placed,
          definition,
          courseTitles: (definition?.course_ids ?? []).map(
            (id) => `${id} — ${courses.get(id) ?? id}`,
          ),
          roomNames: placed.rooms.map((id) => rooms.get(id) ?? id),
        }
      })
      .sort((a, b) => {
        const day = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
        if (day !== 0) return day
        const session = (a.session === 'AM' ? 0 : 1) - (b.session === 'AM' ? 0 : 1)
        return session !== 0 ? session : a.exam_id.localeCompare(b.exam_id)
      })
  }, [dataset, schedule])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (dayFilter !== 'all' && row.day !== dayFilter) return false
      if (sessionFilter !== 'all' && row.session !== sessionFilter) return false
      if (!needle) return true
      return `${row.exam_id} ${row.courseTitles.join(' ')} ${row.definition?.groups.join(' ') ?? ''} ${row.roomNames.join(' ')}`
        .toLowerCase()
        .includes(needle)
    })
  }, [rows, query, dayFilter, sessionFilter])

  if (loading) {
    return (
      <PageSkeleton
        label="Loading the official exam schedule…"
        variant="table"
        cards={4}
        rows={8}
      />
    )
  }
  if (error) {
    return (
      <div>
        <PageHeader title="Exams" subtitle="Official midsem schedule" />
        <ErrorState
          title="The backend is unavailable"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }
  if (!schedule || rows.length === 0) {
    return (
      <div>
        <PageHeader title="Exams" subtitle="Official midsem schedule" />
        <EmptyState
          icon={GraduationCap}
          title="No official exam schedule yet"
          description="Generate the timetable from Official Data first. The 41 official exams and the half-capacity rule are then rendered here."
          action={
            <Link
              to="/official"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Open Official Data
            </Link>
          }
        />
      </div>
    )
  }

  const uniqueRooms = new Set(rows.flatMap((row) => row.rooms))
  const amCount = rows.filter((row) => row.session === 'AM').length
  const pmCount = rows.filter((row) => row.session === 'PM').length
  const penalty = schedule.summary.exam_soft_penalty
  const hasFilters = query.trim() !== '' || dayFilter !== 'all' || sessionFilter !== 'all'

  return (
    <div className="cit-page">
      <PageHeader
        title="Exams"
        subtitle={`${rows.length} official midsem exams · ${uniqueRooms.size} rooms · half effective capacity · AM/PM sessions`}
        actions={
          <Link
            to="/official"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
          >
            Official source
          </Link>
        }
      />

      <div className="cit-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: GraduationCap, label: 'Exams', value: rows.length, hint: 'official papers' },
          { icon: CalendarDays, label: 'Exam days', value: new Set(rows.map((row) => row.day)).size, hint: 'Mon–Sat' },
          { icon: DoorOpen, label: 'Rooms used', value: uniqueRooms.size, hint: 'multi-room allocation' },
          {
            icon: CheckCircle2,
            label: 'Validator penalty',
            value: penalty ?? '—',
            hint: penalty === 0 ? 'clean exam schedule' : 'from official validator',
          },
        ].map((card) => (
          <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-black">
                {card.label}
              </span>
              <card.icon className="h-4 w-4 text-slate-700" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-950">{card.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-700">{card.hint}</p>
          </article>
        ))}
      </div>

      <section className="cit-card mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-700" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-900">Filter exams</h3>
          <span className="ml-auto text-xs font-medium text-slate-700">
            {filtered.length} of {rows.length} shown · {amCount} AM · {pmCount} PM
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setDayFilter('all')
                setSessionFilter('all')
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-800"
            >
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-slate-800">
            Search
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Exam, course, group or room"
                className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-2 text-sm text-black"
              />
            </div>
          </label>
          <label className="text-xs font-semibold text-slate-800">
            Day
            <select
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-black"
            >
              <option value="all">All exam days</option>
              {DAY_ORDER.map((day) => (
                <option key={day} value={day}>
                  {DAY_LABEL[day]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-800">
            Session
            <select
              value={sessionFilter}
              onChange={(event) => setSessionFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-black"
            >
              <option value="all">AM and PM</option>
              <option value="AM">AM · 09:30–11:30</option>
              <option value="PM">PM · 14:00–16:00</option>
            </select>
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              Capacity rule
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-800">
              Rooms are used at half capacity; multi-room exams are expected.
            </p>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={GraduationCap}
            title="No exams match these filters"
            description="Try another day, session or search term."
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setDayFilter('all')
                  setSessionFilter('all')
                }}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <section className="cit-card mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Official exam schedule</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {filtered.length} of {rows.length} papers · sorted by day, then AM / PM
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                AM · 09:30–11:30
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                PM · 14:00–16:00
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                Half capacity per room
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
                  <th
                    scope="col"
                    className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                  >
                    Exam
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                  >
                    Courses
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                  >
                    Groups
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      Candidates
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                  >
                    Day
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                      Session
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <DoorOpen className="h-3.5 w-3.5" aria-hidden />
                      Rooms
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody
                key={`${dayFilter}-${sessionFilter}`}
                className="cit-stagger-rows"
              >
                {filtered.map((exam) => (
                  <tr
                    key={exam.exam_id}
                    className="group odd:bg-white even:bg-slate-50/40 transition-colors hover:bg-slate-100/80"
                  >
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-inherit px-4 py-3.5 align-top">
                      <span className="font-mono text-[13px] font-bold tracking-tight text-slate-950">
                        {exam.exam_id}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Paper
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                      <p className="max-w-[22rem] text-[13px] font-semibold leading-snug text-slate-900">
                        {exam.courseTitles.join(' · ') || 'Course unavailable'}
                      </p>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                      <div className="flex max-w-[14rem] flex-wrap gap-1">
                        {(exam.definition?.groups ?? []).map((group) => (
                          <span
                            key={group}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                          >
                            {group}
                          </span>
                        ))}
                        {(exam.definition?.groups ?? []).length === 0 && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                      <p className="text-lg font-semibold leading-tight tabular-nums text-slate-950">
                        {exam.definition?.size ?? '—'}
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        candidates · {exam.definition?.duration_hours ?? 2}h
                      </p>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800">
                        {DAY_LABEL[exam.day] ?? exam.day}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-800">
                        {exam.session}
                      </span>
                      <span className="mt-1 block text-[10px] font-medium text-slate-500">
                        {SESSION_TIME[exam.session] ?? ''}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                      <div className="flex max-w-[13rem] flex-wrap gap-1">
                        {exam.roomNames.map((room) => (
                          <span
                            key={room}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                          >
                            {room}
                          </span>
                        ))}
                        {exam.roomNames.length === 0 && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] font-medium text-slate-500">
            <span>
              {filtered.length} of {rows.length} exams shown · {amCount} AM · {pmCount} PM
            </span>
            <span>
              {uniqueRooms.size} rooms in use · half effective capacity per room
            </span>
          </div>
        </section>
      )}
    </div>
  )
}
