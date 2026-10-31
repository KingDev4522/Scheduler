import { GraduationCap } from 'lucide-react'
import { ModulePlaceholder } from '../components/PageHeader'

export default function Exams() {
  return (
    <ModulePlaceholder
      icon={GraduationCap}
      title="Exams"
      description="Midsem timetable for the following week — 41 exams across rooms with the half-effective-capacity rule enforced and filters by group, course and day."
      features={[
        'Exam timetable with group / course / day filters',
        'Half effective room capacity enforced per exam',
        'Room-load view so back-to-back invigilation clashes surface early',
        'Exportable exam schedule once the dataset is imported',
      ]}
    />
  )
}
