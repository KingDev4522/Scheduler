import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, StatusNotice } from '../components/States'
import { PageSkeleton } from '../components/Skeletons'
import { BookingDraftForm, type BookingFormOptions } from '../components/BookingDraftForm'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import {
  api,
  type AssistantParseResult,
  type BookingDraft,
  type BookingWindow,
  type BookingValidation,
  type MissingField,
} from '../lib/api'
import { datasetDay } from '../lib/semester'

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

export default function Assistant() {
  const { user } = useAuth()
  const official = useOfficial()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<AssistantParseResult | null>(null)
  const [draft, setDraft] = useState<BookingDraft | null>(null)
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
      const stored = JSON.parse(raw) as { text?: string; parsed?: AssistantParseResult }
      if (stored.parsed) {
        setText(stored.text ?? '')
        setParsed(stored.parsed)
        setDraft(toDraft(stored.parsed))
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
      rooms: rooms.map((room) => ({ id: room.id, name: room.name })),
      semester: official.dataset.semester ?? null,
    }
  }, [official.dataset])

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
        'booking',
        user.username,
        previous as Record<string, unknown> | null,
      )
      setParsed(result)
      setDraft(toDraft(result))
      setFollowUp(result.follow_up)
      setMissing(result.missing ?? [])
    } catch (caught) {
      setParsed(null)
      setDraft(null)
      setMissing([])
      setError(
        `${caught instanceof Error ? caught.message : 'The assistant is unavailable.'} You can still use the manual form.`,
      )
    } finally {
      setBusy(false)
    }
  }

  const validate = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      setValidation(
        await api.validateBooking(
          { ...draft, ...(slot ?? {}), raw_text: text },
          user.username,
        ),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Validation failed.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.submitBooking(
        { ...draft, ...(slot ?? {}), raw_text: text },
        user.username,
      )
      setFlash({
        tone: 'success',
        message: `${result.request.id} submitted for approval.`,
      })
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
        await api.validateBooking(
          { ...nextDraft, ...nextSlot, raw_text: text },
          user.username,
        ),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Validation failed.')
    } finally {
      setBusy(false)
    }
  }

  if (official.loading && !official.dataset) {
    return <PageSkeleton label="Loading the official dataset…" variant="form" rows={4} />
  }

  if (!official.dataset || !options) {
    return (
      <div>
        <PageHeader title="AI Assistant" subtitle="Natural-language intake." />
        <ErrorState
          title="Backend not reachable"
          description={`${official.error ?? 'The scheduling API is offline.'} The manual booking form still works once the API is up.`}
          onRetry={() => void official.refresh()}
        />
      </div>
    )
  }

  return (
    <div className="cit-page">
      <PageHeader
        title="AI Assistant"
        subtitle="Describe a request in English or Hinglish. Gemini extracts a draft; the deterministic validator decides what is possible."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}
      {error && <StatusNotice tone="error">{error}</StatusNotice>}

      <section className="cit-card rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Sparkles className="h-4 w-4" aria-hidden /> Describe your request
          </h3>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            {modelInfo
              ? modelInfo.configured
                ? `${modelInfo.model} · extraction only`
                : 'local-rules fallback · extraction only'
              : 'checking model…'}
          </span>
        </div>
        <label htmlFor="assistant-text" className="mt-3 block text-xs font-medium text-neutral-600">
          Request text
        </label>
        <textarea
          id="assistant-text"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void parse()}
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Interpreting…' : draft ? 'Refine draft' : 'Interpret request'}
          </button>
          <Link
            to="/manual"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Use the manual form
          </Link>
          {(draft || text) && (
            <button
              type="button"
              onClick={() => {
                setText('')
                setDraft(null)
                setParsed(null)
                setMissing([])
                setFollowUp([])
                setValidation(null)
                setSlot(null)
                setClarification('')
                setFlash(null)
                setError(null)
              }}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Start over
            </button>
          )}
          <span className="text-[11px] text-neutral-500">
            The assistant never approves or validates. You review every field.
          </span>
        </div>
      </section>

      {(missing.length > 0 || followUp.length > 0) && (
        <section className="cit-anim-pop mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">
            {missing.length > 0
              ? `Fill these ${missing.length} item${missing.length === 1 ? '' : 's'} — all at once`
              : 'Please clarify'}
          </p>
          {missing.length > 0 ? (
            <ul className="mt-1 space-y-1 text-xs text-amber-800">
              {missing.map((item) => (
                <li key={`${item.field}-${item.question}`} className="flex flex-wrap items-baseline gap-1.5">
                  <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                    {item.field.replace(/_/g, ' ')}
                  </span>
                  <span>{item.question}</span>
                  {item.options && item.options.length > 0 && (
                    <span className="text-amber-700/80">({item.options.slice(0, 6).join(', ')})</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-800">
              {followUp.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={clarification}
              onChange={(event) => setClarification(event.target.value)}
              placeholder="Answer the question or add the missing detail"
              className="min-w-[14rem] flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400"
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
              className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Apply clarification
            </button>
          </div>
        </section>
      )}

      {draft && options ? (
        <section className="cit-anim-pop mt-4 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">Editable draft</h3>
            <span className="text-[11px] text-neutral-500">
              {parsed ? `source: ${parsed.model}` : 'manual edit'}
            </span>
          </div>
          <div className="mt-4">
            <BookingDraftForm
              draft={draft}
              options={options}
              onChange={(next) => {
                setDraft(next)
                setSlot(null)
                setValidation(null)
              }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void validate()}
              disabled={busy}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
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
          </div>

          {validation && (
            <div className="cit-anim-pop mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs">
              {validation.violations.map((violation) => (
                <p key={violation} className="text-rose-700">
                  • {violation}
                </p>
              ))}
              {validation.alternatives.map((alternative) => (
                <button
                  key={`${alternative.room_id}-${alternative.day}-${alternative.start_period}`}
                  type="button"
                  onClick={() => void chooseAlternative(alternative)}
                  className="mr-2 mt-1 rounded border border-neutral-200 bg-white px-2 py-1 text-left text-neutral-700"
                >
                  Use {alternative.room_id} · {alternative.day} P{alternative.start_period}
                </button>
              ))}
              {validation.ok && (
                <p className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready to submit.
                </p>
              )}
            </div>
          )}
        </section>
      ) : (
        !busy && (
          <div className="mt-4">
            <EmptyState
              icon={Sparkles}
              title="No draft yet"
              description="Describe the request above, then review and edit the extracted fields before validating."
            />
          </div>
        )
      )}
    </div>
  )
}
