import { AlertTriangle } from 'lucide-react'
import {
  DAYS,
  LUNCH_TIME,
  PERIODS,
  PERIOD_TIMES,
  EVENT_PERIODS,
  periodGridRow,
  periodRangeLabel,
  timeRangeLabel,
} from '../lib/time'
import type { AppData, Session } from '../lib/store'
import { facultyById, groupById, overlappingSessionPairs, roomById, type TimetableView } from '../lib/selectors'

const DAY_LONG: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
}

const GRID_TEMPLATE = '5.5rem repeat(5, minmax(8.5rem, 1fr))'
const ROW_TEMPLATE =
  '2.5rem repeat(5, 3.25rem) 2.25rem repeat(4, 3.25rem) repeat(4, 2.25rem)'

function sessionMeta(data: AppData, session: Session, view: TimetableView): string {
  const room = roomById(data, session.roomId)?.name ?? session.roomId
  const faculty = facultyById(data, session.facultyId)?.name ?? session.facultyId
  const group = groupById(data, session.groupId)?.name ?? session.groupId
  if (view === 'group') return `${faculty} · ${room}`
  if (view === 'faculty') return `${group} · ${room}`
  return `${group} · ${faculty}`
}

function sessionClasses(session: Session, hasOverlap: boolean): string {
  const tone =
    session.kind === 'lab'
      ? 'border-neutral-300 bg-neutral-100 text-neutral-900'
      : 'border-neutral-300 bg-neutral-100 text-neutral-900'
  return [
    'relative z-10 m-0.5 flex flex-col overflow-hidden rounded-md border px-1.5 py-1 text-left leading-tight shadow-sm',
    tone,
    hasOverlap ? 'ring-2 ring-neutral-500' : '',
  ].join(' ')
}

export function TimetableGrid({
  data,
  sessions,
  view,
}: {
  data: AppData
  sessions: Session[]
  view: TimetableView
}) {
  const pairs = overlappingSessionPairs(sessions)
  const overlapping = new Set<string>()
  for (const pair of pairs) {
    overlapping.add(pair.a.id)
    overlapping.add(pair.b.id)
  }

  const sessionsByDay = new Map<string, Session[]>()
  for (const day of DAYS) sessionsByDay.set(day, [])
  for (const session of sessions) sessionsByDay.get(session.day)?.push(session)

  return (
    <div>
      {/* Desktop / laptop grid */}
      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[900px]">
          <div
            className="grid gap-px rounded-xl border border-slate-200 bg-slate-200"
            style={{ gridTemplateColumns: GRID_TEMPLATE, gridTemplateRows: ROW_TEMPLATE }}
          >              <div
                className="flex items-center justify-center rounded-tl-xl bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
                style={{ gridColumn: 1, gridRow: 1 }}
              >
                Period
              </div>
            {DAYS.map((day, index) => (
              <div
                key={day}                  className={`flex items-center justify-center bg-neutral-50 text-xs font-semibold text-neutral-700 ${
                  index === DAYS.length - 1 ? 'rounded-tr-xl' : ''
                }`}
                style={{ gridColumn: index + 2, gridRow: 1 }}
              >
                {day}
              </div>
            ))}

            {/* Academic cells P1–P9 */}
            {PERIODS.map((period) =>
              DAYS.map((day, dayIndex) => (
                <div
                  key={`cell-${day}-${period}`}
                  className="bg-white"
                  style={{ gridColumn: dayIndex + 2, gridRow: periodGridRow(period) }}
                />
              )),
            )}

            {/* Time column */}
            {PERIODS.map((period) => (
              <div
                key={`time-${period}`}
                className="flex flex-col justify-center bg-neutral-50 px-2 py-1"
                style={{ gridColumn: 1, gridRow: periodGridRow(period) }}
              >
                <span className="text-[11px] font-semibold text-neutral-700">P{period}</span>
                <span className="text-[10px] text-neutral-400">
                  {PERIOD_TIMES[period]?.start}–{PERIOD_TIMES[period]?.end}
                </span>
              </div>
            ))}

            {/* Lunch divider */}
            <div
              className="flex items-center justify-center gap-2 bg-neutral-50 px-3 text-[11px] font-medium text-neutral-700"
              style={{ gridColumn: '1 / -1', gridRow: 7 }}
            >
              <span className="h-px w-8 bg-neutral-300" aria-hidden />
              Lunch {LUNCH_TIME.start}–{LUNCH_TIME.end} · no session may cross this break
              <span className="h-px w-8 bg-neutral-300" aria-hidden />
            </div>

            {/* Event-only band */}
            {EVENT_PERIODS.map((period) => (
              <div
                key={`event-time-${period}`}
                className="flex flex-col justify-center bg-neutral-50/60 px-2 py-1"
                style={{ gridColumn: 1, gridRow: periodGridRow(period) }}
              >
                <span className="text-[11px] font-semibold text-neutral-600">P{period}</span>
                <span className="text-[10px] text-neutral-400">
                  {PERIOD_TIMES[period]?.start}–{PERIOD_TIMES[period]?.end}
                </span>
              </div>
            ))}
            {EVENT_PERIODS.map((period) =>
              DAYS.map((day, dayIndex) => (
                <div
                  key={`event-cell-${day}-${period}`}
                  className="flex items-center justify-center bg-neutral-50/40 text-[10px] uppercase tracking-wide text-neutral-600"
                  style={{ gridColumn: dayIndex + 2, gridRow: periodGridRow(period) }}
                >
                  {period === EVENT_PERIODS[0] ? 'Event-only' : ''}
                </div>
              )),
            )}

            {/* Session blocks */}
            {sessions.map((session) => {
              const hasOverlap = overlapping.has(session.id)
              const column = DAYS.indexOf(session.day) + 2
              return (
                <div
                  key={session.id}
                  className={sessionClasses(session, hasOverlap)}
                  style={{
                    gridColumn: column,
                    gridRow: `${periodGridRow(session.startPeriod)} / span ${session.periods}`,
                  }}
                  title={`${session.courseCode} ${session.courseName} · ${session.day} ${periodRangeLabel(
                    session.startPeriod,
                    session.periods,
                  )} · ${sessionMeta(data, session, view)}${
                    hasOverlap ? ' · OVERLAP WARNING' : ''
                  }`}
                  aria-label={`${session.courseCode} ${session.courseName}, ${session.day} ${periodRangeLabel(
                    session.startPeriod,
                    session.periods,
                  )}, ${sessionMeta(data, session, view)}${
                    hasOverlap ? ', overlap warning' : ''
                  }`}
                >
                  <span className="flex items-center gap-1 text-[11px] font-semibold">
                    {hasOverlap && (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-neutral-700" aria-hidden />
                    )}
                    {session.courseCode}
                  </span>
                  <span className="truncate text-[11px]">{session.courseName}</span>
                  <span className="mt-auto truncate text-[10px] opacity-75">
                    {sessionMeta(data, session, view)}
                  </span>
                  <span className="truncate text-[10px] opacity-60">
                    {periodRangeLabel(session.startPeriod, session.periods)} ·{' '}
                    {timeRangeLabel(session.startPeriod, session.periods)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile stacked agenda */}
      <div className="space-y-4 md:hidden">
        {DAYS.map((day) => {
          const daySessions = [...(sessionsByDay.get(day) ?? [])].sort(
            (a, b) => a.startPeriod - b.startPeriod,
          )
          const beforeLunch = daySessions.filter((session) => session.startPeriod <= 5)
          const afterLunch = daySessions.filter((session) => session.startPeriod >= 6)
          return (              <section key={day} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <header className="flex items-center justify-between bg-neutral-50 px-3 py-2">
                <h3 className="text-sm font-semibold text-neutral-800">{DAY_LONG[day]}</h3>
                <span className="text-[11px] text-neutral-500">
                  {daySessions.reduce((sum, session) => sum + session.periods, 0)} periods
                </span>
              </header>
              {daySessions.length === 0 ? (
                <p className="px-3 py-4 text-sm text-neutral-400">No scheduled sessions.</p>
              ) : (
                <ul>
                  {beforeLunch.map((session) => (
                    <MobileSession key={session.id} data={data} session={session} view={view} hasOverlap={overlapping.has(session.id)} />
                  ))}
                  {beforeLunch.length > 0 && (
                    <li className="flex items-center gap-2 bg-neutral-50 px-3 py-1 text-[10px] font-medium text-neutral-700">
                      <span className="h-px flex-1 bg-neutral-300" aria-hidden />
                      Lunch {LUNCH_TIME.start}–{LUNCH_TIME.end}
                      <span className="h-px flex-1 bg-neutral-300" aria-hidden />
                    </li>
                  )}
                  {afterLunch.map((session) => (
                    <MobileSession key={session.id} data={data} session={session} view={view} hasOverlap={overlapping.has(session.id)} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function MobileSession({
  data,
  session,
  view,
  hasOverlap,
}: {
  data: AppData
  session: Session
  view: TimetableView
  hasOverlap: boolean
}) {
  return (    <li className="flex items-start gap-3 border-t border-neutral-100 px-3 py-2.5 first:border-t-0">
      <div className="w-20 shrink-0">
        <p className="text-[11px] font-semibold text-neutral-700">
          {periodRangeLabel(session.startPeriod, session.periods)}
        </p>
        <p className="text-[10px] text-neutral-400">
          {timeRangeLabel(session.startPeriod, session.periods)}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
          {hasOverlap && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-neutral-700" aria-hidden />}
          <span className="truncate">
            {session.courseCode} — {session.courseName}
          </span>
        </p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">{sessionMeta(data, session, view)}</p>
      </div>        <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          session.kind === 'lab'
            ? 'bg-neutral-200 text-neutral-800'
            : 'bg-neutral-100 text-neutral-800'
        }`}
      >
        {session.kind === 'lab' ? 'Lab' : 'Lecture'}
      </span>
    </li>
  )
}
