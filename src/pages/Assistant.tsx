import { Sparkles } from 'lucide-react'
import { ModulePlaceholder } from '../components/PageHeader'

export default function Assistant() {
  return (
    <ModulePlaceholder
      icon={Sparkles}
      title="AI Assistant"
      description="Natural-language and Hinglish scheduling requests converted into structured, editable drafts — every suggestion is validated deterministically before it can become a proposal."
      features={[
        'Extracts day, period, room and duration into an editable form',
        'Clarifying questions when the request is ambiguous',
        'Deterministic hard-constraint validation of every alternative',
        'Grounded explanations; works in a manual fallback mode when offline',
      ]}
    />
  )
}
