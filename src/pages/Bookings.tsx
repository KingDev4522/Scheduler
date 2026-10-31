import { CalendarCheck2 } from 'lucide-react'
import { ModulePlaceholder } from '../components/PageHeader'

export default function Bookings() {
  return (
    <ModulePlaceholder
      icon={CalendarCheck2}
      title="Bookings"
      description="Manual and AI-assisted venue requests plus the Spectra decision board covering all 25 requests — priority, status, reason and alternatives, including the later cancellation."
      features={[
        'Manual tab: structured form with live conflict check',
        'AI tab: English/Hinglish parsed into an editable draft — you confirm every field',
        'Spectra decision board: approve / reject / offer alternative with reason',
        'Own-request tracking with status history for event managers',
      ]}
    />
  )
}
