import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useOfficial } from '../hooks/useOfficial'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/utils'
import { StatusNotice } from './States'
import { Bone } from './Skeletons'

const COUNT_LABEL: Record<string, string> = {
  rooms: 'Venues',
  faculty: 'Faculty',
  student_groups: 'Groups',
  courses: 'Courses',
  sessions: 'Sessions',
  booking_requests: 'Requests',
  exams: 'Exams',
}

export function OfficialBackendPanel() {
  const official = useOfficial()
  const { user } = useAuth()
  const navigate = useNavigate()
  const datasetInput = useRef<HTMLInputElement>(null)
  const disruptionInput = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const connected = official.health !== null

  if (official.loading && !official.dataset) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-2">
          <Bone className="h-4 w-56" />
          <Bone className="h-3 w-72 max-w-full" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Bone className="h-9 w-52 rounded-lg" />
          <Bone className="h-9 w-36 rounded-lg" />
          <Bone className="h-9 w-36 rounded-lg" />
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
      `${result.sessions} sessions · ${result.exams} exams · ${result.summary.hard_violation_count} hard violations`,
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
      setDownloadError(error instanceof Error ? error.message : `Could not download ${name}.`)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-5 py-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900">Official engine</h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {connected
              ? `${official.dataset?.dataset_id ?? 'dataset'} · ${official.dataset?.institute ?? ''} · ${
                  official.schedule ? 'schedule generated' : 'ready to generate'
                }`
              : 'Not connected. Start it with: python -m uvicorn backend.app:app --port 8000'}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md border px-2 py-0.5 text-[12px] font-medium',
            connected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900',
          )}
        >
          {connected ? 'Connected' : 'Offline'}
        </span>
      </header>

      {official.error ? (
        <div className="px-5 pt-3">
          <StatusNotice tone="error">{official.error}</StatusNotice>
        </div>
      ) : null}

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
                setToast(
                  `Repair proposal built · ${result.moved} moved · ${result.summary.hard_violation_count} hard violations`,
                )
                window.setTimeout(() => setToast(null), 3500)
              }
            })()
          }
          event.target.value = ''
        }}
      />

      <div className="grid gap-6 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!connected || official.busy}
              onClick={() => void generate()}
              className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {official.busy ? 'Solving…' : 'Generate official schedule'}
            </button>
            <button
              type="button"
              disabled={!connected || official.busy}
              onClick={() => datasetInput.current?.click()}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-400 disabled:opacity-50"
            >
              Upload dataset
            </button>
            <button
              type="button"
              disabled={!connected || official.busy || !official.schedule}
              onClick={() => disruptionInput.current?.click()}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-400 disabled:opacity-50"
            >
              Apply disruption
            </button>
            {confirmReset ? (
              <span className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={official.busy}
                  onClick={() => {
                    setConfirmReset(false)
                    void (async () => {
                      await official.reset()
                      setToast('Backend reset · bundled dataset restored')
                      window.setTimeout(() => setToast(null), 3500)
                    })()
                  }}
                  className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-[13px] font-medium text-rose-800 transition-colors hover:bg-rose-100 disabled:opacity-50"
                >
                  Confirm reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="inline-flex h-9 items-center rounded-lg px-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={!connected || official.busy}
                onClick={() => setConfirmReset(true)}
                className="inline-flex h-9 items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                Reset backend
              </button>
            )}
          </div>

          {official.schedule ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-[12px] text-slate-500">Exports</span>
              <button
                type="button"
                onClick={() => void download('schedule.json')}
                className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-400"
              >
                schedule.json
              </button>
              {official.schedule.proposal_status === 'approved' ? (
                <button
                  type="button"
                  onClick={() => void download('schedule_after.json')}
                  className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-400"
                >
                  schedule_after.json
                </button>
              ) : (
                <span className="text-[12px] text-slate-400">
                  schedule_after.json unlocks after Admin approval
                </span>
              )}
            </div>
          ) : null}

          {downloadError ? <StatusNotice tone="error">{downloadError}</StatusNotice> : null}

          {official.generateResult ? (
            <div className="rounded-lg border border-slate-200 px-3 py-2.5">
              <p className="text-[13px] font-medium text-emerald-800">
                Generated {official.generateResult.sessions} sessions and {official.generateResult.exams}{' '}
                exams · {official.generateResult.summary.hard_violation_count} hard violations
              </p>
              <p className="mt-0.5 text-[12px] text-slate-600">
                Soft penalty {official.generateResult.summary.soft_total} · booking score{' '}
                {official.generateResult.booking_score} · policy {official.generateResult.policy_version}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Inspect the timetable, exams, decisions and diff in Official Data.
              </p>
            </div>
          ) : null}

          {official.disruptionResult ? (
            <div className="rounded-lg border border-slate-200 px-3 py-2.5">
              <p className="text-[13px] font-medium text-slate-800">
                Disruption applied · {official.disruptionResult.moved} sessions moved
              </p>
              <p className="mt-0.5 text-[12px] text-slate-600">
                {official.disruptionResult.time_changed} time ·{' '}
                {official.disruptionResult.room_only_changed} room-only ·{' '}
                {official.disruptionResult.summary.hard_violation_count} hard violations ·{' '}
                {official.disruptionResult.minimal ? 'minimal' : 'above minimum'}
              </p>
            </div>
          ) : null}
        </div>

        {official.dataset ? (
          <div className="min-w-0">
            <p className="text-[12px] text-slate-500">In this dataset</p>
            <dl className="mt-1.5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
              {Object.entries(official.dataset.counts).map(([key, value]) => (
                <div key={key} className="bg-white px-3 py-2">
                  <dt className="text-[12px] text-slate-500">{COUNT_LABEL[key] ?? key}</dt>
                  <dd className="mt-0.5 text-right text-[16px] font-semibold tabular-nums text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
            role="status"
          >
            <p className="text-[13px] font-semibold text-slate-900">Official engine</p>
            <p className="mt-0.5 text-[12px] text-slate-600">{toast}</p>
            <p className="mt-1 text-[12px] text-emerald-700">Backend state refreshed.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
