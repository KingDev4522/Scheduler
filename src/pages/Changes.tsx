import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitCompareArrows,
  Loader2,
  Send,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, StatusNotice } from '../components/States'
import { useAuth } from '../lib/auth'
import {
  getData,
  submitProposal,
  type AppData,
  type DisruptionSpec,
  type DisruptionType,
} from '../lib/store'
import { DAYS, periodRangeLabel, type Day } from '../lib/time'
import { planDisruption, type DisruptionPlan } from '../engine/disruption'
import { repairTimetable } from '../engine/solver'
import type { RepairResult } from '../engine/types'

const STATUS_STYLE: Record<RepairResult['status'], string> = {
  FEASIBLE: 'bg-neutral-100 text-neutral-800',
  INFEASIBLE: 'bg-neutral-100 text-neutral-800',
  TIMEOUT: 'bg-neutral-100 text-neutral-800',
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Changes() {
  const { user } = useAuth()
  const [data, setData] = useState<AppData>(getData)
  const [disruptionType, setDisruptionType] = useState<DisruptionType>('faculty_leave')
  const [day, setDay] = useState<Day>('Mon')
  const [facultyId, setFacultyId] = useState(data.faculty[0]?.id ?? '')
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<DisruptionPlan | null>(null)
  const [builtSpec, setBuiltSpec] = useState<DisruptionSpec | null>(null)
  const [repair, setRepair] = useState<RepairResult | null>(null)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const sessionById = useMemo(
    () => new Map(data.sessions.map((session) => [session.id, session])),
    [data.sessions],
  )
  const roomName = (id: string) => data.rooms.find((room) => room.id === id)?.name ?? id
  const facultyName = (id: string) => data.faculty.find((member) => member.id === id)?.name ?? id

  if (!user) return null

  const makeSpec = (): DisruptionSpec => {
    if (disruptionType === 'faculty_leave') {
      return {
        type: 'faculty_leave',
        day,
        facultyId,
        description: `Faculty leave — ${facultyName(facultyId)} unavailable on ${day}`,
      }
    }
    return {
      type: 'room_closure',
      day,
      roomId,
      description: `Room closure — ${roomName(roomId)} unavailable on ${day}`,
    }
  }

  const buildRepair = () => {
    setBusy(true)
    setFlash(null)
    setRepair(null)
    setPlan(null)
    const spec = makeSpec()
    window.setTimeout(() => {
      try {
        const nextPlan = planDisruption(data, spec)
        if (nextPlan.affectedSessionIds.length === 0) {
          setPlan(nextPlan)
          setFlash({
            tone: 'error',
            message: `${nextPlan.summary}. Nothing to repair — pick another day or target.`,
          })
          return
        }
        const currentPlacements = data.sessions.map((session) => ({
          sessionId: session.id,
          day: session.day,
          startPeriod: session.startPeriod,
          periods: session.periods,
          roomId: session.roomId,
        }))
        const result = repairTimetable(nextPlan.input, currentPlacements, nextPlan.affectedSessionIds)
        setPlan(nextPlan)
        setBuiltSpec(spec)
        setRepair(result)
        setFlash({
          tone: result.status === 'FEASIBLE' ? 'success' : 'error',
          message: result.message,
        })
      } catch (error) {
        setFlash({
          tone: 'error',
          message: error instanceof Error ? error.message : 'The repair engine failed unexpectedly.',
        })
      } finally {
        setBusy(false)
      }
    }, 50)
  }

  const submit = () => {
    if (!repair || !plan || !builtSpec) return
    const outcome = submitProposal(
      {
        title: builtSpec.description,
        route:
          builtSpec.type === 'faculty_leave'
            ? 'Admin (faculty-leave repair)'
            : 'Admin (room-closure repair)',
        detail: `${plan.summary}. Minimum-moved repair: ${repair.movedCount} of ${plan.affectedSessionIds.length} affected session(s) relocated; unaffected sessions left untouched.`,
        disruption: builtSpec,
        before: repair.before.map((placement) => ({
          sessionId: placement.sessionId,
          day: placement.day,
          startPeriod: placement.startPeriod,
          roomId: placement.roomId,
        })),
        after: repair.after.map((placement) => ({
          sessionId: placement.sessionId,
          day: placement.day,
          startPeriod: placement.startPeriod,
          roomId: placement.roomId,
        })),
        movedCount: repair.movedCount,
        conflicts: [],
      },
      user,
    )

    if (!outcome.ok) {
      setFlash({ tone: 'error', message: outcome.error })
      return
    }
    setData({ ...outcome.data })
    setFlash({
      tone: 'success',
      message: `Submitted ${outcome.id}. The timetable is unchanged until an Admin approves it in the approvals inbox.`,
    })
    setRepair(null)
    setPlan(null)
    setBuiltSpec(null)
  }

  const canSubmit = repair !== null && repair.status === 'FEASIBLE' && repair.violations.length === 0

  const beforeBySession = new Map((repair?.before ?? []).map((placement) => [placement.sessionId, placement]))

  return (
    <div>
      <PageHeader
        title="Change proposals"
        subtitle="Repair a faculty leave or a room closure. The engine re-places only the affected sessions, shows the exact diff, and nothing changes until an Admin approves."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}

      {/* Disruption builder */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Wrench className="h-4 w-4 text-neutral-700" aria-hidden />
          Describe the disruption
        </h3>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="disruption-type" className="mb-1 block text-xs font-medium text-slate-600">
              Disruption type
            </label>
            <select
              id="disruption-type"
              value={disruptionType}
              onChange={(event) => setDisruptionType(event.target.value as DisruptionType)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="faculty_leave">Faculty leave</option>
              <option value="room_closure">Room closure</option>
            </select>
          </div>

          {disruptionType === 'faculty_leave' ? (
            <div>
              <label htmlFor="disruption-faculty" className="mb-1 block text-xs font-medium text-slate-600">
                Faculty member
              </label>
              <select
                id="disruption-faculty"
                value={facultyId}
                onChange={(event) => setFacultyId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {data.faculty.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.department}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="disruption-room" className="mb-1 block text-xs font-medium text-slate-600">
                Room
              </label>
              <select
                id="disruption-room"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {data.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} · {room.building}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="disruption-day" className="mb-1 block text-xs font-medium text-slate-600">
              Day
            </label>
            <select
              id="disruption-day"
              value={day}
              onChange={(event) => setDay(event.target.value as Day)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {DAYS.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {weekday}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={buildRepair}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <GitCompareArrows className="h-4 w-4" aria-hidden />
              )}
              {busy ? 'Repairing…' : 'Build repair candidate'}
            </button>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-neutral-600">
          Extra-session disruptions are not built yet. Faculty leave and room closure are fully
          supported. Repair output is demo-validated, not official-validator output.
        </p>
      </section>

      {/* Repair preview */}
      {repair && plan && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <GitCompareArrows className="h-4 w-4 text-neutral-700" aria-hidden />
              Repair preview
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[repair.status]}`}
            >
              {repair.status === 'FEASIBLE' ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              )}
              {repair.status}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Affected sessions</dt>
              <dd className="font-semibold text-slate-900">{plan.affectedSessionIds.length}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Actually moved</dt>
              <dd className="font-semibold text-slate-900">{repair.movedCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-semibold text-slate-900">{repair.metrics.durationMs} ms</dd>
            </div>
            <div>
              <dt className="text-slate-500">Search nodes</dt>
              <dd className="font-semibold text-slate-900">{repair.metrics.nodes}</dd>
            </div>
          </dl>

          {repair.violations.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {repair.violations.map((violation, index) => (                  <li
                  key={`${violation.code}-${index}`}
                  className="rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800"
                >
                  <span className="mr-1.5 font-semibold">{violation.code}</span>
                  {violation.message}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2">Session</th>
                  <th scope="col" className="px-3 py-2">Before</th>
                  <th scope="col" className="px-3 py-2">Proposed</th>
                  <th scope="col" className="px-3 py-2">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {repair.after.map((placement) => {
                  const before = beforeBySession.get(placement.sessionId)
                  const session = sessionById.get(placement.sessionId)
                  const changed =
                    !before ||
                    before.day !== placement.day ||
                    before.startPeriod !== placement.startPeriod ||
                    before.roomId !== placement.roomId
                  return (
                    <tr key={placement.sessionId} className="align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{session?.courseCode}</p>
                        <p className="text-[11px] text-slate-500">{session?.courseName}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {before
                          ? `${roomName(before.roomId)} · ${before.day} ${periodRangeLabel(before.startPeriod, session?.periods ?? 1)}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {`${roomName(placement.roomId)} · ${placement.day} ${periodRangeLabel(placement.startPeriod, session?.periods ?? 1)}`}
                      </td>
                      <td className="px-3 py-2">
                        {changed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-800">
                            <ArrowRight className="h-3 w-3" aria-hidden />
                            Moved
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                            Held
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
              Submit for Admin approval
            </button>
            <span className="text-[11px] text-slate-500">
              {canSubmit
                ? 'Submission records the proposal; the schedule is not modified until approval.'
                : 'Submission is blocked while the repair is infeasible, times out or leaves a hard violation.'}
            </span>
          </div>
        </section>
      )}

      {/* Proposals */}
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Change proposals</h3>
          <Link
            to="/approvals"
            className="text-xs font-semibold text-neutral-900 transition-colors hover:text-neutral-700"
          >
            Open approvals inbox →
          </Link>
        </div>

        {data.proposals.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={GitCompareArrows}
              title="No change proposals yet"
              description="Build a repair candidate above and submit it. It will appear here and in the Admin's approvals inbox."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.proposals.map((proposal) => (
              <li key={proposal.id} className="py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{proposal.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {proposal.id} · requester {proposal.requester} · {timeAgo(proposal.submittedAt)}
                      {proposal.decidedBy ? ` · decided by ${proposal.decidedBy}` : ''}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{proposal.detail}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      proposal.status === 'approved'
                        ? 'bg-neutral-100 text-neutral-800'
                        : proposal.status === 'rejected'
                          ? 'bg-neutral-100 text-neutral-800'
                          : 'bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    {proposal.status === 'pending'
                      ? 'Pending Admin'
                      : proposal.status === 'approved'
                        ? 'Approved & applied'
                        : 'Rejected'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
