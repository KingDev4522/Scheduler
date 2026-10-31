import { ClipboardCheck } from 'lucide-react'
import { ModulePlaceholder } from '../components/PageHeader'

export default function Approvals() {
  return (
    <ModulePlaceholder
      icon={ClipboardCheck}
      title="Approvals inbox"
      description="Every request awaiting a decision — requester, conflicts, rationale and full audit history, with self-approval always blocked."
      features={[
        'Pending / approved / rejected filters with audit trail',
        'Conflict and rationale shown before deciding',
        'Single-use decisions with version guard on the schedule',
        'Requester can never approve their own request',
      ]}
    />
  )
}
