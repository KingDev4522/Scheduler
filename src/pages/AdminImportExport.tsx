import { DatabaseBackup } from 'lucide-react'
import { ModulePlaceholder } from '../components/PageHeader'

export default function AdminImportExport() {
  return (
    <ModulePlaceholder
      icon={DatabaseBackup}
      title="Import / Exports"
      description="Admin-only data hub: upload the original and disruption files, review the import summary, generate schedules, read validator results and export exact official JSON."
      features={[
        'File upload with integrity summary and clear error list',
        'Generate button with solver progress and timeout reporting',
        'Validator results kept separate from solver status',
        'schedule.json / schedule-after.json exports and demo reset',
      ]}
    />
  )
}
