import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, CheckCircle2, Plus } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState, StatusNotice } from '../components/States'
import { BookingDraftForm, type BookingFormOptions } from '../components/BookingDraftForm'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import {
  api,
  type BookingAlternative,
  type BookingDraft,
  type BookingProposalPayload,
  type BookingSubmission,
  type BookingValidation,
} from '../lib/api'

const EMPTY_DRAFT: BookingDraft = {
  title: '',
  attendance: 45,
  duration_periods: 2,
  windows: [{ day: 'MON', from_period: 10, to_period: 11 }],
  room_types: [],
  needs: [],
  requested_room: null,
  mandatory_for_groups: [],
}

export default function ManualBooking() {
  const { user } = useAuth()
  const official = useOfficial()
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT)
  const [target, setTarget] = useState<{ room_id: string; day: string; start_period: number } | null>(null)
  const [validation, setValidation] = useState<BookingValidation | null>(null)
  const [submissions, setSubmissions] = useState<BookingSubmission[]>([])
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const options: BookingFormOptions | null = useMemo(() => {
    if (!official.dataset) return null
    const rooms = official.dataset.entities.rooms
    return {
      days: official.dataset.entities.calendar.days,
      roomTypes: Array.from(new Set(rooms.map((room) => room.type))).sort(),
      needs: Array.from(new Set(rooms.flatMap((room) => room.features))).concat('accessible').sort(),
      groups: official.dataset.entities.student_groups.map((group) => group.id),
      rooms: rooms.map((room) => ({ id: room.id, name: room.name })),
    }
  }, [official.dataset])

  const loadSubmissions = useCallback(async () => {
    if (!user) return
    try {
      const response = await api.listBookings(user.username)
      setSubmissions(response.items)
    } catch {
      /* the page still works without the list */
    }
  }, [user])

  useEffect(() => {
    void loadSubmissions()
  }, [loadSubmissions])

  if (!user) return null

  const payload = (): BookingProposalPayload => ({ ...draft, ...(target ?? {}) })

  const validate = async () => {
    setBusy(true)
    setFlash(null)
    try {
      setValidation(await api.validateBooking(payload(), user.username))
    } catch (error) {
      setFlash({ tone: 'error', message: error instanceof Error ? error.message : 'Validation failed.' })
    } finally {
      setBusy(false)
    }
  }

  const chooseAlternative = async (alternative: BookingAlternative) => {
    const chosen = {
      room_id: alternative.room_id,
      day: alternative.day,
      start_period: alternative.start_period,
    }
    setTarget(chosen)
    setBusy(true)
    try {
      setValidation(await api.validateBooking({ ...draft, ...chosen }, user.username))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    setBusy(true)
    setFlash(null)
    try {
      const result = await api.submitBooking(payload(), user.username)
      setFlash({
        tone: 'success',
        message: `${result.request.id} submitted for approval in ${result.request.room_id ?? 'a room'} on ${result.request.day ?? ''}.`,
      })
      setDraft(EMPTY_DRAFT)
      setTarget(null)
      setValidation(null)
      await loadSubmissions()
    } catch (error) {
      setFlash({ tone: 'error', message: error instanceof Error ? error.message : 'Submission failed.' })
    } finally {
      setBusy(false)
    }
  }

  const decide = async (submission: BookingSubmission, decision: 'approved' | 'rejected') => {
    const reason = window.prompt(`Reason for ${decision === 'approved' ? 'approving' : 'rejecting'} ${submission.id}`)
    if (!reason || reason.trim().length < 3) return
    try {
      await api.decideBookingSubmission(submission.id, decision, reason, user.username)
      setFlash({ tone: 'success', message: `${submission.id} ${decision}.` })
      await loadSubmissions()
    } catch (error) {
      setFlash({ tone: 'error', message: error instanceof Error ? error.message : 'Decision failed.' })
    }
  }

  if (official.loading && !official.dataset) {
    return (
      <div>
        <PageHeader title="Manual booking" subtitle="Validated without AI." />
        <LoadingState label="Loading the official dataset…" />
      </div>
    )
  }

  if (!official.dataset || !options) {
    return (
      <div>
        <PageHeader title="Manual booking" subtitle="Validated without AI." />
        <ErrorState
          title="Backend not reachable"
          description={`${official.error ?? 'The scheduling API is offline.'} Start it with: python -m uvicorn backend.app:app --port 8000`}
          onRetry={() => void official.refresh()}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Manual booking"
        subtitle="Submit a venue request without AI. Every slot is checked against the official timetable and rules before submission."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Plus className="h-4 w-4" aria-hidden /> New request
          </h3>
          <Link to="/assistant" className="text-xs font-semibold text-indigo-700 hover:underline">
            Use the assistant instead →
          </Link>
        </div>
        <div className="mt-4">
          <BookingDraftForm
            draft={draft}
            options={options}
            onChange={(next) => {
              setDraft(next)
              setTarget(null)
              setValidation(null)
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void validate()}
            disabled={busy}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
          >
            Check availability
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !validation?.ok}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit for approval
          </button>
          <span className="text-xs text-neutral-500">
            {validation?.ok
              ? 'A validated slot is selected. Submitting records a pending request.'
              : 'Validate and choose a proposed slot before submitting.'}
          </span>
        </div>

        {validation && (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-xs font-semibold text-neutral-800">
              {validation.ok ? 'All hard checks pass' : 'Deterministic checks'}
            </p>
            {validation.violations.length > 0 && (
              <ul className="mt-1 space-y-1 text-xs text-rose-700">
                {validation.violations.map((violation) => (
                  <li key={violation}>• {violation}</li>
                ))}
              </ul>
            )}
            {validation.alternatives.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-neutral-700">Feasible alternatives</p>
                <ul className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {validation.alternatives.map((alternative) => (
                    <li key={`${alternative.room_id}-${alternative.day}-${alternative.start_period}`}>
                      <button
                        type="button"
                        onClick={() => void chooseAlternative(alternative)}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-xs text-neutral-700 hover:border-neutral-400"
                      >
                        <span className="font-semibold">{alternative.room_id}</span> · {alternative.day} P
                        {alternative.start_period}–P{alternative.end_period} · {alternative.type} ·{' '}
                        {alternative.capacity} seats
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validation.ok && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready to submit.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900">
          {user.role === 'admin' || user.role === 'department_coordinator' ? 'Requests' : 'My requests'}
        </h3>
        {submissions.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={CalendarPlus}
              title="No requests yet"
              description="A submitted request is validated first, then waits for an Admin decision."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Request</th>
                  <th className="px-3 py-2">Requester</th>
                  <th className="px-3 py-2">Slot</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-neutral-800">{submission.title}</p>
                      <p className="text-[11px] text-neutral-500">{submission.id}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-600">{submission.requester}</td>
                    <td className="px-3 py-2 text-xs text-neutral-600">
                      {submission.room_id ?? '—'} · {submission.day ?? '—'} P
                      {submission.start_period ?? '—'}–P{submission.end_period ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs capitalize text-neutral-700">{submission.status}</td>
                    <td className="px-3 py-2 text-xs text-neutral-600">{submission.reason ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {submission.status === 'pending' && user.role === 'admin' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void decide(submission, 'approved')}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void decide(submission, 'rejected')}
                            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
