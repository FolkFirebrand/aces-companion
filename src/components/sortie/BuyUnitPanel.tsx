'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { purchasePrice } from '@/lib/rules'
import { unitFromEntry, unitListName } from '@/lib/unit-list/convert'
import type { UnitListEntry } from '@/lib/unit-list/convert'
import type { Unit } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { UnitListPicker } from '@/components/roster/UnitListPicker'

/** Purchase Additional Units: search the unit list, then confirm the PV × 40 cost before it's added. */
export function BuyUnitPanel({ onBuy, onCancel }: { onBuy: (unit: Unit) => void; onCancel: () => void }) {
  const [picked, setPicked] = useState<UnitListEntry | null>(null)
  const cost = picked ? purchasePrice(picked.pv) : 0

  if (picked) {
    return (
      <div className="bg-steel-800 border border-steel-500">
        <div className="flex justify-between gap-3 px-3 py-2 bg-steel-600 border-b border-amber font-condensed font-bold text-[15px] tracking-[1px] uppercase text-amber">
          <span>{unitListName(picked)}</span><span>Buy?</span>
        </div>
        <div className="p-3 flex flex-col gap-1.5 text-[15px]">
          <span className="text-[13px] text-text-secondary">Size {picked.size} · A{picked.armor} S{picked.structure} · {picked.damage.join('/')}</span>
          <div className="flex justify-between pt-1.5">
            <span className="text-text-secondary">{picked.pv} PV × 40</span>
            <span className="text-signal-blue tabular-nums">{cost.toLocaleString()} SP</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <DossierButton variant="primary" className="flex-1" onClick={() => onBuy({ id: uuidv4(), ...unitFromEntry(picked) })}>
              Buy for {cost.toLocaleString()} SP
            </DossierButton>
            <DossierButton variant="secondary" className="h-button-primary" onClick={() => setPicked(null)}>Back</DossierButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3.5 bg-steel-800 border border-steel-500">
      <UnitListPicker label="Buy a unit" onPick={setPicked} />
      <DossierButton variant="secondary" className="self-start" onClick={onCancel}>Cancel</DossierButton>
    </div>
  )
}
