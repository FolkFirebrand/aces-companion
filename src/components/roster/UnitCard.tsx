'use client'

import { useState } from 'react'
import { PilotDropZone } from './PilotDropZone'
import { LinkUnitPanel } from './LinkUnitPanel'
import { UnitPhoto } from './UnitPhoto'
import { StatusTag } from '@/components/dossier/StatusTag'
import { UNIT_TYPES } from '@/lib/types'
import type { Unit, NamedPilot } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  unit: Unit
  assignedPilot: NamedPilot | undefined
  onUpdate: (id: string, partial: Partial<Unit>) => void
  onRemove: (id: string) => void
  onUnassignPilot: (unitId: string) => void
}

const INPUT = 'h-touch w-full bg-steel-900 border border-steel-500 px-2 text-[15px] text-text-primary focus:border-amber'
const MAX_ABILITIES = 5

function Stat({ abbr, title, value, tone }: { abbr: string; title: string; value: React.ReactNode; tone?: string }) {
  return (
    <span className="flex flex-col items-center min-w-10 px-1.5 py-1 bg-steel-900 border border-steel-500">
      <abbr title={title} className="dossier-label text-[11px] text-text-secondary no-underline">{abbr}</abbr>
      <span className={cn('font-condensed font-bold text-base', tone)}>{value}</span>
    </span>
  )
}

export function UnitCard({ unit, assignedPilot, onUpdate, onRemove, onUnassignPilot }: Props) {
  const id = (field: string) => `unit-${field}-${unit.id}`
  const abilities = unit.abilities ?? []
  const [linking, setLinking] = useState(false)

  return (
    <div className="bg-steel-800 border border-steel-500 flex flex-col">
      <div className="flex gap-3 p-3">
        <UnitPhoto unit={unit} size={64} onPhotoChange={photoUrl => onUpdate(unit.id, { photoUrl })} />
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <input
              aria-label="Unit name and variant"
              value={unit.nameAndVariant}
              placeholder="Unit name and variant"
              onChange={e => onUpdate(unit.id, { nameAndVariant: e.target.value })}
              className={cn(INPUT, 'font-condensed font-bold text-[17px] tracking-[0.5px]')}
            />
            <button type="button" onClick={() => onRemove(unit.id)} aria-label={`Remove ${unit.nameAndVariant || 'unit'}`}
              className="w-touch h-touch shrink-0 text-text-secondary hover:text-danger">✕</button>
          </div>

          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end">
            <label htmlFor={id('type')} className="flex flex-col gap-1">
              <span className="dossier-label text-text-secondary">Type</span>
              <select id={id('type')} value={unit.unitType} onChange={e => onUpdate(unit.id, { unitType: e.target.value as Unit['unitType'] })} className={INPUT}>
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label htmlFor={id('pv')} className="flex flex-col gap-1">
              <span className="dossier-label text-text-secondary"><abbr title="Point Value at Skill 4" className="no-underline">PV</abbr></span>
              <input id={id('pv')} type="number" inputMode="numeric" value={unit.pvAtSkill4}
                onChange={e => onUpdate(unit.id, { pvAtSkill4: Number(e.target.value) })} className={cn(INPUT, 'tabular-nums text-amber font-bold')} />
            </label>
            <label htmlFor={id('size')} className="flex flex-col gap-1">
              <span className="dossier-label text-text-secondary">Size</span>
              <input id={id('size')} type="number" inputMode="numeric" value={unit.size}
                onChange={e => onUpdate(unit.id, { size: Number(e.target.value) })} className={cn(INPUT, 'tabular-nums')} />
            </label>
            <label className="flex flex-col items-center gap-1 cursor-pointer">
              <span className="dossier-label text-text-secondary">ENE</span>
              <span className="h-touch flex items-center">
                <input type="checkbox" checked={unit.ene} onChange={e => onUpdate(unit.id, { ene: e.target.checked })}
                  aria-label="ENE (needs no rearming)" className="w-[22px] h-[22px] accent-[var(--color-amber)]" />
              </span>
            </label>
          </div>

          {(unit.role || unit.tonnage !== undefined) && (
            <span className="text-[13px] text-text-secondary uppercase tracking-[1px]">
              {[unit.role, unit.tonnage !== undefined ? `${unit.tonnage} tons` : null].filter(Boolean).join(' · ')}
            </span>
          )}

          {(unit.tmm !== undefined || unit.armor !== undefined || unit.structure !== undefined || unit.move?.length) && (
            <div className="flex flex-wrap gap-1.5">
              {unit.move?.map((m, i) => <Stat key={i} abbr="MV" title="Movement" value={`${m.move}${m.type ?? ''}`} />)}
              {unit.tmm !== undefined && <Stat abbr="TMM" title="Target Movement Modifier" value={unit.tmm} />}
              {unit.armor !== undefined && <Stat abbr="ARM" title="Armor" value={unit.armor} />}
              {unit.structure !== undefined && <Stat abbr="STR" title="Structure" value={unit.structure} />}
              {unit.overheat !== undefined && unit.overheat > 0 && <Stat abbr="OV" title="Overheat" value={unit.overheat} tone="text-danger" />}
            </div>
          )}

          {unit.damage && (
            <div className="flex items-center gap-2">
              <span className="dossier-label text-text-secondary">Damage</span>
              <div data-testid="damage-band" className="flex border border-steel-500">
                {(['short', 'medium', 'long'] as const).map((range, i) => (
                  <span key={range} className={cn('flex flex-col items-center px-2.5 py-0.5', i > 0 && 'border-l border-steel-500')}>
                    <span className="dossier-label text-[11px] text-text-secondary">{['S', 'M', 'L'][i]}</span>
                    <span className="font-condensed font-bold">{unit.damage![range]}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {abilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {abilities.slice(0, MAX_ABILITIES).map(a => <StatusTag key={a} tone={a === 'ENE' ? 'keyword' : 'neutral'}>{a}</StatusTag>)}
              {abilities.length > MAX_ABILITIES && <StatusTag tone="neutral">+{abilities.length - MAX_ABILITIES}</StatusTag>}
            </div>
          )}
        </div>
      </div>

      {!unit.unitListId && (
        <div className="border-t border-steel-500 px-3 py-1.5">
          {linking
            ? <div className="py-1.5"><LinkUnitPanel unit={unit} onDone={() => setLinking(false)} /></div>
            : (
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <span className="text-[13px] text-text-secondary">Not on the unit list</span>
                <button type="button" onClick={() => setLinking(true)} className="dossier-label text-signal-blue min-h-touch">
                  Match to the unit list ›
                </button>
              </div>
            )}
        </div>
      )}

      <div className="border-t border-steel-500 p-2">
        <PilotDropZone unitId={unit.id} assignedPilot={assignedPilot} onUnassign={() => onUnassignPilot(unit.id)} />
      </div>
    </div>
  )
}
