'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { UNIT_TYPES } from '@/lib/types'
import type { Unit, UnitType } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { Field, NumberInput, TextInput } from '@/components/sortie/fields'
import { cn } from '@/lib/utils'
import { unitFromEntry, unitListName } from '@/lib/unit-list/convert'
import type { UnitListEntry } from '@/lib/unit-list/convert'
import { UnitListPicker } from './UnitListPicker'

const TYPE_LABELS: Record<UnitType, string> = {
  'BattleMech': 'BattleMech',
  'Combat Vehicle': 'Combat Vehicle',
  'Battle Armor': 'Battle Armor',
  'Conventional Infantry': 'Infantry',
}

/**
 * Type, Size and ENE drive repair and rearming costs, so all three are required. With `unitList`, the unit can be
 * picked from MegaMek's unit list, which fills everything in; PV and Size stay editable.
 */
export function AddUnitForm({ onAdd, onCancel, unitList = false, submitLabel = 'Add to roster', pvLeft }: {
  onAdd: (unit: Unit) => void
  onCancel: () => void
  unitList?: boolean
  submitLabel?: string
  /** PV still free under a limit (setup), shown in the picker. */
  pvLeft?: number
}) {
  const [picking, setPicking] = useState(unitList)
  const [picked, setPicked] = useState<UnitListEntry | null>(null)
  const [name, setName] = useState('')
  const [unitType, setUnitType] = useState<UnitType>('BattleMech')
  const [pv, setPv] = useState(0)
  const [size, setSize] = useState(1)
  const [ene, setEne] = useState(false)
  const ready = name.trim() !== '' && pv > 0 && size > 0

  function pick(entry: UnitListEntry) {
    const unit = unitFromEntry(entry)
    setPicked(entry)
    setName(unit.nameAndVariant)
    setUnitType(unit.unitType)
    setPv(unit.pvAtSkill4)
    setSize(unit.size)
    setEne(unit.ene)
    setPicking(false)
  }

  if (picking) {
    return (
      <div className="flex flex-col gap-3.5 p-3.5 bg-surface border border-line">
        <div className="font-label font-bold text-sm tracking-[1px] text-active">ADD A UNIT</div>
        <UnitListPicker onPick={pick} pvLeft={pvLeft} />
        <div className="flex flex-wrap gap-2">
          <DossierButton variant="secondary" onClick={() => setPicking(false)}>+ Custom unit</DossierButton>
          <DossierButton variant="secondary" onClick={onCancel}>Cancel</DossierButton>
        </div>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-3.5 p-3.5 bg-surface border border-line"
      onSubmit={e => {
        e.preventDefault()
        if (!ready) return
        const fields = { nameAndVariant: name.trim(), unitType, pvAtSkill4: pv, size, ene }
        onAdd(picked
          ? { id: uuidv4(), ...unitFromEntry(picked), ...fields }
          : { id: uuidv4(), ...fields, pilotId: null, totalSpEarned: 0 })
      }}
    >
      <div className="font-label font-bold text-sm tracking-[1px] text-active">ADD A UNIT</div>
      {unitList && (
        <div className="flex flex-wrap justify-between items-center gap-2 text-[13px] text-text-secondary">
          <span>{picked ? `From the unit list: ${unitListName(picked)}. Check PV and Size against your card.` : 'Custom unit.'}</span>
          <button type="button" onClick={() => setPicking(true)} className="field-label text-result min-h-touch px-1">
            {picked ? 'Pick another' : 'Pick from unit list'}
          </button>
        </div>
      )}
      <Field id="new-unit-name" label="Unit and variant">
        <TextInput id="new-unit-name" value={name} onChange={setName} />
      </Field>
      <fieldset className="flex flex-col gap-1.5 border-0 p-0 m-0">
        <legend className="field-label text-text-secondary mb-1">Type</legend>
        <div className="grid grid-cols-2 gap-2">
          {UNIT_TYPES.map(t => (
            <label key={t} className={cn(
              'h-touch flex items-center justify-center border-2 font-label font-bold text-[13px] tracking-[1px] uppercase cursor-pointer',
              unitType === t ? 'border-active text-active' : 'border-line text-text-secondary'
            )}>
              <input type="radio" name="new-unit-type" value={t} checked={unitType === t} onChange={() => setUnitType(t)} className="sr-only" />
              {TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field id="new-unit-pv" label="PV at Skill 4">
          <NumberInput id="new-unit-pv" value={pv} onChange={setPv} min={1} />
        </Field>
        <Field id="new-unit-size" label="Size">
          <NumberInput id="new-unit-size" value={size} onChange={setSize} min={1} />
        </Field>
      </div>
      <label className="flex items-center gap-3 min-h-touch py-1.5 border-y border-line cursor-pointer">
        <input type="checkbox" checked={ene} onChange={e => setEne(e.target.checked)} className="w-6 h-6 accent-[var(--color-active)]" />
        <span className="flex flex-col">
          <span className="font-label font-bold text-[15px] tracking-[1px]">HAS ENE</span>
          <span className="text-[13px] text-text-secondary">Units with the ENE special skip the 20 SP rearming cost.</span>
        </span>
      </label>
      <p className="m-0 text-[13px] text-text-secondary">Non-’Mech units count as half their Size for repairs.</p>
      <div className="flex flex-wrap gap-2">
        <DossierButton variant="primary" type="submit" disabled={!ready} className="sm:max-w-xs">{submitLabel}</DossierButton>
        <DossierButton variant="secondary" onClick={onCancel}>Cancel</DossierButton>
      </div>
    </form>
  )
}
