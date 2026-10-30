import { Section } from '@/components/sortie/fields'
import { LegalNotice } from '@/components/legal/LegalNotice'

/** Licenses and credits (ADR 0005), the same notice the footer's License & legal button opens. */
export function Credits() {
  return (
    <Section title="Credits and licenses">
      <LegalNotice />
    </Section>
  )
}
