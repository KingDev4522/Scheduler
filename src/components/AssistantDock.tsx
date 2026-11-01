import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { api, type AssistantParseResult } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Particles } from './Particles'

interface SpeechResult {
  0: { transcript: string }
  isFinal: boolean
  length: number
}

interface SpeechEvent {
  results: ArrayLike<SpeechResult>
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => RecognitionLike

const ROUTES: { words: string[]; path: string }[] = [
  { words: ['official data', 'official'], path: '/official' },
  { words: ['timetable', 'timetables', 'schedule grid'], path: '/timetables' },
  { words: ['room', 'rooms', 'venue finder'], path: '/rooms' },
  { words: ['manual booking', 'manual form'], path: '/manual' },
  { words: ['booking', 'bookings', 'spectra'], path: '/bookings' },
  { words: ['assistant'], path: '/assistant' },
  { words: ['exam', 'exams'], path: '/exams' },
  { words: ['change', 'changes', 'reschedule'], path: '/changes' },
  { words: ['approval', 'approvals', 'inbox'], path: '/approvals' },
  { words: ['admin', 'import', 'export'], path: '/admin' },
  { words: ['help'], path: '/help' },
  { words: ['dashboard', 'home'], path: '/dashboard' },
]

function recognitionCtor(): RecognitionCtor | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

function draftSummary(parsed: AssistantParseResult): string[] {
  const raw = parsed.draft as Record<string, unknown>
  const lines: string[] = []
  if (typeof raw.kind === 'string') {
    lines.push(`Change: ${raw.kind.replace(/_/g, ' ')}`)
    if (typeof raw.session_id === 'string' && raw.session_id) lines.push(`Session: ${raw.session_id}`)
    if (typeof raw.course_id === 'string' && raw.course_id) lines.push(`Course: ${raw.course_id}`)
    if (typeof raw.day === 'string' || typeof raw.start_period === 'number') {
      lines.push(`Target: ${raw.day ?? '—'} P${raw.start_period ?? '—'}`)
    }
    if (typeof raw.room_id === 'string' && raw.room_id) lines.push(`Room: ${raw.room_id}`)
    return lines
  }
  if (typeof raw.title === 'string') lines.push(`Title: ${raw.title}`)
  if (typeof raw.attendance === 'number') lines.push(`Attendance: ${raw.attendance}`)
  if (typeof raw.duration_periods === 'number') lines.push(`Duration: ${raw.duration_periods} periods`)
  if (Array.isArray(raw.windows) && raw.windows.length > 0) {
    lines.push(
      `Window: ${raw.windows
        .map((window) => {
          const item = window as { day?: string; from_period?: number; to_period?: number }
          return `${item.day ?? '?'} P${item.from_period ?? '?'}–P${item.to_period ?? '?'}`
        })
        .join(', ')}`,
    )
  }
  if (typeof raw.request_reason === 'string' && raw.request_reason.trim()) {
    lines.push(`Reason: ${raw.request_reason}`)
  }
  if (Array.isArray(raw.dates) && raw.dates.length > 0) {
    lines.push(`Date(s): ${raw.dates.filter((value) => typeof value === 'string').join(', ')}`)
  }
  if (Array.isArray(raw.room_types) && raw.room_types.length > 0) {
    lines.push(`Room types: ${raw.room_types.join(', ')}`)
  }
  if (Array.isArray(raw.needs) && raw.needs.length > 0) lines.push(`Needs: ${raw.needs.join(', ')}`)
  return lines
}

export function AssistantDock() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'voice' | 'type'>('voice')
  const [isMobile, setIsMobile] = useState(false)
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<AssistantParseResult | null>(null)
  const [parsedText, setParsedText] = useState('')
  const [followUp, setFollowUp] = useState<string[]>([])
  const [voiceReplies, setVoiceReplies] = useState(true)
  const recognitionRef = useRef<RecognitionLike | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => {
      setIsMobile(media.matches)
      if (media.matches) {
        setMode('type')
        recognitionRef.current?.stop()
      }
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      recognitionRef.current?.stop()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const speak = useCallback(
    (message: string) => {
      if (!voiceReplies || typeof window.speechSynthesis === 'undefined') return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.rate = 1
      window.speechSynthesis.speak(utterance)
    },
    [voiceReplies],
  )

  const startListening = useCallback(() => {
    if (isMobile) {
      setMode('type')
      setError('Voice is off on mobile. Type the request below.')
      return
    }
    const Ctor = recognitionCtor()
    if (!Ctor) {
      setMode('type')
      setError('Voice input is not supported in this browser. Type instead.')
      return
    }
    const recognition = new Ctor()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript
      }
      setText(transcript)
    }
    recognition.onerror = () => {
      setMode('type')
      setError('The microphone could not be used. Type the request instead.')
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setError(null)
    setListening(true)
    try {
      recognition.start()
    } catch {
      setMode('type')
      setError('Voice input could not start. Type the request instead.')
      setListening(false)
    }
  }, [isMobile])

  const openOverlay = () => {
    setOpen(true)
    setError(null)
    setParsed(null)
    setParsedText('')
    setFollowUp([])
    if (isMobile) {
      setMode('type')
      return
    }
    setMode('voice')
    startListening()
  }

  const closeOverlay = () => {
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
    setOpen(false)
  }

  if (!user) return null

  const navigateFor = (value: string): boolean => {
    const lower = value.toLowerCase()
    if (!/\b(open|show|go to|navigate|take me)\b/.test(lower)) return false
    if (/\b(book|need|people|attendees|chahiye|reserve|for \d+)\b/.test(lower)) return false
    const route = ROUTES.find((entry) => entry.words.some((word) => lower.includes(word)))
    if (!route) return false
    navigate(route.path)
    setOpen(false)
    setText('')
    speak(`Opening ${route.path === '/' ? 'dashboard' : route.path.replace('/', '')}.`)
    return true
  }

  const send = async () => {
    const value = text.trim()
    if (value.length < 3) {
      setError('Say or type a request first.')
      return
    }
    if (navigateFor(value)) return
    recognitionRef.current?.stop()
    setBusy(true)
    setError(null)
    setParsed(null)
    setParsedText('')
    setFollowUp([])
    try {
      // Faculty request schedule changes; only venue roles get a booking draft.
      const kind = user.role === 'faculty' ? 'change' : 'booking'
      const result = await api.assistantParse(value, kind, user.username)
      setParsed(result)
      setParsedText(value)
      setFollowUp(result.follow_up)
      speak(result.follow_up.length ? result.follow_up[0] : 'Draft ready. Review it before submitting.')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `${caught.message} You can use the manual booking form instead.`
          : 'The assistant is unavailable. Use the manual form.',
      )
      setMode('type')
    } finally {
      setBusy(false)
    }
  }

  const review = () => {
    if (!parsed) return
    sessionStorage.setItem(
      'cit-assistant-draft',
      JSON.stringify({
        text: parsedText || text,
        parsed,
        kind: user.role === 'faculty' ? 'change' : 'booking',
        at: Date.now(),
      }),
    )
    navigate('/assistant')
    setOpen(false)
  }

  const draftIsCurrent = Boolean(parsed && parsedText === text.trim())

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          key="assistant-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Assistant"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
          className="cit-assistant-overlay fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-950/80 dark:bg-black/85"
        >
          <div className="relative z-10 flex justify-end p-4 md:p-6">
            <h2 className="sr-only">Assistant</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setVoiceReplies((value) => {
                    if (value) window.speechSynthesis?.cancel()
                    return !value
                  })
                }}
                aria-label={voiceReplies ? 'Disable spoken replies' : 'Enable spoken replies'}
                className="rounded-full border border-white/20 bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                {voiceReplies ? (
                  <Volume2 className="h-4 w-4" aria-hidden />
                ) : (
                  <VolumeX className="h-4 w-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={closeOverlay}
                aria-label="Close assistant"
                className="rounded-full border border-white/20 bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* The animation is the overlay: no panel, no backdrop. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.05, ease: 'easeOut' }}
            className="relative z-10 flex min-h-0 flex-1 items-center justify-center"
          >
            <Particles shape="Circle" grain="Fine" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.08, ease: 'easeOut' }}
            className="relative z-10 mx-auto mb-4 w-[min(94vw,34rem)] rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
                {!isMobile && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('voice')
                      startListening()
                    }}
                    aria-pressed={mode === 'voice'}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === 'voice' ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5" aria-hidden /> Voice
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    recognitionRef.current?.stop()
                    setMode('type')
                  }}
                  aria-pressed={mode === 'type'}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === 'type' ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  Type
                </button>
              </div>
              <span className="text-[12px] text-neutral-500">
                {isMobile
                  ? 'Voice is off on mobile.'
                  : mode === 'voice'
                    ? listening
                      ? 'Listening…'
                      : 'Tap Voice to speak.'
                    : 'Type your request.'}
              </span>
            </div>

            {mode === 'type' || isMobile ? (
              <textarea
                rows={3}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  user.role === 'faculty'
                    ? 'e.g. Move CS201 from Monday P3 to Tuesday P6, room LT-2'
                    : 'e.g. Need a room for 45 people on Tuesday 6 to 8 pm, projector please.'
                }
                className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400"
              />
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-center">
                <p className="text-sm text-neutral-700">
                  {listening
                    ? 'Listening… speak now.'
                    : text || 'Tap the microphone and describe your request.'}
                </p>
                <button
                  type="button"
                  onClick={listening ? () => recognitionRef.current?.stop() : startListening}
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold ${
                    listening ? 'bg-rose-600 text-white' : 'bg-neutral-900 text-white'
                  }`}
                >
                  {listening ? (
                    <MicOff className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Mic className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {listening ? 'Stop listening' : 'Start listening'}
                </button>
              </div>
            )}

            {user.role === 'faculty' && (
              <p className="mt-1 text-[12px] text-neutral-500">
                Faculty requests are schedule changes; venue booking is disabled for this role.
              </p>
            )}

            {error && (
              <div role="alert" className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => void send()}
                  className="mt-1 rounded-md border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700"
                >
                  Try again
                </button>
              </div>
            )}

            {followUp.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                {followUp.slice(0, 3).map((question) => (
                  <li key={question}>• {question}</li>
                ))}
              </ul>
            )}

            {parsed && (
              <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
                <p className="text-[11px] font-semibold text-neutral-800">Draft</p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-neutral-600">
                  {draftSummary(parsed).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {parsed.source !== 'gemini' && (
                  <div className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[12px] text-amber-800">
                    <p>Gemini is temporarily unavailable — parsed locally. Review every field.</p>
                    {parsed.fallback_reason && (
                      <p className="mt-0.5 break-words text-[11px] opacity-80">
                        {parsed.fallback_reason.slice(0, 220)}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={review}
                    className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                  >
                    Review &amp; edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/manual')
                      setOpen(false)
                    }}
                    className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700"
                  >
                    Manual form
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // A completed draft must never re-call Gemini; go to review.
                  if (draftIsCurrent) {
                    review()
                    return
                  }
                  void send()
                }}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {draftIsCurrent ? (
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden />
                )}
                {busy
                  ? 'Interpreting…'
                  : draftIsCurrent
                    ? 'Review & continue'
                    : parsed
                      ? 'Re-interpret'
                      : 'Interpret'}
              </button>
              <span className="text-[12px] text-neutral-400">
                Nothing is submitted until you review and confirm on the Assistant page.
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="assistant-launcher"
          initial={{ opacity: 0, scale: 0.82, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.82, y: 12 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-50 flex justify-center"
        >
          <div className="relative rounded-full">
            <button
              type="button"
              onClick={openOverlay}
              aria-label="Open the assistant"
              title="Ask the assistant"
              className="pointer-events-auto relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#0f172a] text-white ring-1 ring-white/15 transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
            >
              <Sparkles className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
