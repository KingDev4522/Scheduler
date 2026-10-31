import { useRef } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Play, RotateCcw, Upload } from 'lucide-react'
import { useOfficial } from '../hooks/useOfficial'
import { api } from '../lib/api'
import { StatusNotice } from './States'

export function OfficialBackendPanel() {
  const official = useOfficial()
  const datasetInput = useRef<HTMLInputElement>(null)
  const disruptionInput = useRef<HTMLInputElement>(null)

  const connected = official.health !== null

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
          if (file) void official.uploadDataset(file)
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
            void official.uploadDisruption(file)
          }
          event.target.value = ''
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!connected || official.busy}
          onClick={() => void official.generate()}
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
            if (window.confirm('Reset the backend dataset and clear generated artifacts?')) {
              void official.reset()
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset backend
        </button>
        {official.schedule && (
          <>
            <a
              href={api.exportUrl('schedule.json')}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
            >
              schedule.json
            </a>
            <a
              href={api.exportUrl('schedule_after.json')}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
            >
              schedule_after.json
            </a>
          </>
        )}
      </div>

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
    </section>
  )
}
