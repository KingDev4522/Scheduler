import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Download, Loader2, Play, RotateCcw, Upload } from 'lucide-react'
import { useOfficial } from '../hooks/useOfficial'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { StatusNotice } from './States'
import { Bone } from './Skeletons'

export function OfficialBackendPanel() {
  const official = useOfficial()
  const { user } = useAuth()
  const navigate = useNavigate()
  const datasetInput = useRef<HTMLInputElement>(null)
  const disruptionInput = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const connected = official.health !== null

  if (official.loading && !official.dataset) {
    return (
      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Bone className="h-4 w-56" />
            <Bone className="h-3 w-72 max-w-full" />
          </div>
          <Bone className="h-6 w-20 rounded-full" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Bone className="h-9 w-52 rounded-lg" />
          <Bone className="h-9 w-36 rounded-lg" />
          <Bone className="h-9 w-36 rounded-lg" />
          <Bone className="h-9 w-32 rounded-lg" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Bone key={index} className="h-12 w-full rounded" />
          ))}
        </div>
      </section>
    )
  }

  const generate = async () => {
    const result = await official.generate()
    if (!result) return
    setToast(
      `Official schedule ready · ${result.sessions} sessions · ${result.exams} exams · ${result.summary.hard_violation_count} hard violations`,
    )
    window.setTimeout(() => {
      setToast(null)
      const doc = document as Document & {
        startViewTransition?: (callback: () => void) => void
      }
      if (doc.startViewTransition) {
        doc.startViewTransition(() => navigate('/official'))
      } else {
        navigate('/official')
      }
    }, 1200)
  }

  const download = async (name: string) => {
    if (!user) return
    setDownloadError(null)
    try {
      await api.downloadExport(name, user.username)
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : `Could not download ${name}.`,
      )
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            {connected ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
            )}
            Official engine · CP-SAT backend
          </h3>
          <p className="mt-1 text-xs text-neutral-600">
            {connected
              ? `${official.dataset?.dataset_id ?? 'dataset'} · ${official.dataset?.institute ?? ''} · ${
                  official.schedule ? 'schedule generated' : 'ready to generate'
                }`
              : 'Not connected. Start it with: python -m uvicorn backend.app:app --port 8000'}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {connected ? 'connected' : 'offline'}
        </span>
      </div>

      {official.error && <div className="mt-3"><StatusNotice tone="error">{official.error}</StatusNotice></div>}

      <input
        ref={datasetInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Upload cit_public.json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void (async () => {
              const result = await official.uploadDataset(file)
              if (result) {
                setToast(`Dataset imported · ${result.dataset_id} · ${result.counts.sessions} sessions`)
                window.setTimeout(() => setToast(null), 3500)
              }
            })()
          }
          event.target.value = ''
        }}
      />
      <input
        ref={disruptionInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Upload a disruption JSON file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void (async () => {
              const result = await official.uploadDisruption(file)
              if (result) {
                setToast(`Repair proposal built · ${result.moved} moved · ${result.summary.hard_violation_count} hard violations`)
                window.setTimeout(() => setToast(null), 3500)
              }
            })()
          }
          event.target.value = ''
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!connected || official.busy}
          onClick={() => void generate()}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {official.busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {official.busy ? 'Solving…' : 'Generate official schedule'}
        </button>
        <button
          type="button"
          disabled={!connected || official.busy}
          onClick={() => datasetInput.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" aria-hidden /> Upload dataset
        </button>
        <button
          type="button"
          disabled={!connected || official.busy || !official.schedule}
          onClick={() => disruptionInput.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" aria-hidden /> Apply disruption
        </button>
        <button
          type="button"
          disabled={!connected || official.busy}
          onClick={() => {
            if (window.confirm('Reset the backend dataset and clear generated artifacts, submissions and change requests?')) {
              void (async () => {
                await official.reset()
                setToast('Backend reset · bundled dataset restored')
                window.setTimeout(() => setToast(null), 3500)
              })()
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset backend
        </button>
        {official.schedule && (
          <>
            <button
              type="button"
              onClick={() => void download('schedule.json')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
            >
              <Download className="h-3 w-3" aria-hidden /> schedule.json
            </button>
            {official.schedule.proposal_status === 'approved' ? (
              <button
                type="button"
                onClick={() => void download('schedule_after.json')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
              >
                <Download className="h-3 w-3" aria-hidden /> schedule_after.json
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">
                schedule_after.json after Admin approval
              </span>
            )}
          </>
        )}
      </div>

      {downloadError && (
        <div className="mt-3">
          <StatusNotice tone="error">{downloadError}</StatusNotice>
        </div>
      )}

      {official.dataset && (
        <dl className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(official.dataset.counts).map(([key, value]) => (
            <div key={key} className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5">
              <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{key}</dt>
              <dd className="text-sm font-semibold text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {official.generateResult && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-semibold">
            Generated {official.generateResult.sessions} sessions and {official.generateResult.exams}{' '}
            exams · {official.generateResult.summary.hard_violation_count} hard violations
          </p>
          <p className="mt-1">
            Soft penalty {official.generateResult.summary.soft_total} · booking score{' '}
            {official.generateResult.booking_score} · policy {official.generateResult.policy_version}
          </p>
          <p className="mt-1 text-emerald-800">
            Open <span className="font-semibold">Official Data</span> in the sidebar to inspect the
            timetable, exams, decisions and diff.
          </p>
        </div>
      )}

      {official.disruptionResult && (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
          <p className="font-semibold">
            Disruption applied · {official.disruptionResult.moved} sessions moved (
            {official.disruptionResult.time_changed} time,{' '}
            {official.disruptionResult.room_only_changed} room-only) ·{' '}
            {official.disruptionResult.summary.hard_violation_count} hard violations ·{' '}
            {official.disruptionResult.minimal ? 'minimal' : 'above minimum'}
          </p>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-6 right-6 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-2xl"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-slate-900">Official engine</p>
              <p className="mt-0.5 text-xs text-slate-600">{toast}</p>
              <p className="mt-1 text-[11px] font-medium text-emerald-700">
                Backend state refreshed.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
