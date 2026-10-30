'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useCampaignStore } from '@/store/campaign'
import { selectAssignedPilot } from '@/store/selectors'
import { DossierButton } from '@/components/dossier/DossierButton'
import { UnitCard } from './UnitCard'
import { AddUnitForm } from './AddUnitForm'
import { ForceFileButtons } from './ForceFileButtons'

export function UnitGrid() {
  const { campaign, addUnit, updateUnit, removeUnit, assignPilot } = useCampaignStore()
  const [adding, setAdding] = useState(false)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 pb-1 border-b-2 border-steel-500">
        <h2 className="m-0 text-lg text-amber">Units</h2>
        <span className="text-sm text-text-secondary">Drag a Named Pilot onto a unit to assign them.</span>
      </div>

      <DossierButton variant="secondary" className="self-start" onClick={() => setAdding(true)}>+ Add a unit</DossierButton>
      <ForceFileButtons units={campaign.units} onUpload={units => units.forEach(u => addUnit({ ...u, id: uuidv4(), pilotId: null }))} />
      {adding && <AddUnitForm unitList onAdd={unit => { addUnit(unit); setAdding(false) }} onCancel={() => setAdding(false)} />}

      {campaign.units.length === 0
        ? <p className="m-0 text-sm text-text-secondary">No units yet.</p>
        : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {campaign.units.map(unit => (
              <UnitCard
                key={unit.id}
                unit={unit}
                assignedPilot={selectAssignedPilot(campaign.units, campaign.namedPilots, unit.id)}
                onUpdate={updateUnit}
                onRemove={removeUnit}
                onUnassignPilot={unitId => assignPilot(unitId, null)}
              />
            ))}
          </div>
        )}
    </section>
  )
}
