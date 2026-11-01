'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { battleDamageState, hasPending, trulyDestroyedCause, unitBattle } from '@/lib/battle'
import {
  selectCrewCasualtyCount, selectCrewOutcome, selectNewPilotCount, selectPersonnelCost, selectRepairCost, selectTrulyDestroyed, selectUnitRepairCost,
} from '@/store/selectors'
import { repairSize, roll2d6, salvageTarget } from '@/lib/rules'
import type { CrewMode, DamageState, FieldedUnit, Sortie, TrulyDestroyedCause } from '@/lib/types'
import { DiceRoll } from '@/components/dossier/DiceRoll'
import { Readout, Section, Select } from './fields'
import { cn } from '@/lib/utils'

const DAMAGE: { state: DamageState; label: string }[] = [
  { state: 'undamaged', label: 'Undamaged' },
  { state: 'armor', label: 'Armor only' },
  { state: 'structure', label: 'Structure / crits' },
  { state: 'crippled', label: 'Crippled' },
  { state: 'destroyed', label: 'Destroyed' },
]

const AUTO_CAUSES: { cause: TrulyDestroyedCause; label: string }[] = [
  { cause: 'ammo', label: 'Ammo or fuel critical without CASE' },
  { cause: 'emplacement', label: 'Emplacement' },
  { cause: 'airborne', label: 'Airborne, destroyed by crashing' },
]

const CREW_MODES: { mode: CrewMode; label: string }[] = [
  { mode: 'roll', label: 'Roll 2D6' },
  { mode: 'stunned', label: 'Crew Stunned' },
  { mode: 'killed', label: 'Crew Killed / Unit Destroyed' },
]

function DestroyedPanel({ sortie, unit, pilotName }: { sortie: Sortie; unit: FieldedUnit; pilotName: string | null }) {
  const { updateFieldedUnit } = useCampaignStore()
  const update = (partial: Partial<FieldedUnit>) => updateFieldedUnit(sortie.id, unit.unitId, partial)
  const truly = selectTrulyDestroyed(unit)
  const crew = selectCrewOutcome(unit)
  const target = salvageTarget(unit.unitType)
  const who = pilotName ?? 'Crew'

  return (
    <div className="bg-surface border border-line mb-2.5">
      <div className={cn('flex justify-between px-3 py-2 font-label font-bold text-sm tracking-[1px] uppercase',
        truly ? 'bg-danger text-ink' : 'bg-active text-on-active')}>
        <span>{unit.nameAndVariant} · Destroyed</span>
        <span>{truly === null ? 'Roll salvage' : truly ? 'Truly destroyed' : 'Salvaged'}</span>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <fieldset className="flex flex-col border-0 p-0 m-0">
          <legend className="field-label text-text-secondary mb-1">Truly destroyed automatically</legend>
          {AUTO_CAUSES.map(({ cause, label }) => (
            <label key={cause} className="flex items-center gap-2.5 min-h-touch text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={unit.autoTrulyDestroyed === cause}
                onChange={e => update({ autoTrulyDestroyed: e.target.checked ? cause : null, setByHand: true })}
                className="w-[22px] h-[22px] accent-[var(--color-active)]"
              />
              {label}
            </label>
          ))}
        </fieldset>

        {unit.autoTrulyDestroyed ? (
          <p className="m-0 text-[13px] text-danger">No salvage. It leaves your force for the Memorial when you complete the sortie.</p>
        ) : (
          <DiceRoll
            id={`salvage-${unit.unitId}`}
            label="Salvage check"
            target={`${target}+`}
            value={unit.salvageRoll}
            onChange={salvageRoll => update({ salvageRoll })}
            onRoll={() => update({ salvageRoll: roll2d6() })}
            outcome={truly === null ? undefined : truly
              ? { text: 'Failed. Truly destroyed: it goes to the Memorial when you complete the sortie.', tone: 'danger' }
              : { text: `Salvaged. Repair Size ${repairSize(unit.unitType, unit.size)} × 100 = ${selectUnitRepairCost(unit)} SP`, tone: 'computed' }}
          />
        )}

        <fieldset className="flex flex-col gap-1.5 border-0 p-0 m-0">
          <legend className="field-label text-text-secondary mb-1">Crew · {pilotName ? `${pilotName} (Named Pilot)` : 'generic crew'}</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {CREW_MODES.map(({ mode, label }) => (
              <label key={mode} className={cn(
                'min-h-touch px-1 flex items-center justify-center text-center border font-label font-bold text-[12px] leading-tight tracking-[1px] uppercase cursor-pointer',
                unit.crewMode === mode ? 'bg-active border-active text-on-active' : 'border-line text-text-secondary hover:border-active'
              )}>
                <input type="radio" name={`crew-${unit.unitId}`} checked={unit.crewMode === mode} onChange={() => update({ crewMode: mode })} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {unit.crewMode === 'roll' && (
          <DiceRoll
            id={`crew-${unit.unitId}`}
            label="Crew check"
            value={unit.crewRoll}
            onChange={crewRoll => update({ crewRoll })}
            onRoll={() => update({ crewRoll: roll2d6() })}
          />
        )}
        {crew && (
          <p className={cn('m-0 text-[13px]', crew === 'unscathed' ? 'text-result' : 'text-danger')}>
            {crew === 'unscathed' && `${who} unscathed.`}
            {crew === 'wounded' && (pilotName ? `${pilotName} wounded: sits out the next sortie · 100 SP.` : 'Crew wounded · replace for 100 SP.')}
            {crew === 'killed' && (pilotName ? `${pilotName} killed in action: goes to the Memorial.` : 'Crew killed · replace for 100 SP.')}
            {pilotName && ' Named Pilots can’t reroll this with Edge.'}
          </p>
        )}
      </div>
    </div>
  )
}

export function CasualtiesStep({ sortie }: { sortie: Sortie }) {
  const { campaign, updateFieldedUnit, syncBattleResults } = useCampaignStore()
  // Play mode's applied marks fill in Damage States here; units the player set by hand are left alone (#46).
  useEffect(() => { syncBattleResults(sortie.id) }, [syncBattleResults, sortie.id, sortie.battle])
  const fromBattle = sortie.fieldedUnits.filter(f => sortie.battle?.units[f.unitId])
  const pendingInPlay = Object.values(sortie.battle?.units ?? {}).filter(r => hasPending(r)).length
  const battleResult = (f: FieldedUnit) => {
    const unit = campaign.units.find(u => u.id === f.unitId)
    if (!unit || !sortie.battle?.units[f.unitId]) return null
    const marks = unitBattle(sortie.battle, f.unitId).committed
    return { damage: battleDamageState(marks, unit), cause: trulyDestroyedCause(marks, unit) }
  }
  const pilotName = (id: string | null) => campaign.namedPilots.find(p => p.id === id)?.callsign ?? null
  const crewCount = selectCrewCasualtyCount(sortie) + sortie.legacyWoundedOrKilledCrew

  const consequences = sortie.fieldedUnits.flatMap(f => {
    const name = pilotName(f.pilotId)
    return [
      ...(selectTrulyDestroyed(f) === true ? [`${f.nameAndVariant} goes to the Memorial (truly destroyed)`] : []),
      ...(name && selectCrewOutcome(f) === 'killed' ? [`${name} goes to the Memorial (killed in action)`] : []),
      ...(name && selectCrewOutcome(f) === 'wounded' ? [`${name} is Wounded and sits out the next sortie`] : []),
    ]
  })

  if (sortie.fieldedUnits.length === 0) {
    return <p className="m-0 text-sm text-text-secondary">No units were fielded. Choose them in Sortie Setup step 5, Player Force.</p>
  }

  return (
    <>
      {fromBattle.length > 0 && (
        <p className="m-0 text-[13px] text-text-secondary">
          Damage States come from <Link href={`/sortie/${sortie.id}/play`} className="text-result underline">play mode</Link>&apos;s applied marks.
          Change any by hand and it stays your choice.
        </p>
      )}
      {pendingInPlay > 0 && (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {pendingInPlay} unit{pendingInPlay === 1 ? ' has' : 's have'} pending changes in play mode, which aren&apos;t counted here.{' '}
          <Link href={`/sortie/${sortie.id}/play`} className="underline">Apply or discard them</Link>.
        </p>
      )}
      <Section title={`Damage · ${sortie.fieldedUnits.length} fielded units`} aside="Repair">
        {sortie.fieldedUnits.map(unit => {
          const name = pilotName(unit.pilotId)
          const meta = [unit.unitType === 'BattleMech' ? null : unit.unitType, `Size ${unit.size}${unit.unitType === 'BattleMech' ? '' : ' → ½'}`].filter(Boolean).join(' · ')
          const truly = selectTrulyDestroyed(unit)
          return (
            <div key={unit.unitId}>
              <div className="flex items-center gap-2.5 py-2.5 border-b border-line">
                <span className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[15px]">{unit.nameAndVariant} <span className="text-text-secondary">· {name ?? 'crew'}</span></span>
                  <span className="font-label font-semibold text-xs tracking-[1px] uppercase text-text-secondary">{meta}</span>
                </span>
                <label htmlFor={`damage-${unit.unitId}`} className="sr-only">{unit.nameAndVariant} damage</label>
                <Select
                  id={`damage-${unit.unitId}`}
                  value={unit.damage}
                  onChange={v => updateFieldedUnit(sortie.id, unit.unitId, { damage: v as DamageState, setByHand: true })}
                  className={cn('w-[150px] text-sm', unit.damage === 'destroyed' && 'border-danger')}
                >
                  {DAMAGE.map(d => <option key={d.state} value={d.state}>{d.label}</option>)}
                </Select>
                <span className={cn('font-display font-bold text-base w-12 text-right tabular-nums', truly ? 'text-text-disabled' : 'text-result')}>
                  {truly ? '—' : selectUnitRepairCost(unit)}
                </span>
              </div>
              {(() => {
                const result = battleResult(unit)
                if (!unit.setByHand || !result || (result.damage === unit.damage && (result.cause ?? null) === (unit.autoTrulyDestroyed === 'ammo' ? 'ammo' : null))) return null
                return (
                  <button type="button" className="field-label text-result min-h-touch"
                    onClick={() => updateFieldedUnit(sortie.id, unit.unitId, {
                      damage: result.damage, autoTrulyDestroyed: result.cause ?? (unit.autoTrulyDestroyed === 'ammo' ? null : unit.autoTrulyDestroyed), setByHand: false,
                    })}>
                    Use battle result ({DAMAGE.find(d => d.state === result.damage)?.label})
                  </button>
                )
              })()}
              {unit.damage === 'destroyed' && <DestroyedPanel sortie={sortie} unit={unit} pilotName={name} />}
            </div>
          )
        })}
      </Section>

      <div className="bg-surface border border-line">
        <Readout label="Repairs · Size × 100 / 60 / 40 / 20" value={`${selectRepairCost(sortie)} SP`} tone="text-result" />
        <Readout label={`Personnel · ${crewCount} × 100`} value={`${selectPersonnelCost(sortie) - selectNewPilotCount(sortie) * 150} SP`} tone="text-result" />
      </div>

      {consequences.length > 0 && (
        <Section title="When you complete the sortie">
          <ul className="m-0 pl-5 flex flex-col gap-1 text-sm">
            {consequences.map(c => <li key={c}>{c}</li>)}
          </ul>
        </Section>
      )}
    </>
  )
}
