'use client'

import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { selectCanEditStartingForce } from '@/store/selectors'
import { UnitCard } from './UnitCard'

export function UnitGrid() {
  const { campaign, updateUnit, removeStartingUnit } = useCampaignStore()
  const settingUp = selectCanEditStartingForce(campaign)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 pb-1 border-b-2 border-line">
        <h2 className="m-0 text-lg text-active">Units</h2>
        <span className="text-sm text-text-secondary">Pick each unit’s Named Pilot from its list.</span>
      </div>

      {settingUp ? (
        <div className="flex flex-wrap justify-between items-center gap-x-3 px-3 py-1 bg-surface border border-line">
          <span className="text-sm text-text-secondary">
            <span className="field-label text-active">Setting up</span> · units come and go for free, and the Starting Warchest follows the unspent PV until your first sortie is completed.
          </span>
          <Link href="/roster/force" className="min-h-touch flex items-center field-label text-result">Build the Force ›</Link>
        </div>
      ) : (
        <p className="m-0 px-3 py-2 text-sm text-text-secondary bg-surface border border-line">
          <span className="field-label text-active">Under way</span> · buy and sell units in a sortie’s Purchase step.
        </p>
      )}

      {campaign.units.length === 0
        ? <p className="m-0 text-sm text-text-secondary">No units yet.</p>
        : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {campaign.units.map(unit => (
              <UnitCard key={unit.id} unit={unit} onUpdate={updateUnit} onRemove={settingUp ? removeStartingUnit : undefined} />
            ))}
          </div>
        )}
    </section>
  )
}
