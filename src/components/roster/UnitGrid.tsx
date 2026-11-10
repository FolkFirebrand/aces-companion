'use client'

import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { selectCanEditStartingForce } from '@/store/selectors'
import { UnitCard } from './UnitCard'

export function UnitGrid() {
  const { campaign, updateUnit, removeUnit } = useCampaignStore()

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 pb-1 border-b-2 border-line">
        <h2 className="m-0 text-lg text-active">Units</h2>
        <span className="text-sm text-text-secondary">Pick each unit’s Named Pilot from its list.</span>
      </div>

      {selectCanEditStartingForce(campaign) && (
        <div className="flex flex-wrap justify-between items-center gap-x-3 px-3 bg-surface border border-line">
          <span className="text-sm text-text-secondary">Missing a unit?</span>
          <Link href="/roster/force" className="min-h-touch flex items-center field-label text-result">Return to Build the Force ›</Link>
        </div>
      )}

      {campaign.units.length === 0
        ? <p className="m-0 text-sm text-text-secondary">No units yet.</p>
        : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {campaign.units.map(unit => (
              <UnitCard key={unit.id} unit={unit} onUpdate={updateUnit} onRemove={removeUnit} />
            ))}
          </div>
        )}
    </section>
  )
}
