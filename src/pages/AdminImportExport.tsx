import { Link } from 'react-router-dom'
import { OfficialBackendPanel } from '../components/OfficialBackendPanel'

const STEPS: { title: string; body: string; to?: string; link?: string }[] = [
  {
    title: 'Upload a dataset',
    body: 'Optional. The bundled cit_public.json is already loaded; replace it only with another validated official dataset.',
  },
  {
    title: 'Generate the official schedule',
    body: 'Builds the sessions and exams with CP-SAT, then runs the unmodified official validator.',
  },
  {
    title: 'Apply a disruption',
    body: 'Build a change, review the solver’s diff, then approve it.',
    to: '/changes',
    link: 'Change proposals',
  },
  {
    title: 'Download the exports',
    body: 'schedule.json straight away, and schedule_after.json once the repair is approved.',
  },
  {
    title: 'Reset the backend',
    body: 'Reloads the bundled dataset and clears generated artifacts, submissions and change requests.',
  },
]

export default function AdminImportExport() {
  return (
    <div className="cit-page">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">
            Import / exports
          </h2>
          <p className="mt-1 max-w-[56ch] text-[14px] leading-relaxed text-slate-600">
            One official workflow: the FastAPI and CP-SAT engine generates the timetable, exams and
            Spectra decisions, and every artifact is downloadable here.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/official"
            className="hidden h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          >
            Official data
          </Link>
          <Link
            to="/approvals"
            className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Open approvals
          </Link>
        </div>
      </header>

      <div className="mt-4">
        <OfficialBackendPanel />
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-[15px] font-semibold text-slate-900">How this page works</h3>
        </div>
        <ol className="divide-y divide-slate-100">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 px-5 py-3">
              <span className="w-6 shrink-0 pt-0.5 text-right text-[13px] tabular-nums text-slate-400">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                  {step.body}
                  {step.to && step.link ? (
                    <>
                      {' '}
                      <Link
                        to={step.to}
                        className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                      >
                        {step.link}
                      </Link>
                      .
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="border-t border-slate-100 px-5 py-3 text-[12px] text-slate-500">
          There is no separate provisional import, internal snapshot or browser demo engine.
          Inspect the generated result in{' '}
          <Link
            to="/official"
            className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
          >
            Official Data
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
