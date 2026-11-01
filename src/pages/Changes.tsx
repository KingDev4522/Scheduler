import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import { EmptyState, StatusNotice } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { StatusPill } from '../components/BookingStatus'
import { Field, FormSection, ToggleChip, fieldInput } from '../components/FormBits'

type ChangeType = 'faculty_leave' | 'room_closure'

const TEACHING_PERIODS = Array.from({ length: 9 }, (_, index) => index + 1)

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
  const hardViolations = official.schedule?.after_summary?.hard_violation_count ?? null

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
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Change proposals</h2>
        <div className="mt-4">
          <EmptyState
            title="Official dataset not loaded"
            description="Start the backend and load cit_public.json from Import / Exports."
            action={
              <Link
                to="/admin"
                className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
              >
                Open Import / Exports
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  if (!official.schedule) {
    return (
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Change proposals</h2>
        <div className="mt-4">
          <EmptyState
            title="Generate the timetable first"
            description="A change proposal is repaired against the generated official schedule."
            action={
              <Link
                to="/admin"
                className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
              >
                Generate schedule
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const submitBuilder = async () => {
    if (user.role !== 'admin') {
      setFlash({
        tone: 'error',
        message: 'Only Admin can upload a disruption; use My Workspace to request a change.',
      })
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

  const applyTarget =
    type === 'faculty_leave'
      ? faculty.find((member) => member.id === activeFaculty)
      : rooms.find((room) => room.id === activeRoom)

  return (
    <div className="cit-page">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">
            Change proposals
          </h2>
          <p className="mt-1 max-w-[56ch] text-[14px] leading-relaxed text-slate-600">
            {diff
              ? `${diff.moved_count} session${diff.moved_count === 1 ? '' : 's'} moved · ${hardViolations ?? '–'} hard violation${hardViolations === 1 ? '' : 's'} after the repair`
              : 'The solver repairs the timetable, shows the exact diff, and waits for Admin approval.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/official"
            className="hidden h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          >
            Official report
          </Link>
          <Link
            to="/approvals"
            className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Open approvals
          </Link>
        </div>
      </header>

      {flash ? (
        <div className="mt-4">
          <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>
        </div>
      ) : null}
      {official.error && !flash ? (
        <div className="mt-4">
          <StatusNotice tone="error">{official.error}</StatusNotice>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          {user.role === 'admin' ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-3">
                <h3 className="text-[15px] font-semibold text-slate-900">Build a change</h3>
                <p className="text-[12px] text-slate-500">Timetable is untouched until approved.</p>
              </div>

              <div className="px-5 py-4">
                <FormSection title="Who or what is unavailable">
                  <div className="flex flex-wrap gap-1.5">
                    <ToggleChip active={type === 'faculty_leave'} onClick={() => setType('faculty_leave')}>
                      Faculty leave
                    </ToggleChip>
                    <ToggleChip active={type === 'room_closure'} onClick={() => setType('room_closure')}>
                      Room closure
                    </ToggleChip>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {type === 'faculty_leave' ? (
                      <Field label="Faculty" htmlFor="change-faculty">
                        <select
                          id="change-faculty"
                          value={activeFaculty}
                          onChange={(event) => setFacultyId(event.target.value)}
                          className={fieldInput}
                        >
                          {faculty.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name} · {member.department}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <Field label="Room" htmlFor="change-room">
                        <select
                          id="change-room"
                          value={activeRoom}
                          onChange={(event) => setRoomId(event.target.value)}
                          className={fieldInput}
                        >
                          {rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name} · {room.building}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Day" htmlFor="change-day">
                      <select
                        id="change-day"
                        value={day}
                        onChange={(event) => setDay(event.target.value)}
                        className={fieldInput}
                      >
                        {days.map((weekday) => (
                          <option key={weekday} value={weekday}>
                            {weekday}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Reason" htmlFor="change-reason">
                    <input
                      id="change-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Conference, maintenance"
                      className={fieldInput}
                    />
                  </Field>
                </FormSection>

                <div className="mt-5">
                  <FormSection title="Affected periods" hint={`${periods.length} selected`}>
                    <div className="flex flex-wrap gap-1.5">
                      {TEACHING_PERIODS.map((period) => (
                        <ToggleChip
                          key={period}
                          active={periods.includes(period)}
                          onClick={() =>
                            setPeriods((current) =>
                              current.includes(period)
                                ? current.filter((value) => value !== period)
                                : [...current, period].sort((a, b) => a - b),
                            )
                          }
                        >
                          P{period}
                        </ToggleChip>
                      ))}
                    </div>
                    <p className="text-[12px] text-slate-500">
                      {applyTarget
                        ? `${applyTarget.name} on ${day}, ${
                            periods.length ? `P${[...periods].sort((a, b) => a - b).join(', P')}` : 'no periods'
                          }.`
                        : 'Pick a target and periods.'}
                    </p>
                  </FormSection>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void submitBuilder()}
                    disabled={official.busy}
                    className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {official.busy ? 'Repairing…' : 'Build official repair'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={official.busy}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-400 disabled:opacity-50"
                  >
                    Upload change file
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
                </div>
                <p className="mt-2 text-[12px] text-slate-500">
                  The change file takes faculty leave, room closure, or an added or removed session in
                  the official format.
                </p>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <h3 className="text-[15px] font-semibold text-slate-900">Change proposals</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Coordinators and faculty request changes from My Workspace. An Admin reviews the
                solver's repair here and approves it.
              </p>
              <Link
                to="/workspace"
                className="mt-3 inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
              >
                Open My Workspace
              </Link>
            </section>
          )}
        </div>

        <div className="min-w-0">
          {diff ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3">
                <h3 className="text-[15px] font-semibold text-slate-900">Repair preview</h3>
                <StatusPill
                  status={proposalStatus === 'approved' ? 'approved' : proposalStatus === 'rejected' ? 'rejected' : 'pending'}
                />
              </div>

              <dl className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-4">
                {[
                  { label: 'Moved', value: diff.moved_count },
                  { label: 'Time changed', value: diff.time_changed },
                  { label: 'Room only', value: diff.room_only_changed },
                  { label: 'Hard after', value: hardViolations ?? '–' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white px-3 py-2.5">
                    <dt className="text-[12px] text-slate-500">{stat.label}</dt>
                    <dd className="mt-0.5 text-[18px] font-semibold tabular-nums text-slate-900">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {diff.moved.length > 0 ? (
                <ul className="cit-stagger max-h-80 divide-y divide-slate-100 overflow-y-auto">
                  {diff.moved.map((row) => (
                    <li key={row.session_id} className="px-4 py-2">
                      <p className="text-[13px] font-medium text-slate-800">{row.session_id}</p>
                      <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
                        {row.before.room_id} · {row.before.day} P{row.before.start_period}
                        <span className="px-1">to</span>
                        <span className="text-slate-800">
                          {row.after.room_id} · {row.after.day} P{row.after.start_period}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-[13px] text-slate-500">
                  No session needs to move for this change.
                </p>
              )}

              {diff.added_sessions.length > 0 || diff.removed_sessions.length > 0 ? (
                <p className="border-t border-slate-100 px-4 py-2 text-[12px] text-slate-600">
                  {diff.added_sessions.length > 0 ? (
                    <>
                      Added {diff.added_sessions.join(', ')}.{' '}
                    </>
                  ) : null}
                  {diff.removed_sessions.length > 0 ? (
                    <>Removed {diff.removed_sessions.join(', ')}.</>
                  ) : null}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
                <Link
                  to="/approvals"
                  className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800"
                >
                  Review in Approvals
                </Link>
                <span className="text-[12px] text-slate-500">Nothing ships until Admin approves.</span>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-dashed border-slate-300 px-4 py-6">
              <p className="text-[13px] text-slate-500">
                No repair proposal yet. Build a change and the solver's diff appears here.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
