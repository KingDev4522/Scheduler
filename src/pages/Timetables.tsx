import { CalendarRange } from 'lucide-react'
import { ModulePlaceholder } from '../components/PageHeader'

export default function Timetables() {
  return (
    <ModulePlaceholder
      icon={CalendarRange}
      title="Timetables"
      description="Weekly grid for student groups, faculty and rooms — Monday to Friday, periods P1–P9 with an event-only P10–P13 band, a lunch divider, duration blocks and overlap warnings."
      features={[
        'Filter by group / faculty / room with instant re-render',
        'Legible grid down to a 375px viewport (stacked filter view on phones)',
        'Overlap warnings and colour-coded legends with accessible text labels',
        'Export of the current view once the dataset is imported',
      ]}
    />
  )
}
