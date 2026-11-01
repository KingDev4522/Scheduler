import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, GitCompareArrows, Loader2, Upload, Wrench } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, StatusNotice } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'

type ChangeType = 'faculty_leave' | 'room_closure'

export default function Changes() {
  const { user } = useAuth()
  const official = useOfficial()
  const fileInput = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<ChangeType>('faculty_leave')
  const [facultyId, setFacultyId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [day, setDay] = useState('MON')
  const [periods, setPeriods] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9])
  const [reason, setReason] = useState('')
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const dataset = official.dataset
  const days = dataset?.entities.calendar.days ?? ['MON', 'TUE', 'WED', 'THU', 'FRI']
  const faculty = dataset?.entities.faculty ?? []
  const rooms = dataset?.entities.rooms ?? []
  const activeFaculty = facultyId || faculty[0]?.id || ''
  const activeRoom = roomId || rooms[0]?.id || ''

  const diff = official.schedule?.diff ?? official.disruptionResult?.diff ?? null
  const proposalStatus = official.schedule?.proposal_status ?? null

  const changePayload = useMemo(() => {
    if (type === 'faculty_leave') {
      return {
        type: 'faculty_unavailable',
        faculty_id: activeFaculty,
        days: [day],
        periods,
        reason: reason.trim() || 'Faculty leave',
      }
    }
    return {
      type: 'room_unavailable',
      room_id: activeRoom,
      days: [day],
      periods,
      reason: reason.trim() || 'Room closure',
    }
  }, [type, activeFaculty, activeRoom, day, periods, reason])

  if (!user) return null

  if (official.loading && !dataset) {
    return <PageSkeleton label="Loading the official change workflow…" variant="form" rows={5} />
  }

  if (!dataset) {
    return (
      <div>
        <PageHeader title="Change proposals" subtitle="Official disruption repair" />
        <EmptyState
          icon={GitCompareArrows}
          title="Official dataset not loaded"
          description="Start the backend and load cit_public.json from Import / Exports."
          action={
            <Link to="/admin" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
              Open Import / Exports
            </Link>
          }
        />
      </div>
    )
  }

  if (!official.schedule) {
    return (
      <div>
        <PageHeader title="Change proposals" subtitle="Official disruption repair" />
        <EmptyState
          icon={GitCompareArrows}
          title="Generate the timetable first"
          description="A change proposal is repaired against the generated official schedule."
          action={
            <Link to="/admin" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
              Generate schedule
            </Link>
          }
        />
      </div>
    )
  }

  const submitBuilder = async () => {
    if (user.role !== 'admin') {
      setFlash({ tone: 'error', message: 'Only Admin can upload a disruption; use My Workspace to request a change.' })
      return
    }
    if (!periods.length) {
      setFlash({ tone: 'error', message: 'Select at least one period.' })
      return
    }
    const change = { changes: [changePayload] }
    const file = new File([JSON.stringify(change)], 'change.json', { type: 'application/json' })
    setFlash(null)
    const result = await official.uploadDisruption(file)
    setFlash(
      result
        ? { tone: 'success', message: 'Repair proposal built. Review the diff and approve it in Approvals.' }
        : { tone: 'error', message: 'The change file was rejected; the published schedule is unchanged.' },
    )
  }

  const uploadFile = async (file: File | undefined) => {
    if (!file) return
    if (user.role !== 'admin') {
      setFlash({ tone: 'error', message: 'Only Admin can upload a disruption change file.' })
      return
    }
    setFlash(null)
    const result = await official.uploadDisruption(file)
    setFlash(
      result
        ? { tone: 'success', message: 'Change file accepted. Review the diff and approve it in Approvals.' }
        : { tone: 'error', message: 'The change file was rejected; the published schedule is unchanged.' },
    )
  }

  return (
    <div className="cit-page">
      <PageHeader
        title="Change proposals"
        subtitle="Faculty leave, room closure or a change file. The official solver repairs the timetable, shows the exact diff and waits for Admin approval."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}
      {official.error && !flash && <StatusNotice tone="error">{official.error}</StatusNotice>}

      {user.role === 'admin' ? (
        <section className="cit-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Wrench className="h-4 w-4 text-neutral-700" aria-hidden /> Build a change
          </h3>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="change-type" className="mb-1 block text-xs font-medium text-slate-600">
                Change type
              </label>
              <select
                id="change-type"
                value={type}
                onChange={(event) => setType(event.target.value as ChangeType)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="faculty_leave">Faculty leave</option>
                <option value="room_closure">Room closure</option>
              </select>
            </div>

            {type === 'faculty_leave' ? (
              <div>
                <label htmlFor="change-faculty" className="mb-1 block text-xs font-medium text-slate-600">
                  Faculty
                </label>
                <select
                  id="change-faculty"
                  value={activeFaculty}
                  onChange={(event) => setFacultyId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  {faculty.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.department}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="change-room" className="mb-1 block text-xs font-medium text-slate-600">
                  Room
                </label>
                <select
                  id="change-room"
                  value={activeRoom}
                  onChange={(event) => setRoomId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} · {room.building}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="change-day" className="mb-1 block text-xs font-medium text-slate-600">
                Day
              </label>
              <select
                id="change-day"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {days.map((weekday) => (
                  <option key={weekday} value={weekday}>
                    {weekday}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="change-reason" className="mb-1 block text-xs font-medium text-slate-600">
                Reason
              </label>
              <input
                id="change-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Conference, maintenance..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-2 text-xs font-medium text-slate-600">Affected periods</legend>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 9 }, (_, index) => index + 1).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() =>
                    setPeriods((current) =>
                      current.includes(period)
                        ? current.filter((value) => value !== period)
                        : [...current, period].sort((a, b) => a - b),
                    )
                  }
                  aria-pressed={periods.includes(period)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                    periods.includes(period)
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  P{period}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void submitBuilder()}
              disabled={official.busy}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {official.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
              {official.busy ? 'Repairing…' : 'Build official repair'}
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={official.busy}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" /> Upload change file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                void uploadFile(file)
                event.target.value = ''
              }}
            />
            <span className="text-[11px] text-slate-500">
              Supports faculty leave, room closure, add/remove session via the official change-file format.
            </span>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <p>
            Change proposals for coordinators are submitted from <strong>My Workspace</strong>. Admin
            approves them here after the official solver validates the move.
          </p>
          <Link to="/workspace" className="mt-3 inline-block text-xs font-semibold text-neutral-900 hover:underline">
            Open My Workspace →
          </Link>
        </section>
      )}

      {diff && (
        <section className="cit-card mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <GitCompareArrows className="h-4 w-4 text-neutral-700" aria-hidden /> Official repair preview
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                (official.schedule?.after_summary?.hard_violation_count ?? 0) === 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {proposalStatus ?? 'pending'} · {diff.moved_count} moved
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-slate-500">Moved</p>
              <p className="font-semibold text-slate-900">{diff.moved_count}</p>
            </div>
            <div>
              <p className="text-slate-500">Time changed</p>
              <p className="font-semibold text-slate-900">{diff.time_changed}</p>
            </div>
            <div>
              <p className="text-slate-500">Room only</p>
              <p className="font-semibold text-slate-900">{diff.room_only_changed}</p>
            </div>
            <div>
              <p className="text-slate-500">Hard violations</p>
              <p className="font-semibold text-slate-900">
                {official.schedule?.after_summary?.hard_violation_count ?? '—'}
              </p>
            </div>
          </div>
          {diff.moved.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Session</th>
                    <th className="px-3 py-2">Before</th>
                    <th className="px-3 py-2">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diff.moved.map((row) => (
                    <tr key={row.session_id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.session_id}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {row.before.room_id} · {row.before.day} P{row.before.start_period}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {row.after.room_id} · {row.after.day} P{row.after.start_period}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(diff.added_sessions.length > 0 || diff.removed_sessions.length > 0) && (
            <p className="mt-3 text-xs text-slate-600">
              {diff.added_sessions.length > 0 && (
                <>Added: <span className="font-semibold">{diff.added_sessions.join(', ')}</span>. </>
              )}
              {diff.removed_sessions.length > 0 && (
                <>Removed: <span className="font-semibold">{diff.removed_sessions.join(', ')}</span>.</>
              )}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              to="/approvals"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Review in Approvals →
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Nothing is published until Admin approves.
            </span>
          </div>
        </section>
      )}
    </div>
  )
}
