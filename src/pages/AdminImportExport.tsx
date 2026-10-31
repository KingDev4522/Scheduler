import { useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  DatabaseBackup,
  DoorOpen,
  Download,
  FileJson,
  Loader2,
  Play,
  ShieldCheck,
  Upload,
  Users,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { OfficialBackendPanel } from '../components/OfficialBackendPanel'
import { StatusNotice } from '../components/States'
import { useAuth } from '../lib/auth'
import {
  applyPlacements,
  exportDataSnapshot,
  getData,
  writeImportedData,
  type AppData,
} from '../lib/store'
import { parseImportDocument, type ImportSummary } from '../lib/import'
import {
  BUNDLED_DATASET_URL,
  clearStoredDataset,
  parseOfficialDataset,
  readStoredDataset,
  saveStoredDataset,
  type DatasetSummary,
  type StoredDataset,
} from '../lib/dataset'
import { periodRangeLabel } from '../lib/time'
import { buildEngineInput } from '../engine/input'
import { solveTimetable } from '../engine/solver'
import type { SolveResult } from '../engine/types'

const STATUS_STYLE: Record<SolveResult['status'], string> = {
  FEASIBLE: 'bg-neutral-100 text-neutral-800',
  INFEASIBLE: 'bg-neutral-100 text-neutral-800',
  TIMEOUT: 'bg-neutral-100 text-neutral-800',
}

export default function AdminImportExport() {
  const { user } = useAuth()
  const [data, setData] = useState<AppData>(getData)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SolveResult | null>(null)
  const [applied, setApplied] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importCandidate, setImportCandidate] = useState<AppData | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [datasetRecord, setDatasetRecord] = useState<StoredDataset | null>(readStoredDataset)
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null)
  const [datasetBusy, setDatasetBusy] = useState(false)
  const datasetInputRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  const loadDatasetText = (text: string, label: string) => {
    const parsed = parseOfficialDataset(text, label)
    setDatasetSummary(parsed.summary)
    if (parsed.dataset) {
      const record = saveStoredDataset(parsed.dataset, parsed.summary, user.username)
      setDatasetRecord(record)
      const matched = parsed.summary.counts.filter((count) => count.ok).length
      setFlash({
        tone: 'success',
        message: `Loaded ${parsed.summary.datasetId} from ${label}. ${matched}/${parsed.summary.counts.length} counts match the starter README.`,
      })
    } else {
      setFlash({
        tone: 'error',
        message: `${label} has ${parsed.summary.errors.length} error(s); nothing was stored.`,
      })
    }
  }

  const loadBundledDataset = async () => {
    setDatasetBusy(true)
    setFlash(null)
    try {
      const response = await fetch(BUNDLED_DATASET_URL, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      loadDatasetText(await response.text(), 'cit_public.json (bundled)')
    } catch (error) {
      setFlash({
        tone: 'error',
        message: `Could not fetch ${BUNDLED_DATASET_URL}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      })
    } finally {
      setDatasetBusy(false)
    }
  }

  const handleDatasetFile = async (file: File) => {
    setDatasetBusy(true)
    setFlash(null)
    try {
      loadDatasetText(await file.text(), file.name)
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not read the file.',
      })
    } finally {
      setDatasetBusy(false)
    }
  }

  const clearDataset = () => {
    clearStoredDataset()
    setDatasetRecord(null)
    setDatasetSummary(null)
    setFlash({ tone: 'success', message: 'Stored official dataset cleared.' })
  }

  const generate = () => {
    setBusy(true)
    setFlash(null)
    setApplied(false)
    window.setTimeout(() => {
      try {
        const input = buildEngineInput(data)
        const solved = solveTimetable(input)
        setResult(solved)
        setFlash({
          tone: solved.status === 'FEASIBLE' ? 'success' : 'error',
          message: solved.message,
        })
      } catch (error) {
        setFlash({
          tone: 'error',
          message: error instanceof Error ? error.message : 'The engine failed unexpectedly.',
        })
      } finally {
        setBusy(false)
      }
    }, 50)
  }

  const apply = () => {
    if (!result) return
    const outcome = applyPlacements(
      result.placements.map((placement) => ({
        sessionId: placement.sessionId,
        day: placement.day,
        startPeriod: placement.startPeriod,
        roomId: placement.roomId,
      })),
      user.username,
    )
    if (!outcome.ok) {
      setFlash({ tone: 'error', message: outcome.error })
      return
    }
    setData({ ...outcome.data })
    setApplied(true)
    setFlash({
      tone: 'success',
      message: `Applied ${result.placements.length} validated placements. Open Timetables to inspect the regenerated grid.`,
    })
  }

  const handleFile = async (file: File) => {
    setImportBusy(true)
    setImportSummary(null)
    setImportCandidate(null)
    setFlash(null)
    try {
      const text = await file.text()
      const parsed = parseImportDocument(text, file.name)
      setImportSummary(parsed.summary)
      setImportCandidate(parsed.data ?? null)
      setFlash(
        parsed.summary.ok
          ? {
              tone: 'success',
              message: `Parsed ${file.name} with 0 errors — review the summary, then apply.`,
            }
          : {
              tone: 'error',
              message: `${file.name} has ${parsed.summary.errors.length} error(s). Fix them and re-upload.`,
            },
      )
    } catch (error) {
      setFlash({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not read the file.',
      })
    } finally {
      setImportBusy(false)
    }
  }

  const applyImport = () => {
    if (!importCandidate) return
    const outcome = writeImportedData(
      importCandidate,
      user.username,
      importSummary?.fileName ?? 'uploaded file',
    )
    if (!outcome.ok) {
      setFlash({ tone: 'error', message: outcome.error })
      return
    }
    setData({ ...outcome.data })
    setResult(null)
    setApplied(false)
    setImportSummary(null)
    setImportCandidate(null)
    setFlash({
      tone: 'success',
      message: 'Import applied. Rooms, bookings, timetable and selectors now read the imported data.',
    })
  }

  const downloadSnapshot = () => {
    const blob = new Blob([exportDataSnapshot()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'cit-scheduler-internal-snapshot.json'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setFlash({
      tone: 'success',
      message: 'Downloaded an internal snapshot. This is not the official schedule.json export.',
    })
  }

  const movedCount = result
    ? result.placements.filter((placement) => {
        const session = data.sessions.find((item) => item.id === placement.sessionId)
        return (
          session !== undefined &&
          (session.day !== placement.day ||
            session.startPeriod !== placement.startPeriod ||
            session.roomId !== placement.roomId)
        )
      }).length
    : 0

  const canApply =
    result !== null && result.status === 'FEASIBLE' && result.violations.length === 0 && !applied

  const groupName = (id: string) => data.groups.find((group) => group.id === id)?.name ?? id
  const facultyName = (id: string) => data.faculty.find((member) => member.id === id)?.name ?? id
  const roomName = (id: string) => data.rooms.find((room) => room.id === id)?.name ?? id
  const sessionById = new Map(data.sessions.map((session) => [session.id, session]))

  return (
    <div>
      <PageHeader
        title="Import / exports"
        subtitle="Generate the official timetable, exams and Spectra decisions with the CP-SAT backend, then inspect them in Official Data. The demo panel below remains available for the browser-only build."
      />

      {flash && <StatusNotice tone={flash.tone}>{flash.message}</StatusNotice>}

      <OfficialBackendPanel />

      {/* Official dataset */}
      <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <FileJson className="h-4 w-4" aria-hidden />
          Official dataset · cit_public.json
        </h3>
        <p className="mt-1 text-sm text-neutral-700">
          Source: <code>CrunchWeek_StarterPack/</code>, bundled at{' '}
          <code>{BUNDLED_DATASET_URL}</code>. Validated against the starter README — required
          fields, duplicate ids, references and the expected counts. Nothing is written until the
          file passes validation.
        </p>

        <input
          ref={datasetInputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Upload cit_public.json"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleDatasetFile(file)
            event.target.value = ''
          }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadBundledDataset()}
            disabled={datasetBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {datasetBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileJson className="h-4 w-4" aria-hidden />
            )}
            {datasetBusy ? 'Validating…' : 'Load bundled dataset'}
          </button>
          <button
            type="button"
            onClick={() => datasetInputRef.current?.click()}
            disabled={datasetBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload cit_public.json
          </button>
          {datasetRecord && (
            <button
              type="button"
              onClick={clearDataset}
              className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              Clear stored dataset
            </button>
          )}
          <span className="text-xs text-neutral-500">
            {datasetRecord
              ? `Stored ${new Date(datasetRecord.loadedAt).toLocaleString()} by ${datasetRecord.loadedBy}`
              : 'No official dataset stored yet.'}
          </span>
        </div>

        {datasetSummary && (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  datasetSummary.ok
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {datasetSummary.ok ? 'Valid' : 'Invalid'}
              </span>
              <span className="text-xs font-medium text-neutral-800">
                {datasetSummary.datasetId || '(no dataset_id)'}
                {datasetSummary.institute ? ` · ${datasetSummary.institute}` : ''}
              </span>
              <span className="text-xs text-neutral-500">{datasetSummary.sourceLabel}</span>
              <span className="font-mono text-[10px] text-neutral-400">
                {datasetSummary.sourceHash}
              </span>
            </div>

            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {datasetSummary.counts.map((line) => (
                <li
                  key={line.entity}
                  className="rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                    {line.entity}
                  </p>
                  <p className="font-semibold text-neutral-900">
                    {line.actual}{' '}
                    <span className="font-normal text-neutral-400">/ {line.expected}</span>
                  </p>
                  <p className={line.ok ? 'text-emerald-700' : 'text-amber-700'}>
                    {line.ok ? 'matches README' : 'differs from README'}
                  </p>
                </li>
              ))}
            </ul>

            {datasetSummary.errors.length > 0 && (
              <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-2.5">
                <p className="text-xs font-semibold text-rose-800">
                  {datasetSummary.errors.length} error
                  {datasetSummary.errors.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[11px] text-rose-700">
                  {datasetSummary.errors.map((issue, index) => (
                    <li key={`${issue.path}-${index}`}>
                      <code className="font-mono text-[10px]">{issue.path}</code> — {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {datasetSummary.warnings.length > 0 && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-xs font-semibold text-amber-800">
                  {datasetSummary.warnings.length} warning
                  {datasetSummary.warnings.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto text-[11px] text-amber-800">
                  {datasetSummary.warnings.slice(0, 8).map((issue, index) => (
                    <li key={`${issue.path}-${index}`}>
                      <code className="font-mono text-[10px]">{issue.path}</code> — {issue.message}
                    </li>
                  ))}
                  {datasetSummary.warnings.length > 8 && (
                    <li>+{datasetSummary.warnings.length - 8} more…</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Data summary */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={DoorOpen} label="Rooms" value={data.rooms.length} hint="demo dataset" tone="neutral" />
        <StatCard icon={Users} label="Faculty" value={data.faculty.length} hint="daily limit 4 periods" tone="neutral" />
        <StatCard icon={UsersRound} label="Groups" value={data.groups.length} hint="with sizes" tone="neutral" />
        <StatCard icon={CalendarRange} label="Sessions" value={data.sessions.length} hint="teaching sessions" tone="neutral" />
        <StatCard icon={CalendarCheck2} label="Bookings" value={data.bookings.length} hint="Spectra requests" tone="neutral" />
      </div>

      {/* Engine */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-neutral-700" aria-hidden />
              Constraint engine · demo dataset
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Deterministic backtracking search with minimum-remaining-values variable choice. It
              assigns day, start period and room to every session while satisfying H01–H06, H09,
              H12 and H13. A separate validator re-checks the finished schedule before anything can
              be applied.
            </p>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            {busy ? 'Solving…' : 'Generate demo timetable'}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-neutral-600">
          Demo soft-constraint weights are provisional heuristics; the official validator weights
          are VERIFY until the starter pack arrives.
        </p>

        {result && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[result.status]}`}
              >
                {result.status === 'FEASIBLE' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                )}
                {result.status}
              </span>
              <span className="text-xs text-slate-500">
                {result.placements.length} placed · {result.unplacedSessionIds.length} unplaced ·{' '}
                {result.violations.length} hard violations
              </span>
              {applied && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-800">
                  Applied
                </span>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <dt className="text-slate-500">Duration</dt>
                <dd className="font-semibold text-slate-900">{result.metrics.durationMs} ms</dd>
              </div>
              <div>
                <dt className="text-slate-500">Search nodes</dt>
                <dd className="font-semibold text-slate-900">{result.metrics.nodes}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Placements</dt>
                <dd className="font-semibold text-slate-900">{result.metrics.placements}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Soft penalty</dt>
                <dd className="font-semibold text-slate-900">{result.metrics.softPenalty}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Moved vs current</dt>
                <dd className="font-semibold text-slate-900">{movedCount}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Reproducible</dt>
                <dd className="font-semibold text-slate-900">yes (deterministic)</dd>
              </div>
            </dl>

            {result.violations.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {result.violations.map((violation, index) => (
                  <li
                    key={`${violation.code}-${index}`}
                    className="rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800"
                  >
                    <span className="mr-1.5 font-semibold">{violation.code}</span>
                    {violation.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={apply}
                disabled={!canApply}
                className="rounded-lg bg-black px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply validated timetable
              </button>
              <span className="text-[11px] text-slate-500">
                {result.status === 'TIMEOUT'
                  ? 'A timeout is not proof of infeasibility.'
                  : result.violations.length > 0
                    ? 'Apply is blocked while any hard violation exists.'
                    : 'Apply is enabled only after an independent 0-violation check.'}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Placement preview */}
      {result && result.placements.length > 0 && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Generated placements</h3>
            <span className="text-[11px] text-slate-500">
              {result.placements.length} sessions · sorted by day and period
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2">Course</th>
                  <th scope="col" className="px-4 py-2">Group</th>
                  <th scope="col" className="px-4 py-2">Faculty</th>
                  <th scope="col" className="px-4 py-2">Room</th>
                  <th scope="col" className="px-4 py-2">Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...result.placements]
                  .sort((a, b) => {
                    const dayDelta = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(a.day) - ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(b.day)
                    return dayDelta !== 0 ? dayDelta : a.startPeriod - b.startPeriod
                  })
                  .map((placement) => {
                    const session = sessionById.get(placement.sessionId)
                    return (
                      <tr key={placement.sessionId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2">
                          <span className="font-medium text-slate-800">{session?.courseCode}</span>{' '}
                          <span className="text-xs text-slate-500">{session?.courseName}</span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">
                          {groupName(session?.groupId ?? '')}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">
                          {facultyName(session?.facultyId ?? '')}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">
                          {roomName(placement.roomId)}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">
                          {placement.day} {periodRangeLabel(placement.startPeriod, placement.periods)}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Import / export */}
      <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Upload className="h-4 w-4 text-slate-400" aria-hidden />
            Import dataset · provisional schema
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Official import stays blocked, but this importer exercises the Phase 1 pipeline on the
            app's internal schema: required fields, duplicate IDs, references, day/period windows and
            capacity warnings are checked before anything is written. Malformed files return
            path-level errors.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose a JSON dataset file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
              event.target.value = ''
            }}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              {importBusy ? 'Validating…' : 'Choose JSON file'}
            </button>
            {importSummary?.ok && importCandidate && (
              <button
                type="button"
                onClick={applyImport}
                className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-900"
              >
                Apply import
              </button>
            )}
          </div>

          {importSummary && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">                  <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    importSummary.ok
                      ? 'bg-neutral-100 text-neutral-700'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {importSummary.ok ? 'Valid' : 'Invalid'}
                </span>
                <span className="text-xs font-medium text-slate-700">{importSummary.fileName}</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {importSummary.sourceHash}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                {(
                  [
                    ['Rooms', importSummary.counts.rooms],
                    ['Faculty', importSummary.counts.faculty],
                    ['Groups', importSummary.counts.groups],
                    ['Sessions', importSummary.counts.sessions],
                    ['Bookings', importSummary.counts.bookings],
                    ['Proposals', importSummary.counts.proposals],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="font-semibold text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>

              {importSummary.errors.length > 0 && (
                <div className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-2.5">
                  <p className="text-xs font-semibold text-neutral-800">
                    {importSummary.errors.length} error
                    {importSummary.errors.length === 1 ? '' : 's'}
                  </p>
                  <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[11px] text-neutral-700">
                    {importSummary.errors.map((issue, index) => (
                      <li key={`${issue.path}-${index}`}>
                        <code className="font-mono text-[10px]">{issue.path}</code> — {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importSummary.warnings.length > 0 && (
                <div className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-2.5">
                  <p className="text-xs font-semibold text-neutral-800">
                    {importSummary.warnings.length} warning
                    {importSummary.warnings.length === 1 ? '' : 's'} (import still allowed)
                  </p>
                  <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto text-[11px] text-neutral-700">
                    {importSummary.warnings.slice(0, 8).map((issue, index) => (
                      <li key={`${issue.path}-${index}`}>
                        <code className="font-mono text-[10px]">{issue.path}</code> — {issue.message}
                      </li>
                    ))}
                    {importSummary.warnings.length > 8 && (
                      <li>+{importSummary.warnings.length - 8} more…</li>
                    )}
                  </ul>
                </div>
              )}

              {importSummary.ok && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Nothing has been written yet. Apply replaces the current demo store and records
                  provenance in the audit trail.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileJson className="h-4 w-4 text-slate-400" aria-hidden />
            Export
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Required exports are{' '}
            <code className="rounded bg-slate-100 px-1">exports/schedule.json</code> and{' '}
            <code className="rounded bg-slate-100 px-1">exports/schedule_after.json</code>. Their key
            names come from the starter README, so the official export stays blocked until the
            schema is inspected. An internal snapshot is available for round-trip checks only.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400"
            >
              schedule.json (blocked)
            </button>
            <button
              type="button"
              onClick={downloadSnapshot}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Internal snapshot (not official)
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <DatabaseBackup className="h-4 w-4 text-neutral-700" aria-hidden />
          What runs today
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
          <li>• Rooms, bookings, decisions, audit and the timetable all read/write localStorage.</li>
          <li>• The engine generates from the demo dataset and refuses to apply anything that fails validation.</li>
          <li>• Provisional internal-schema import and snapshot export are available for pipeline checks.</li>
          <li>• Official import, validator invocation and schema-compliant export remain blocked on DEC-002.</li>
        </ul>
      </div>
    </div>
  )
}
