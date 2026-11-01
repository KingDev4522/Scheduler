import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import { useAvailability } from '../hooks/useAvailability'
import { buildOfficialView } from '../lib/official'
import { sessionDepartment } from '../lib/departments'
import { cn } from '../lib/utils'
import {
  api,
  type AssistantParseResult,
  type BookingDraft,
  type BookingWindow,
  type BookingValidation,
  type MissingField,
} from '../lib/api'
import { datasetDay } from '../lib/semester'
import { EmptyState, ErrorState, StatusNotice } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { BookingDraftForm, type BookingFormOptions } from '../components/BookingDraftForm'
import { SessionChangeForm, type SessionChangeInitial } from '../components/SessionChangeForm'
import { PeriodTape } from '../components/PeriodTape'
import { FormSection, fieldTextarea } from '../components/FormBits'

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toDraft(parsed: AssistantParseResult): BookingDraft {
  const raw = parsed.draft as Record<string, unknown>
  const windows = Array.isArray(raw.windows)
    ? (raw.windows as BookingWindow[]).filter(
        (window) =>
          typeof window?.day === 'string' &&
          typeof window?.from_period === 'number' &&
          typeof window?.to_period === 'number',
      )
    : []
  return {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Assistant request',
    request_reason: typeof raw.request_reason === 'string' ? raw.request_reason : '',
    attendance: typeof raw.attendance === 'number' ? raw.attendance : null,
    duration_periods: typeof raw.duration_periods === 'number' ? raw.duration_periods : null,
    windows,
    dates: asStringArray(raw.dates),
    room_types: asStringArray(raw.room_types),
    needs: asStringArray(raw.needs),
    requested_room: typeof raw.requested_room === 'string' ? raw.requested_room : null,
    mandatory_for_groups: asStringArray(raw.mandatory_for_groups),
  }
}

type AssistantMode = 'booking' | 'change'

export default function Assistant() {
  const { user } = useAuth()
  const official = useOfficial()
  const isFaculty = user?.role === 'faculty'
  const isClub = user?.role === 'event_manager'
  const isAdmin = user?.role === 'admin'
  const isCoordinator = user?.role === 'department_coordinator'
  const availableModes: AssistantMode[] = isFaculty ? ['change'] : isClub ? ['booking'] : ['booking', 'change']
  const [mode, setMode] = useState<AssistantMode>(isFaculty ? 'change' : 'booking')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<AssistantParseResult | null>(null)
  const [draft, setDraft] = useState<BookingDraft | null>(null)
  const [changeDraft, setChangeDraft] = useState<SessionChangeInitial | null>(null)
  const [followUp, setFollowUp] = useState<string[]>([])
  const [missing, setMissing] = useState<MissingField[]>([])
  const [validation, setValidation] = useState<BookingValidation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [slot, setSlot] = useState<{ room_id: string; day: string; start_period: number } | null>(null)
  const [clarification, setClarification] = useState('')
  const [modelInfo, setModelInfo] = useState<{
    configured: boolean
    model: string
    models?: string[]
    fallback?: string
  } | null>(null)

  useEffect(() => {
    if (!user) return undefined
    let active = true
    api
      .assistantStatus(user.username)
      .then((value) => {
        if (active) setModelInfo(value)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    const raw = sessionStorage.getItem('cit-assistant-draft')
    if (!raw) return
    sessionStorage.removeItem('cit-assistant-draft')
    try {
      const stored = JSON.parse(raw) as {
        text?: string
        parsed?: AssistantParseResult
        kind?: string
      }
      if (stored.parsed) {
        const isChange =
          stored.kind === 'change' ||
          typeof (stored.parsed.draft as Record<string, unknown>)?.kind === 'string'
        setText(stored.text ?? '')
        setParsed(stored.parsed)
        if (isChange) {
          setMode('change')
          setChangeDraft(stored.parsed.draft as SessionChangeInitial)
          setDraft(null)
        } else {
          setMode('booking')
          setDraft(toDraft(stored.parsed))
          setChangeDraft(null)
        }
        setFollowUp(stored.parsed.follow_up ?? [])
        setMissing(stored.parsed.missing ?? [])
      }
    } catch {
      /* ignore malformed handoff */
    }
  }, [])

  const options: BookingFormOptions | null = useMemo(() => {
    if (!official.dataset) return null
    const rooms = official.dataset.entities.rooms
    return {
      days: official.dataset.entities.calendar.days,
      roomTypes: Array.from(new Set(rooms.map((room) => room.type))).sort(),
      needs: Array.from(new Set(rooms.flatMap((room) => room.features))).concat('accessible').sort(),
      groups: official.dataset.entities.student_groups.map((group) => group.id),
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        type: room.type,
        accessible: room.accessible,
        features: room.features,
      })),
      semester: official.dataset.semester ?? null,
    }
  }, [official.dataset])

  const officialView = useMemo(
    () =>
      official.dataset && official.schedule
        ? buildOfficialView(official.dataset, official.schedule)
        : null,
    [official.dataset, official.schedule],
  )
  const data = officialView?.data
  const facultyFocus = useMemo(() => {
    if (!user || user.role !== 'faculty') return undefined
    const last = user.displayName.split(' ').slice(-1)[0]?.toLowerCase() ?? ''
    return data?.faculty.find((member) => member.name.toLowerCase().includes(last))
  }, [data?.faculty, user])
  const changeSessions = useMemo(() => {
    if (!data) return []
    if (isFaculty) return data.sessions.filter((session) => session.facultyId === facultyFocus?.id)
    if (isCoordinator) {
      return data.sessions.filter(
        (session) => sessionDepartment(official.dataset, session.id) === user?.department,
      )
    }
    return data.sessions
  }, [data, isFaculty, isCoordinator, facultyFocus?.id, official.dataset, user?.department])
  const { checks, loading: availabilityLoading } = useAvailability(draft, user, mode === 'booking')

  useEffect(() => {
    if (!availableModes.includes(mode)) setMode(availableModes[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  if (!user) return null

  // The current draft is sent as context so a follow-up answer merges into it
  // instead of replacing everything the assistant already understood.
  const parse = async (input: string = text, previous: BookingDraft | null = draft) => {
    if (input.trim().length < 5) {
      setError('Describe the request in at least a few words.')
      return
    }
    setBusy(true)
    setError(null)
    setFlash(null)
    setValidation(null)
    setSlot(null)
    try {
      const result = await api.assistantParse(
        input,
        mode,
        user.username,
        mode === 'booking' ? (previous as Record<string, unknown> | null) : null,
      )
      setParsed(result)
      if (mode === 'booking') {
        setDraft(toDraft(result))
        setChangeDraft(null)
      } else {
        setChangeDraft({
          ...(result.draft as SessionChangeInitial),
          request_reason:
            (result.draft as Record<string, unknown>)?.request_reason as string | undefined,
        })
        setDraft(null)
      }
      setFollowUp(result.follow_up)
      setMissing(result.missing ?? [])
    } catch (caught) {
      setParsed(null)
      setDraft(null)
      setChangeDraft(null)
      setMissing([])
      setError(
        `${caught instanceof Error ? caught.message : 'The assistant is unavailable.'} You can still use the manual form.`,
      )
    } finally {
      setBusy(false)
    }
  }

  const validate = async (): Promise<BookingValidation | null> => {
    if (!draft) return null
    setBusy(true)
    setError(null)
    try {
      const result = await api.validateBooking(
        { ...draft, ...(slot ?? {}), raw_text: text },
        user.username,
      )
      setValidation(result)
      return result
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Validation failed.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const submitNow = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.submitBooking({ ...draft, ...(slot ?? {}), raw_text: text }, user.username)
      setFlash({ tone: 'success', message: `${result.request.id} submitted for approval.` })
      setDraft(null)
      setParsed(null)
      setValidation(null)
      setSlot(null)
      setMissing([])
      setFollowUp([])
      setText('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Submission failed.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!draft) {
      setError('There is no draft yet. Describe the request above or use the manual form.')
      return
    }
    if (!draft.request_reason?.trim()) {
      setError('Add a short reason for this request. The approver sees it, so it cannot be blank.')
      return
    }
    if (validation?.ok) {
      await submitNow()
      return
    }
    const result = await validate()
    if (result?.ok) {
      await submitNow()
      return
    }
    if (result) {
      setError(
        result.alternatives.length > 0
          ? 'No exact slot is selected yet. Choose one of the feasible alternatives below, then submit again.'
          : 'This request does not pass the hard checks yet. Fix the listed issues and submit again.',
      )
    }
  }

  const chooseAlternative = async (alternative: BookingValidation['alternatives'][number]) => {
    if (!draft) return
    const nextDraft = {
      ...draft,
      requested_room: alternative.room_id,
      dates: (draft.dates ?? []).filter((iso) => datasetDay(iso) === alternative.day),
      duration_periods: alternative.end_period - alternative.start_period + 1,
      windows: [
        {
          day: alternative.day,
          from_period: alternative.start_period,
          to_period: alternative.end_period,
        },
      ],
    }
    const nextSlot = {
      room_id: alternative.room_id,
      day: alternative.day,
      start_period: alternative.start_period,
    }
    setDraft(nextDraft)
    setSlot(nextSlot)
    setBusy(true)
    setError(null)
    try {
      setValidation(
        await api.validateBooking({ ...nextDraft, ...nextSlot, raw_text: text }, user.username),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Validation failed.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setText('')
    setDraft(null)
    setChangeDraft(null)
    setParsed(null)
    setMissing([])
    setFollowUp([])
    setValidation(null)
    setSlot(null)
    setClarification('')
    setFlash(null)
    setError(null)
  }

  if (official.loading && !official.dataset) {
    return <PageSkeleton label="Loading the official dataset…" variant="form" rows={4} />
  }

  if (!official.dataset || !options) {
    return (
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">AI Assistant</h2>
        <div className="mt-4">
          <ErrorState
            title="Backend not reachable"
            description={`${official.error ?? 'The scheduling API is offline.'} The manual booking form still works once the API is up.`}
            onRetry={() => void official.refresh()}
          />
        </div>
      </div>
    )
  }

  const modelLabel = modelInfo
    ? modelInfo.configured
      ? `${modelInfo.model} · extraction only`
      : 'local-rules fallback · extraction only'
    : 'checking model'

  const modeLabel = (value: AssistantMode) =>
    value === 'booking' ? (isCoordinator ? 'Department event' : 'Event booking') : 'Session change'

  return (
    <div className="cit-page">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">AI Assistant</h2>
          <p className="mt-1 max-w-[56ch] text-[14px] leading-relaxed text-slate-600">
            Describe the request in English or Hinglish. The model extracts a draft, Python checks
            every hard rule, and you review each field before anything is submitted.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/manual"
            className="hidden h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          >
            Manual form
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
          <StatusNotice tone={flash.tone}>
            {flash.message}
            {flash.tone === 'success' ? (
              <>
                {' '}
                <Link to="/approvals" className="font-medium underline">
                  Track it in Approvals
                </Link>
              </>
            ) : null}
          </StatusNotice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <StatusNotice tone="error">{error}</StatusNotice>
        </div>
      ) : null}

      {availableModes.length > 1 ? (
        <div className="mt-4 flex gap-5 border-b border-slate-200">
          {availableModes.map((option) => {
            const active = mode === option
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setMode(option)
                  reset()
                }}
                className={cn(
                  '-mb-px border-b-2 pb-2.5 pt-1 text-[13px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950',
                  active
                    ? 'border-neutral-900 font-medium text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {modeLabel(option)}
              </button>
            )
          })}
        </div>
      ) : null}

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 px-5 py-3">
          <h3 className="text-[15px] font-semibold text-slate-900">Describe your request</h3>
          <p className="text-[12px] text-slate-500">{modelLabel}</p>
        </div>
        <div className="px-5 py-4">
          <FormSection title="In your own words">
            <label htmlFor="assistant-text" className="sr-only">
              Request text
            </label>
            <textarea
              id="assistant-text"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                mode === 'change'
                  ? 'e.g. Move CS201 from Monday P3 to Tuesday P6, room LT-2'
                  : 'e.g. seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye'
              }
              className={fieldTextarea}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void parse()}
                disabled={busy}
                className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                {busy
                  ? 'Interpreting…'
                  : mode === 'change'
                    ? changeDraft
                      ? 'Refine change'
                      : 'Interpret change'
                    : draft
                      ? 'Refine draft'
                      : 'Interpret request'}
              </button>
              {(draft || text || changeDraft) && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-400"
                >
                  Start over
                </button>
              )}
              <span className="text-[12px] text-slate-500">
                The assistant never approves or validates.
              </span>
            </div>
          </FormSection>
        </div>
      </section>

      {(missing.length > 0 || followUp.length > 0) && (
        <section className="cit-anim-pop mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[13px] font-semibold text-amber-900">
            {missing.length > 0
              ? `${missing.length} detail${missing.length === 1 ? '' : 's'} still needed`
              : 'Please clarify'}
          </p>
          {missing.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {missing.map((item) => (
                <li key={`${item.field}-${item.question}`} className="text-[12px] leading-relaxed text-amber-900">
                  <span className="font-medium">{item.field.replace(/_/g, ' ')}</span> · {item.question}
                  {item.options && item.options.length > 0 ? (
                    <span className="text-amber-800"> ({item.options.slice(0, 6).join(', ')})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {followUp.map((question) => (
                <li key={question} className="text-[12px] leading-relaxed text-amber-900">
                  {question}
                </li>
              ))}
            </ul>
          )}
          {parsed?.fallback_reason ? (
            <p className="mt-1 text-[12px] break-words text-amber-800">
              {parsed.fallback_reason.slice(0, 220)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={clarification}
              onChange={(event) => setClarification(event.target.value)}
              placeholder="Answer the question or add the missing detail"
              className="h-9 min-w-[14rem] flex-1 rounded-lg border border-amber-300 bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-300"
            />
            <button
              type="button"
              onClick={() => {
                const next = `${text}\n${clarification}`.trim()
                if (next.length < 5) return
                setText(next)
                setClarification('')
                void parse(next, draft)
              }}
              disabled={busy || clarification.trim().length === 0}
              className="h-9 rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              Apply clarification
            </button>
          </div>
        </section>
      )}

      {mode === 'booking' && draft && options ? (
        <section className="cit-anim-pop mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 px-5 py-3">
            <h3 className="text-[15px] font-semibold text-slate-900">Editable draft</h3>
            <p className="text-[12px] text-slate-500">
              {parsed ? `source: ${parsed.model}` : 'edited by hand'}
            </p>
          </div>
          <div className="px-5 py-4">
            <BookingDraftForm
              draft={draft}
              options={options}
              showGroups={isAdmin}
              availability={checks}
              availabilityLoading={availabilityLoading}
              onChange={(next) => {
                setDraft(next)
                setSlot(null)
                setValidation(null)
              }}
            />

            {validation ? (
              <div className="cit-anim-pop mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p
                  className={cn(
                    'text-[13px] font-semibold',
                    validation.ok ? 'text-emerald-800' : 'text-rose-800',
                  )}
                >
                  {validation.ok ? 'Every hard check passes' : 'Blocked by hard checks'}
                </p>
                {validation.violations.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {validation.violations.map((violation) => (
                      <li key={violation} className="text-[12px] text-rose-800">
                        {violation}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {validation.alternatives.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[12px] text-slate-500">Slots that would work</p>
                    <ul className="mt-1.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {validation.alternatives.map((alternative) => (
                        <li key={`${alternative.room_id}-${alternative.day}-${alternative.start_period}`}>
                          <button
                            type="button"
                            onClick={() => void chooseAlternative(alternative)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-300"
                          >
                            <span className="block text-[12px] text-slate-800">
                              <span className="font-medium">{alternative.room_id}</span>
                              <span className="text-slate-500">
                                {' · '}
                                {alternative.day} P{alternative.start_period}–P{alternative.end_period}
                              </span>
                            </span>
                            <span className="mt-1 block text-[12px] text-slate-500">
                              {alternative.type.replace(/_/g, ' ')} · {alternative.capacity} seats
                            </span>
                            <span className="mt-1.5 block">
                              <PeriodTape
                                from={alternative.start_period}
                                to={alternative.end_period}
                                tone="granted"
                              />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit for approval
            </button>
            <button
              type="button"
              onClick={() => void validate()}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-400 disabled:opacity-50"
            >
              Check the slot
            </button>
            <p className="text-[12px] text-slate-500">
              {validation?.ok
                ? 'A validated slot is chosen.'
                : 'Submitting validates first; pick a feasible slot if none is selected.'}
            </p>
          </div>
        </section>
      ) : mode === 'change' && options ? (
        <section className="cit-anim-pop mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 px-5 py-3">
            <h3 className="text-[15px] font-semibold text-slate-900">Change draft</h3>
            <p className="text-[12px] text-slate-500">
              {parsed ? `source: ${parsed.model}` : 'picked by hand'}
            </p>
          </div>
          <div className="px-5 py-4">
            <SessionChangeForm
              key={JSON.stringify(changeDraft)}
              user={user}
              sessions={changeSessions}
              rooms={options.rooms}
              semester={options.semester}
              initial={changeDraft}
            />
          </div>
        </section>
      ) : !busy ? (
        <div className="mt-4">
          <EmptyState
            title={mode === 'change' ? 'No change draft yet' : 'No draft yet'}
            description={
              mode === 'change'
                ? 'Describe the change above, or pick a session directly in the change form.'
                : 'Describe the request above, then review and edit the extracted fields before validating.'
            }
          />
        </div>
      ) : null}
    </div>
  )
}
