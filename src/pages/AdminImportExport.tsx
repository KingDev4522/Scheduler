import { FileJson, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { OfficialBackendPanel } from '../components/OfficialBackendPanel'

/**
 * One official workflow only:
 * upload a dataset (optional) → generate → inspect → apply a disruption → reset.
 *
 * The legacy demo engine, provisional-schema importer and internal-snapshot export
 * were removed because they duplicated the FastAPI/CP-SAT path and confused the
 * judge workflow. Official exports are produced by the backend and downloaded from
 * the panel below.
 */
export default function AdminImportExport() {
  return (
    <div className="cit-page">
      <PageHeader
        title="Import / exports"
        subtitle="The official FastAPI + CP-SAT workflow. Generate the timetable, exams and Spectra decisions, then inspect them in Official Data."
      />

      <OfficialBackendPanel />

      <section className="cit-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-neutral-700" aria-hidden />
          How this page works
        </h3>
        <ol className="cit-stagger mt-3 space-y-2 text-sm text-slate-600">
          <li>
            <span className="font-semibold text-slate-800">1. Upload dataset</span> — optional. The
            bundled <code className="rounded bg-slate-100 px-1">cit_public.json</code> is already
            loaded. Use this only when replacing it with another validated official dataset.
          </li>
          <li>
            <span className="font-semibold text-slate-800">2. Generate official schedule</span> —
            builds 189 sessions and 41 exams with CP-SAT, then runs the unmodified official
            validator.
          </li>
          <li>
            <span className="font-semibold text-slate-800">3. Apply disruption</span> — build a
            change in <Link to="/changes" className="font-semibold text-neutral-900">Change proposals</Link>{' '}
            or upload a change file, review the diff, then approve it in{' '}
            <Link to="/approvals" className="font-semibold text-neutral-900">Approvals</Link>.
          </li>
          <li>
            <span className="font-semibold text-slate-800">4. Download exports</span> —{' '}
            <code className="rounded bg-slate-100 px-1">schedule.json</code> and, after approval,{' '}
            <code className="rounded bg-slate-100 px-1">schedule_after.json</code>.
          </li>
          <li>
            <span className="font-semibold text-slate-800">Reset backend</span> — reloads the
            bundled dataset and clears generated artifacts, booking submissions and change requests.
          </li>
        </ol>

        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <FileJson className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            There is no separate “provisional import”, “internal snapshot” or browser demo engine on
            this page anymore. Inspect the generated result in{' '}
            <Link to="/official" className="font-semibold text-neutral-900">
              Official Data
            </Link>
            .
          </span>
        </p>
      </section>
    </div>
  )
}
