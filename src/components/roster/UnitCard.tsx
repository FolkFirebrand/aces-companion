'use client'

import { useState } from 'react'
import { PilotSelect } from './PilotSelect'
import { LinkUnitPanel } from './LinkUnitPanel'
import { UnitPhoto } from './UnitPhoto'
import { UnitStats } from './UnitStats'
import { UNIT_TYPES } from '@/lib/types'
import type { Unit } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  unit: Unit
  onUpdate: (id: string, partial: Partial<Unit>) => void
  /** Left out once the campaign is under way: units then leave by being sold in a sortie. */
  onRemove?: (id: string) => void
}

const INPUT = 'h-touch w-full bg-surface-deep border border-line px-2 text-[15px] text-text-primary focus:border-active'
const MAX_ABILITIES = 5

export function UnitCard({ unit, onUpdate, onRemove }: Props) {
  const id = (field: string) => `unit-${field}-${unit.id}`
  const [linking, setLinking] = useState(false)

  return (
    <div className="bg-surface border border-line flex flex-col">
      <div className="flex gap-3 p-3">
        <UnitPhoto unit={unit} size={64} onPhotoChange={photoUrl => onUpdate(unit.id, { photoUrl })} />
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <input
              aria-label="Unit name and variant"
              value={unit.nameAndVariant}
              placeholder="Unit name and variant"
              onChange={e => onUpdate(unit.id, { nameAndVariant: e.target.value })}
              className={cn(INPUT, 'font-label font-bold text-[17px] tracking-[0.5px]')}
            />
            {onRemove && (
              <button type="button" onClick={() => onRemove(unit.id)} aria-label={`Remove ${unit.nameAndVariant || 'unit'}`}
                className="w-touch h-touch shrink-0 text-text-secondary hover:text-danger">✕</button>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end">
            <label htmlFor={id('type')} className="flex flex-col gap-1">
              <span className="field-label text-text-secondary">Type</span>
              <select id={id('type')} value={unit.unitType} onChange={e => onUpdate(unit.id, { unitType: e.target.value as Unit['unitType'] })} className={INPUT}>
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label htmlFor={id('pv')} className="flex flex-col gap-1">
              <span className="field-label text-text-secondary"><abbr title="Point Value at Skill 4" className="no-underline">PV</abbr></span>
              <input id={id('pv')} type="number" inputMode="numeric" value={unit.pvAtSkill4}
                onChange={e => onUpdate(unit.id, { pvAtSkill4: Number(e.target.value) })} className={cn(INPUT, 'tabular-nums text-active font-bold')} />
            </label>
            <label htmlFor={id('size')} className="flex flex-col gap-1">
              <span className="field-label text-text-secondary">Size</span>
              <input id={id('size')} type="number" inputMode="numeric" value={unit.size}
                onChange={e => onUpdate(unit.id, { size: Number(e.target.value) })} className={cn(INPUT, 'tabular-nums')} />
            </label>
            <label className="flex flex-col items-center gap-1 cursor-pointer">
              <span className="field-label text-text-secondary">ENE</span>
              <span className="h-touch flex items-center">
                <input type="checkbox" checked={unit.ene} onChange={e => onUpdate(unit.id, { ene: e.target.checked })}
                  aria-label="ENE (needs no rearming)" className="w-[22px] h-[22px] accent-[var(--color-active)]" />
              </span>
            </label>
          </div>

          <UnitStats unit={unit} maxAbilities={MAX_ABILITIES} />
        </div>
      </div>

      {!unit.unitListId && (
        <div className="border-t border-line px-3 py-1.5">
          {linking
            ? <div className="py-1.5"><LinkUnitPanel unit={unit} onDone={() => setLinking(false)} /></div>
            : (
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <span className="text-[13px] text-text-secondary">Not on the unit list</span>
                <button type="button" onClick={() => setLinking(true)} className="field-label text-result min-h-touch">
                  Match to the unit list ›
                </button>
              </div>
            )}
        </div>
      )}

      <div className="border-t border-line p-2">
        <PilotSelect unit={unit} />
      </div>
    </div>
  )
}
