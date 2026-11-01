'use client'

import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { unitListName } from '@/lib/unit-list/convert'
import type { UnitListEntry } from '@/lib/unit-list/convert'
import type { Unit } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { UnitListPicker } from './UnitListPicker'

function Change({ label, from, to }: { label: string; from: React.ReactNode; to: React.ReactNode }) {
  const changed = String(from) !== String(to)
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-baseline py-1.5 border-b border-line text-[15px]">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <span>{from}</span>
      <span className="text-text-secondary">→</span>
      <span className={changed ? 'text-result font-medium' : ''}>{to}</span>
    </div>
  )
}

/** Links a custom unit to the unit list (#37): it gains the list's stats and icon; name, pilot, photo and history stay. */
export function LinkUnitPanel({ unit, onDone }: { unit: Unit; onDone: () => void }) {
  const linkUnit = useCampaignStore(s => s.linkUnit)
  const [picked, setPicked] = useState<UnitListEntry | null>(null)

  if (!picked) {
    return (
      <div className="flex flex-col gap-2.5">
        <UnitListPicker onPick={setPicked} initialText={unit.nameAndVariant} />
        <DossierButton variant="secondary" className="self-start border-line text-text-secondary" onClick={onDone}>Cancel</DossierButton>
      </div>
    )
  }

  function link(keepPv: boolean) {
    linkUnit(unit.id, picked!, keepPv)
    onDone()
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="bg-ground border border-line px-3 py-2 flex flex-col gap-0.5">
        <span className="field-label text-active">Linking to {unitListName(picked)}</span>
        <Change label="PV" from={unit.pvAtSkill4} to={picked.pv} />
        <Change label="Size" from={unit.size} to={picked.size} />
        <Change label="Stats, icon" from={unit.armor !== undefined ? 'some' : '—'} to="from the list" />
        <span className="text-[13px] text-text-secondary pt-1">Its name, pilot, photo and history stay as they are.</span>
      </div>
      <DossierButton variant="primary" className="h-touch text-base" onClick={() => link(false)}>Link, use list PV ({picked.pv})</DossierButton>
      <div className="flex flex-wrap gap-2">
        {picked.pv !== unit.pvAtSkill4 && <DossierButton variant="secondary" onClick={() => link(true)}>Link, keep my PV ({unit.pvAtSkill4})</DossierButton>}
        <DossierButton variant="secondary" className="border-line text-text-secondary" onClick={() => setPicked(null)}>Pick another</DossierButton>
      </div>
    </div>
  )
}
