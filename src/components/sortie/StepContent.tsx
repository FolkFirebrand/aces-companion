'use client'

import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { selectCampaignKeywords, selectFieldedPv, selectRearmingUnits, selectPvLimit, selectTotalExpenses, selectTotalIncome, selectSortieEarnings, selectDifficulty } from '@/store/selectors'
import { omniReconfigurationCost } from '@/lib/rules'
import { useUnitList } from '@/lib/unit-list/load'
import { OpposingForceStep } from './OpposingForceStep'
import { AddUnitForm } from '@/components/roster/AddUnitForm'
import { omniConfigurations, unitListName } from '@/lib/unit-list/convert'
import type { PurchaseEntry, Sortie } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { StatusTag } from '@/components/dossier/StatusTag'
import { Field, NumberInput, Readout, Section, Select, TextInput } from './fields'
import { CasualtiesStep } from './CasualtiesStep'
import { ImprovePilotsStep } from './ImprovePilotsStep'
import { HireSection } from './HireSection'

type Props = { sortie: Sortie }

function useSortie() {
  return useCampaignStore()
}

function RecordCampaignLog({ sortie }: Props) {
  const { updateSortie } = useSortie()
  return (
    <>
      <Field id="sortie-number" label="Sortie Number" hint="The number the Campaign Book gives this sortie. A replay keeps the same number.">
        <TextInput id="sortie-number" value={sortie.sortieNumber} onChange={sortieNumber => updateSortie(sortie.id, { sortieNumber })} className="max-w-[140px]" />
      </Field>
      <Field id="sortie-name" label="Sortie name">
        <TextInput id="sortie-name" value={sortie.name} onChange={name => updateSortie(sortie.id, { name })} />
      </Field>
      <Field id="date-played" label="Date played">
        <TextInput id="date-played" type="date" value={sortie.datePlayed} onChange={datePlayed => updateSortie(sortie.id, { datePlayed })} className="max-w-[200px]" />
      </Field>
    </>
  )
}

function PerformReconnaissance({ sortie }: Props) {
  const { updateSortie } = useSortie()
  return (
    <>
      <Field id="recon-cost" label="Reconnaissance cost (SP)" hint="The total SP for every option you chose.">
        <NumberInput id="recon-cost" value={sortie.reconnaissanceCost} onChange={reconnaissanceCost => updateSortie(sortie.id, { reconnaissanceCost })} />
      </Field>
      <Field id="recon-note" label="What you chose (optional)">
        <TextInput id="recon-note" value={sortie.reconnaissanceNote} placeholder="e.g. Recon B and D" onChange={reconnaissanceNote => updateSortie(sortie.id, { reconnaissanceNote })} />
      </Field>
    </>
  )
}

function PlayerForce({ sortie }: Props) {
  const { campaign, updateSortie, setFielded, assignFieldedPilot, setForceCommander } = useSortie()
  const limit = selectPvLimit(campaign, sortie)
  const fieldedPv = selectFieldedPv(sortie)
  const left = limit - fieldedPv
  const over = sortie.listedPv > 0 && left < 0
  const healthy = campaign.namedPilots.filter(p => !p.wounded)
  const wounded = campaign.namedPilots.filter(p => p.wounded)
  const fieldedPilots = sortie.fieldedUnits.flatMap(f => (f.pilotId ? [f.pilotId] : []))
  const rearming = selectRearmingUnits(sortie)
  const pilotName = (id: string | null) => campaign.namedPilots.find(p => p.id === id)?.callsign ?? ''

  // Where a pilot usually sits, so the picker can say "usually Talon TL-3, not fielded".
  function pilotOptionLabel(pilotId: string): string {
    const pilot = campaign.namedPilots.find(p => p.id === pilotId)!
    const here = sortie.fieldedUnits.find(f => f.pilotId === pilotId)
    if (here) return `${pilot.callsign} · on ${here.nameAndVariant}`
    const home = campaign.units.find(u => u.pilotId === pilotId)
    return home ? `${pilot.callsign} · usually ${home.nameAndVariant}, not fielded` : `${pilot.callsign} · unassigned`
  }

  return (
    <>
      <Field id="listed-pv" label="Listed PV" hint="The PV the sortie lets you field, before modifiers.">
        <NumberInput id="listed-pv" value={sortie.listedPv} onChange={listedPv => updateSortie(sortie.id, { listedPv })} />
      </Field>

      <div className="sticky top-0 z-20 -mx-gutter px-gutter py-3 bg-steel-800 border-y border-steel-500 flex flex-col gap-1.5">
        <div className="flex justify-between items-baseline">
          <span className="dossier-label text-text-secondary">Fielded</span>
          <span className={`font-stencil text-2xl tabular-nums ${over ? 'text-danger' : 'text-amber'}`}>
            {fieldedPv} <span className="text-base text-text-secondary">/ {limit} PV</span>
          </span>
        </div>
        <div className="h-2 bg-steel-900 border border-steel-500" aria-hidden="true">
          <div className={`h-full ${over ? 'bg-danger' : 'bg-amber'}`} style={{ width: `${limit > 0 ? Math.min(100, (fieldedPv / limit) * 100) : 0}%` }} />
        </div>
        <p className={`m-0 text-[13px] ${over ? 'text-danger' : 'text-signal-blue'}`}>
          {sortie.listedPv === 0 ? 'Enter the Listed PV to see your PV Limit.'
            : over ? `${-left} PV over your PV Limit. You can still play it this way.` : `${left} PV left`}
        </p>
      </div>

      <Section title={`Fielded units · ${sortie.fieldedUnits.length} of ${campaign.units.length}`} aside="PV at Skill 4">
        {campaign.units.length === 0 && <p className="m-0 text-sm text-text-secondary">Your roster has no units yet.</p>}
        {campaign.units.map(unit => {
          const fielded = sortie.fieldedUnits.find(f => f.unitId === unit.id)
          const wouldOver = !fielded && sortie.listedPv > 0 && fieldedPv + unit.pvAtSkill4 > limit
          const meta = [unit.unitType, `Size ${unit.size}`, unit.ene ? 'ENE' : null].filter(Boolean).join(' · ')
          return (
            <div key={unit.id} className="flex flex-col gap-1.5 py-2.5 border-b border-steel-500">
              <label className="flex items-center gap-2.5 min-h-touch cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!fielded}
                  onChange={e => setFielded(sortie.id, unit.id, e.target.checked)}
                  className="w-6 h-6 shrink-0 accent-[var(--color-amber)]"
                />
                <span className="flex-1 flex flex-col gap-0.5">
                  <span className={fielded ? '' : 'text-text-secondary'}>{unit.nameAndVariant || 'Unnamed unit'}</span>
                  <span className="font-condensed font-semibold text-xs tracking-[1px] uppercase text-text-secondary">
                    {meta}{wouldOver ? ` · would go ${fieldedPv + unit.pvAtSkill4 - limit} PV over` : ''}
                  </span>
                </span>
                <span className={`font-stencil text-lg tabular-nums ${fielded ? 'text-amber' : 'text-text-disabled'}`}>{unit.pvAtSkill4}</span>
              </label>
              {fielded && (
                <div className="flex items-center gap-2 pl-[34px]">
                  <label htmlFor={`pilot-${unit.id}`} className="dossier-label text-text-secondary w-12">Pilot</label>
                  <Select id={`pilot-${unit.id}`} value={fielded.pilotId ?? ''} onChange={v => assignFieldedPilot(sortie.id, unit.id, v || null)} className="flex-1">
                    <option value="">Generic Skill 4 crew</option>
                    {healthy.map(p => <option key={p.id} value={p.id}>{pilotOptionLabel(p.id)}</option>)}
                  </Select>
                  {fielded.pilotId && fielded.pilotId === sortie.forceCommanderPilotId && <StatusTag tone="amber">Commander</StatusTag>}
                </div>
              )}
            </div>
          )
        })}
      </Section>

      {campaign.namedPilots.length > 0 && (
        <Section title="Named Pilots" aside={`${fieldedPilots.length} of ${campaign.namedPilots.length} fielded`}>
          {healthy.filter(p => !fieldedPilots.includes(p.id)).map(p => (
            <div key={p.id} className="flex justify-between items-center py-2 border-b border-steel-500 text-[15px]">
              <span>{p.callsign}</span><StatusTag tone="neutral">Sitting out · half SP</StatusTag>
            </div>
          ))}
          {wounded.map(p => (
            <div key={p.id} className="flex justify-between items-center py-2 border-b border-steel-500 text-[15px]">
              <span>{p.callsign}</span><StatusTag tone="hurt">Wounded · sits out</StatusTag>
            </div>
          ))}
          {wounded.length > 0 && <p className="m-0 text-[13px] text-text-secondary">Wounded pilots can&apos;t be fielded this sortie. They&apos;re back for the next one.</p>}
        </Section>
      )}

      <Section title="Force Commander">
        <Field id="commander" label="One of the Named Pilots you fielded">
          <Select id="commander" value={sortie.forceCommanderPilotId ?? ''} onChange={v => setForceCommander(sortie.id, v || null)}>
            <option value="">Choose a Force Commander</option>
            {fieldedPilots.map(id => {
              const unit = sortie.fieldedUnits.find(f => f.pilotId === id)
              return <option key={id} value={id}>{pilotName(id)} · {unit?.nameAndVariant}</option>
            })}
          </Select>
        </Field>
      </Section>

      <Readout label={`Rearming · ${rearming} × 20 SP`} value={`${rearming * 20} SP`} tone="text-signal-blue" />

      <OmniReconfiguration sortie={sortie} />
    </>
  )
}

function OmniReconfiguration({ sortie }: Props) {
  const { campaign, reconfigureOmni, removePurchase } = useSortie()
  const [unitId, setUnitId] = useState('')
  const [toName, setToName] = useState('')
  const [toPv, setToPv] = useState(0)
  const [toEntryId, setToEntryId] = useState('')
  const unit = campaign.units.find(u => u.id === unitId)
  const omni = sortie.purchases.filter(p => p.kind === 'omni')
  // A unit linked to the unit list offers its real configurations (#39).
  const unitList = useUnitList(!!unit?.unitListId)
  const entry = unitList?.find(e => e.id === unit?.unitListId)
  const configurations = unitList && entry ? omniConfigurations(unitList, entry).filter(e => e.id !== entry.id) : []
  const toEntry = configurations.find(e => e.id === toEntryId)

  function reset() {
    setUnitId(''); setToName(''); setToPv(0); setToEntryId('')
  }

  return (
    <Section title="OMNI reconfiguration" aside="Size × 5 or PV diff × 40">
      {omni.map(p => <PurchaseLine key={p.id} purchase={p} onRemove={() => removePurchase(sortie.id, p.id)} />)}
      <Field id="omni-unit" label="OMNI unit">
        <Select id="omni-unit" value={unitId} onChange={id => { reset(); setUnitId(id) }}>
          <option value="">Choose a unit</option>
          {campaign.units.map(u => <option key={u.id} value={u.id}>{u.nameAndVariant} ({u.pvAtSkill4} PV)</option>)}
        </Select>
      </Field>
      {unit && (
        <>
          {configurations.length > 0 && (
            <Field id="omni-config" label="Configuration from the unit list">
              <Select id="omni-config" value={toEntryId} onChange={id => {
                const picked = configurations.find(e => e.id === id)
                setToEntryId(id)
                if (picked) { setToName(unitListName(picked)); setToPv(picked.pv) }
              }}>
                <option value="">Choose a configuration</option>
                {configurations.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.model} · {e.pv} PV · Size {e.size} · {omniReconfigurationCost(unit.pvAtSkill4, e.pv, unit.size)} SP
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field id="omni-to" label="New configuration">
            <TextInput id="omni-to" value={toName} onChange={setToName} />
          </Field>
          <Field id="omni-pv" label="New PV at Skill 4" hint={`Costs ${omniReconfigurationCost(unit.pvAtSkill4, toPv, unit.size)} SP`}>
            <NumberInput id="omni-pv" value={toPv} onChange={setToPv} />
          </Field>
          <DossierButton
            variant="secondary"
            className="self-start"
            disabled={!toName || toPv <= 0}
            onClick={() => { reconfigureOmni(sortie.id, unit.id, toName, toPv, toEntry); reset() }}
          >
            + Reconfigure
          </DossierButton>
        </>
      )}
    </Section>
  )
}

function TriggerGameEndWaypoints({ sortie }: Props) {
  const { updateSortie } = useSortie()
  return (
    <>
      <Field id="waypoints-sp" label="Waypoint SP costs" hint="The total SP that waypoint text told you to pay during the sortie.">
        <NumberInput id="waypoints-sp" value={sortie.waypointsSP} onChange={waypointsSP => updateSortie(sortie.id, { waypointsSP })} />
      </Field>
      <Field id="waypoints-note" label="Which waypoints (optional)">
        <TextInput id="waypoints-note" value={sortie.waypointsNote} placeholder="e.g. Waypoint 4, Waypoint 9" onChange={waypointsNote => updateSortie(sortie.id, { waypointsNote })} />
      </Field>
    </>
  )
}

function ReadSortieOutcome({ sortie }: Props) {
  const { campaign, updateSortie } = useSortie()
  const [draft, setDraft] = useState('')
  const known = selectCampaignKeywords(campaign)
  const keywords = sortie.keywordsGained

  function add(keyword: string) {
    const clean = keyword.trim()
    if (!clean || keywords.some(k => k.toLowerCase() === clean.toLowerCase())) return
    updateSortie(sortie.id, { keywordsGained: [...keywords, clean] })
    setDraft('')
  }

  return (
    <>
      <p className="m-0 text-sm text-text-secondary">Read the outcome waypoint aloud. Record any keywords it gives your force; later sorties may ask whether you have them.</p>
      <Section title="Keywords gained">
        {keywords.length === 0 && <p className="m-0 text-sm text-text-secondary">None yet.</p>}
        {keywords.map(k => (
          <div key={k} className="flex items-center gap-2.5 py-1 border-b border-steel-500 min-h-touch">
            <span className="flex-1"><StatusTag tone="keyword">{k.toUpperCase()}</StatusTag></span>
            <button type="button" aria-label={`Remove ${k}`} onClick={() => updateSortie(sortie.id, { keywordsGained: keywords.filter(x => x !== k) })} className="h-touch w-touch text-text-secondary">✕</button>
          </div>
        ))}
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); add(draft) }}>
          <Field id="keyword" label="Keyword">
            <TextInput id="keyword" value={draft} onChange={setDraft} list="known-keywords" className="min-w-[200px]" />
          </Field>
          <datalist id="known-keywords">{known.map(k => <option key={k} value={k} />)}</datalist>
          <DossierButton variant="secondary" type="submit" disabled={!draft.trim()}>+ Add keyword</DossierButton>
        </form>
      </Section>
    </>
  )
}

function NextSteps({ sortie }: Props) {
  const { updateSortie } = useSortie()
  return (
    <Field id="next-sortie" label="Next sortie" hint="The outcome tells you which sortie to play next. This note shows on the Campaign Log so the next session knows where to start.">
      <TextInput id="next-sortie" value={sortie.nextSortieNote} placeholder="e.g. Sortie 06" onChange={nextSortieNote => updateSortie(sortie.id, { nextSortieNote })} />
    </Field>
  )
}

function CalculateIncomeAndExpenses({ sortie }: Props) {
  const { campaign, updateSortie } = useSortie()
  const earnings = selectSortieEarnings(campaign, sortie)
  return (
    <>
      <Section title="Income" aside={`× ${selectDifficulty(campaign).spPercent}%`}>
        <Field id="primary" label="Primary Objective (SP)">
          <NumberInput id="primary" value={sortie.primaryObjective} onChange={primaryObjective => updateSortie(sortie.id, { primaryObjective })} />
        </Field>
        <Field id="other" label="Other Objectives (SP)">
          <NumberInput id="other" value={sortie.otherObjectives} onChange={otherObjectives => updateSortie(sortie.id, { otherObjectives })} />
        </Field>
        <Readout label="Total Income" value={selectTotalIncome(campaign, sortie)} />
      </Section>
      <Section title="Expenses">
        <Readout label={`Rearming · ${selectRearmingUnits(sortie)} units without ENE × 20`} value={selectRearmingUnits(sortie) * 20} tone="text-signal-blue" />
        <Readout label="Total Expenses" value={selectTotalExpenses(sortie)} tone="text-text-primary" />
      </Section>
      <HireSection sortie={sortie} />
      <Readout label="Earnings" value={`${earnings >= 0 ? '+' : '−'}${Math.abs(earnings)} SP`} tone={earnings >= 0 ? 'text-amber' : 'text-danger'} />
    </>
  )
}

function PurchaseLine({ purchase, onRemove }: { purchase: PurchaseEntry; onRemove: () => void }) {
  const label = purchase.kind === 'buy'
    ? <>{purchase.unit.nameAndVariant} <span className="text-text-secondary">· {purchase.unit.pvAtSkill4} PV</span></>
    : purchase.kind === 'sell'
      ? <>{purchase.unitName} <span className="text-text-secondary">· {purchase.pvAtSkill4} PV</span></>
      : <>{purchase.fromName} → {purchase.toName}</>
  const credit = purchase.spCost < 0
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-steel-500 min-h-touch">
      <span className="flex-1">{label}</span>
      <span className={`font-stencil text-lg tabular-nums ${credit ? 'text-signal-blue' : 'text-amber'}`}>
        {credit ? `+${-purchase.spCost}` : `−${purchase.spCost}`}
      </span>
      <button type="button" aria-label="Remove" onClick={onRemove} className="h-touch w-touch text-text-secondary">✕</button>
    </div>
  )
}

function PurchaseAdditionalUnits({ sortie }: Props) {
  const { campaign, buyUnit, sellUnit, removePurchase } = useSortie()
  const [buying, setBuying] = useState(false)
  const [sellId, setSellId] = useState('')
  const buys = sortie.purchases.filter(p => p.kind === 'buy')
  const sells = sortie.purchases.filter(p => p.kind === 'sell')
  const omni = sortie.purchases.filter(p => p.kind === 'omni')
  const net = sortie.purchases.reduce((sum, p) => sum + p.spCost, 0)
  const sellable = campaign.units.filter(u => !sells.some(s => s.unitId === u.id))

  return (
    <>
      <Section title="Buy" aside="PV × 40">
        {buys.map(p => <PurchaseLine key={p.id} purchase={p} onRemove={() => removePurchase(sortie.id, p.id)} />)}
        {buying
          ? <AddUnitForm unitList submitLabel="Buy unit (PV × 40)" onAdd={unit => { buyUnit(sortie.id, unit); setBuying(false) }} onCancel={() => setBuying(false)} />
          : <DossierButton variant="secondary" className="self-start" onClick={() => setBuying(true)}>+ Buy a unit</DossierButton>}
      </Section>

      <Section title="Sell" aside="PV × 20">
        {sells.map(p => <PurchaseLine key={p.id} purchase={p} onRemove={() => removePurchase(sortie.id, p.id)} />)}
        <div className="flex flex-wrap items-end gap-3">
          <Field id="sell-unit" label="Unit to sell">
            <Select id="sell-unit" value={sellId} onChange={setSellId}>
              <option value="">Choose a unit</option>
              {sellable.map(u => <option key={u.id} value={u.id}>{u.nameAndVariant} ({u.pvAtSkill4} PV)</option>)}
            </Select>
          </Field>
          <DossierButton variant="secondary" disabled={!sellId} onClick={() => { sellUnit(sortie.id, sellId); setSellId('') }}>
            + Sell unit
          </DossierButton>
        </div>
      </Section>

      {omni.length > 0 && (
        <Section title="OMNI reconfiguration" aside="From setup step 5">
          {omni.map(p => <PurchaseLine key={p.id} purchase={p} onRemove={() => removePurchase(sortie.id, p.id)} />)}
        </Section>
      )}

      <div className="bg-steel-800 border border-steel-500">
        <div className="flex justify-between px-3 py-2 bg-amber text-on-amber font-condensed font-bold text-sm tracking-[1px]">
          <span>PURCHASES (NET)</span><span>{net} SP</span>
        </div>
        <p className="m-0 px-3 py-2.5 text-sm text-text-secondary">Bought units join and sold units leave your force when you complete the sortie.</p>
      </div>
    </>
  )
}

const CONTENT: Record<string, (props: Props) => React.ReactElement> = {
  'setup-1': RecordCampaignLog,
  'setup-3': PerformReconnaissance,
  'setup-5': PlayerForce,
  'setup-6': OpposingForceStep,
  'after-1': TriggerGameEndWaypoints,
  'after-2': ReadSortieOutcome,
  'after-7': NextSteps,
  'after-3': CasualtiesStep,
  'after-4': CalculateIncomeAndExpenses,
  'after-5': ImprovePilotsStep,
  'after-6': PurchaseAdditionalUnits,
}

export function StepContent({ stepId, sortie }: { stepId: string; sortie: Sortie }) {
  const Content = CONTENT[stepId]
  if (!Content) return <p className="m-0 text-text-secondary">Nothing to record for this step. Tick it off when it is done at the table.</p>
  return <Content sortie={sortie} />
}
