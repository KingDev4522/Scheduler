import { GitCompareArrows } from 'lucide-react'
import { ModulePlaceholder } from '../components/PageHeader'

export default function Changes() {
  return (
    <ModulePlaceholder
      icon={GitCompareArrows}
      title="Change proposals"
      description="Disruption repair for faculty leave, room closures and new sessions — original vs proposed schedule, moved-session count, impacted entities, and Admin approval before anything changes."
      features={[
        'Original vs proposed diff with exact moved-session list',
        'Minimum-moved-sessions repair candidates from the solver',
        'State stays unchanged until Admin confirms the proposal',
        'Clear infeasibility explanations when no valid repair exists',
      ]}
    />
  )
}
