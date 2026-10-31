import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useOfficial } from '../hooks/useOfficial'

export default function Exams() {
  const { dataset, schedule, loading, error } = useOfficial()

  const rows = useMemo(() => {
    if (!dataset || !schedule) return []
    const definitions = new Map(dataset.entities.exams.map((exam) => [exam.id, exam]))
    return schedule.schedule.exams.map((placed) => ({
      ...placed,
      definition: definitions.get(placed.exam_id),
    }))
  }, [dataset, schedule])

  if (loading) return <LoadingState label="Loading the official exam schedule…" />
  if (error) {
    return (
      <div>
        <PageHeader title="Exams" subtitle="Official midsem schedule" />
        <ErrorState title="The backend is unavailable" description={error} onRetry={() => window.location.reload()} />
      </div>
    )
  }
  if (!schedule || rows.length === 0) {
    return (
      <div>
        <PageHeader title="Exams" subtitle="Official midsem schedule" />
        <EmptyState
          icon={GraduationCap}
          title="No official exam schedule yet"
          description="Generate the timetable from Official Data first. The 41 official exams and the half-capacity rule are then rendered here."
          action={
            <Link
              to="/official"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Open Official Data
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Exams"
        subtitle={`${rows.length} official midsem exams · half effective room capacity enforced · AM/PM sessions`}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Exam</th>
              <th scope="col" className="px-4 py-3">Courses</th>
              <th scope="col" className="px-4 py-3">Groups</th>
              <th scope="col" className="px-4 py-3">Candidates</th>
              <th scope="col" className="px-4 py-3">Slot</th>
              <th scope="col" className="px-4 py-3">Rooms</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.exam_id} className="align-top hover:bg-slate-50/70">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.exam_id}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {row.definition?.course_ids.join(', ') ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {row.definition?.groups.join(', ') ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {row.definition?.size ?? '—'}
                  {row.definition ? (
                    <span className="block text-[10px] text-slate-400">
                      {row.definition.duration_hours}h · half-cap per room
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">
                  {row.day} · {row.session}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {row.rooms.join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Source: <span className="font-mono">/api/schedule</span>. The official validator's exam
        penalty is reported in Official Data after every generate.
      </p>
    </div>
  )
}
