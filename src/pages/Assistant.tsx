import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState, StatusNotice } from '../components/States'
import { BookingDraftForm, type BookingFormOptions } from '../components/BookingDraftForm'
import { useAuth } from '../lib/auth'
import { useOfficial } from '../hooks/useOfficial'
import {
  api,
  type AssistantParseResult,
  type BookingDraft,
  type BookingWindow,
  type BookingValidation,
} from '../lib/api'

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
  const [validation, setValidation] = useState<BookingValidation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

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
    }
  }, [official.dataset])

  if (!user) return null

  const parse = async () => {
    if (text.trim().length < 5) {
      setError('Describe the request in at least a few words.')
      return
    }
    setBusy(true)
    setError(null)
    setFlash(null)
    setValidation(null)
    try {
      const result = await api.assistantParse(text, 'booking', user.username)
      setParsed(result)
      setDraft(toDraft(result))
      setFollowUp(result.follow_up)
    } catch (caught) {
      setParsed(null)
      setDraft(null)
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
    try {
      setValidation(await api.validateBooking({ ...draft, raw_text: text }, user.username))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Validation failed.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const result = await api.submitBooking({ ...draft, raw_text: text }, user.username)
      setFlash({
        tone: 'success',
        message: `${result.request.id} submitted for approval.`,
      })
      setDraft(null)
      setParsed(null)
      setValidation(null)
      setText('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Submission failed.')
    } finally {
      setBusy(false)
    }
  }

  if (official.loading && !official.dataset) {
    return (
      <div>
        <PageHeader title="AI Assistant" subtitle="Natural-language intake with deterministic validation." />
        <LoadingState label="Loading the official dataset…" />
      </div>
    )
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
    <div>
      <PageHeader
        title="AI Assistant"
        subtitle="Describe a request in English or Hinglish. Gemini extracts a draft; the deterministic validator decides what is possible."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}
      {error && <StatusNotice tone="error">{error}</StatusNotice>}

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Sparkles className="h-4 w-4" aria-hidden /> Describe your request
          </h3>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            gemini-3.6-flash · extraction only
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
            {busy ? 'Interpreting…' : 'Interpret request'}
          </button>
          <Link
            to="/manual"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Use the manual form
          </Link>
          <span className="text-[11px] text-neutral-500">
            The assistant never approves or validates. You review every field.
          </span>
        </div>
      </section>

      {followUp.length > 0 && (
        <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">Please clarify</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-800">
            {followUp.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      )}

      {draft && options ? (
        <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
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
            <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs">
              {validation.violations.map((violation) => (
                <p key={violation} className="text-rose-700">
                  • {violation}
                </p>
              ))}
              {validation.alternatives.map((alternative) => (
                <button
                  key={`${alternative.room_id}-${alternative.day}-${alternative.start_period}`}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      requested_room: alternative.room_id,
                      windows: [
                        {
                          day: alternative.day,
                          from_period: alternative.start_period,
                          to_period: alternative.end_period,
                        },
                      ],
                    })
                  }
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
