import { DoorOpen } from 'lucide-react'
import { ModulePlaceholder } from '../components/PageHeader'

export default function Rooms() {
  return (
    <ModulePlaceholder
      icon={DoorOpen}
      title="Room finder"
      description="Search every space by capacity, type, features and accessibility, check free periods for a chosen day, and jump straight into a booking for that room."
      features={[
        'Capacity / type / feature / accessibility filters',
        'Availability by period for any weekday',
        'Direct "Book this room" link that pre-fills the booking form',
        'Effective-capacity display (half capacity enforced during exams)',
      ]}
    />
  )
}
