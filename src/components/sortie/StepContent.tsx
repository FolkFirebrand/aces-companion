'use client'

import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { selectCampaignKeywords, selectCanPilot, selectFieldedPv, selectRearmingUnits, selectPvLimit, selectTotalExpenses, selectTotalIncome, selectSortieEarnings, selectDifficulty, selectWaypointsNet } from '@/store/selectors'
import { omniReconfigurationCost } from '@/lib/rules'
import { useUnitList } from '@/lib/unit-list/load'
import { OpposingForceStep } from './OpposingForceStep'
import { BuyUnitPanel } from './BuyUnitPanel'
import { omniConfigurations, unitListName } from '@/lib/unit-list/convert'
import type { PurchaseEntry, Sortie, Unit } from '@/lib/types'
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
  // A unit reconfigured this sortie goes by its new configuration everywhere on this step.
  const unitName = (unitId: string, name: string) => reconfigurationOf(sortie, unitId)?.toName ?? name

  // A pilot left out can climb into a unit of their type: a fielded one swaps out its crew, an unfielded one joins the sortie.
  // Once units are fielded, only those are offered.
  function mountableUnits(pilotId: string) {
    const pilot = campaign.namedPilots.find(p => p.id === pilotId)!
    const pool = sortie.fieldedUnits.length > 0
      ? campaign.units.filter(u => sortie.fieldedUnits.some(f => f.unitId === u.id))
      : campaign.units
    return pool.filter(u => selectCanPilot(pilot, u))
  }

  function mountUp(pilotId: string, unitId: string) {
    if (!unitId) return
    if (!sortie.fieldedUnits.some(f => f.unitId === unitId)) setFielded(sortie.id, unitId, true)
    assignFieldedPilot(sortie.id, unitId, pilotId)
  }

  function mountOptionLabel(unitId: string): string {
    const unit = campaign.units.find(u => u.id === unitId)!
    const fielded = sortie.fieldedUnits.find(f => f.unitId === unitId)
    if (!fielded) return `${unitName(unitId, unit.nameAndVariant)} · not fielded, adds ${reconfigurationOf(sortie, unitId)?.toPv ?? unit.pvAtSkill4} PV`
    return `${unitName(unitId, unit.nameAndVariant)} · ${fielded.pilotId ? `replaces ${pilotName(fielded.pilotId)}` : 'replaces generic crew'}`
  }

  // Where a pilot usually sits, so the picker can say "usually Talon TL-3, not fielded".
  function pilotOptionLabel(pilotId: string): string {
    const pilot = campaign.namedPilots.find(p => p.id === pilotId)!
    const here = sortie.fieldedUnits.find(f => f.pilotId === pilotId)
    if (here) return `${pilot.callsign} · on ${unitName(here.unitId, here.nameAndVariant)}`
    const home = campaign.units.find(u => u.pilotId === pilotId)
    return home ? `${pilot.callsign} · usually ${unitName(home.id, home.nameAndVariant)}, not fielded` : `${pilot.callsign} · unassigned`
  }

  return (
    <>
      <Field id="listed-pv" label="Listed PV" hint="The PV the sortie lets you field, before modifiers.">
        <NumberInput id="listed-pv" value={sortie.listedPv} onChange={listedPv => updateSortie(sortie.id, { listedPv })} />
      </Field>

      <div className="sticky top-0 z-20 -mx-gutter px-gutter py-3 bg-surface border-y border-line flex flex-col gap-1.5">
        <div className="flex justify-between items-baseline">
          <span className="field-label text-text-secondary">Fielded</span>
          <span className={`font-display font-bold text-2xl tabular-nums ${over ? 'text-danger' : 'text-active'}`}>
            {fieldedPv} <span className="text-base text-text-secondary">/ {limit} PV</span>
          </span>
        </div>
        <div className="h-2 bg-surface-deep border border-line" aria-hidden="true">
          <div className={`h-full ${over ? 'bg-danger' : 'bg-active'}`} style={{ width: `${limit > 0 ? Math.min(100, (fieldedPv / limit) * 100) : 0}%` }} />
        </div>
        <p className={`m-0 text-[13px] ${over ? 'text-danger' : 'text-result'}`}>
          {sortie.listedPv === 0 ? 'Enter the Listed PV to see your PV Limit.'
            : over ? `${-left} PV over your PV Limit. You can still play it this way.` : `${left} PV left`}
        </p>
      </div>

      <Section title={`Fielded units · ${sortie.fieldedUnits.length} of ${campaign.units.length}`} aside="PV at Skill 4">
        {campaign.units.length === 0 && <p className="m-0 text-sm text-text-secondary">Your roster has no units yet.</p>}
        {campaign.units.map(unit => {
          const fielded = sortie.fieldedUnits.find(f => f.unitId === unit.id)
          const reconfigured = reconfigurationOf(sortie, unit.id)
          const pv = reconfigured?.toPv ?? unit.pvAtSkill4
          const wouldOver = !fielded && sortie.listedPv > 0 && fieldedPv + pv > limit
          const fits = !fielded && sortie.listedPv > 0 && !wouldOver
          const meta = [unit.unitType, `Size ${unit.size}`, unit.ene ? 'ENE' : null].filter(Boolean).join(' · ')
          return (
            <div key={unit.id} className="flex flex-col gap-1.5 py-2.5 border-b border-line">
              <label className="flex items-center gap-2.5 min-h-touch cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!fielded}
                  onChange={e => setFielded(sortie.id, unit.id, e.target.checked)}
                  className="w-6 h-6 shrink-0 accent-[var(--color-active)]"
                />
                <span className="flex-1 flex flex-col gap-0.5">
                  <span className={fielded ? '' : 'text-text-secondary'}>
                    {reconfigured?.toName ?? (unit.nameAndVariant || 'Unnamed unit')}
                    {reconfigured && <StatusTag tone="keyword" className="ml-2 align-middle">Reconfigured</StatusTag>}
                  </span>
                  <span className="font-label font-semibold text-xs tracking-[1px] uppercase text-text-secondary">
                    {meta}{wouldOver ? ` · would go ${fieldedPv + pv - limit} PV over` : ''}
                  </span>
                </span>
                <span className={`font-display font-bold text-lg tabular-nums ${fielded ? 'text-active' : fits ? 'text-result' : 'text-text-disabled'}`}>{pv}</span>
              </label>
              {fielded && (
                <div className="flex items-center gap-2 pl-[34px]">
                  <label htmlFor={`pilot-${unit.id}`} className="field-label text-text-secondary w-12">Pilot</label>
                  <Select id={`pilot-${unit.id}`} value={fielded.pilotId ?? ''} onChange={v => assignFieldedPilot(sortie.id, unit.id, v || null)} className="flex-1">
                    <option value="">Generic Skill 4 crew</option>
                    {healthy.filter(p => selectCanPilot(p, unit) || p.id === fielded.pilotId).map(p => <option key={p.id} value={p.id}>{pilotOptionLabel(p.id)}</option>)}
                  </Select>
                  {fielded.pilotId && fielded.pilotId === sortie.forceCommanderPilotId && <StatusTag tone="active">Commander</StatusTag>}
                </div>
              )}
              {isOmni(unit) && <OmniReconfigure sortie={sortie} unit={unit} />}
            </div>
          )
        })}
      </Section>

      {campaign.namedPilots.length > 0 && (
        <Section title="Named Pilots" aside={`${fieldedPilots.length} of ${campaign.namedPilots.length} fielded`}>
          {healthy.filter(p => !fieldedPilots.includes(p.id)).map(p => {
            const mountable = mountableUnits(p.id)
            return (
              <div key={p.id} className="flex flex-col gap-1.5 py-2 border-b border-line text-[15px]">
                <div className="flex justify-between items-center gap-2">
                  <span className="flex items-baseline gap-2">
                    {p.callsign}
                    <span className="font-label font-bold text-xs tracking-[1px] uppercase text-text-secondary">{p.pilotType}</span>
                  </span>
                  <StatusTag tone="neutral">Sitting out · half SP</StatusTag>
                </div>
                {mountable.length === 0 && campaign.units.length > 0 && (
                  <p className="m-0 text-[13px] text-text-secondary">
                    {sortie.fieldedUnits.length > 0 ? `No fielded ${p.pilotType} for ${p.callsign} to crew.` : `No ${p.pilotType} on your Roster for ${p.callsign} to crew.`}
                  </p>
                )}
                {mountable.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor={`mount-${p.id}`} className="field-label text-text-secondary whitespace-nowrap">Mount up</label>
                    <Select id={`mount-${p.id}`} value="" onChange={unitId => mountUp(p.id, unitId)} className="flex-1">
                      <option value="">Choose a {p.pilotType} for {p.callsign}</option>
                      {mountable.map(u => <option key={u.id} value={u.id}>{mountOptionLabel(u.id)}</option>)}
                    </Select>
                  </div>
                )}
              </div>
            )
          })}
          {wounded.map(p => (
            <div key={p.id} className="flex justify-between items-center py-2 border-b border-line text-[15px]">
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
              return <option key={id} value={id}>{pilotName(id)} · {unit && unitName(unit.unitId, unit.nameAndVariant)}</option>
            })}
          </Select>
        </Field>
      </Section>

      <Readout label={`Rearming · ${rearming} × 20 SP`} value={`${rearming * 20} SP`} tone="text-result" />
    </>
  )
}

const isOmni = (unit: Unit) => !!unit.abilities?.some(a => a.trim().toUpperCase() === 'OMNI')

/** The OMNI reconfiguration this sortie made to a unit, if any; the latest one wins. */
function reconfigurationOf(sortie: Sortie, unitId: string) {
  const found = [...sortie.purchases].reverse().find(p => p.kind === 'omni' && p.unitId === unitId)
  return found?.kind === 'omni' ? found : undefined
}

/** Setup step 5: reconfigure an OMNI from its own row, so the PV Limit counts its new PV straight away. */
function OmniReconfigure({ sortie, unit }: Props & { unit: Unit }) {
  const { reconfigureOmni, removePurchase } = useSortie()
  const [open, setOpen] = useState(false)
  const [toName, setToName] = useState('')
  const [toPv, setToPv] = useState(0)
  const [toEntryId, setToEntryId] = useState('')
  const done = reconfigurationOf(sortie, unit.id)
  // A unit linked to the unit list offers its real configurations (#39).
  const unitList = useUnitList(open && !!unit.unitListId)
  const entry = unitList?.find(e => e.id === unit.unitListId)
  const configurations = unitList && entry ? omniConfigurations(unitList, entry).filter(e => e.id !== entry.id) : []
  const toEntry = configurations.find(e => e.id === toEntryId)

  function close() {
    setOpen(false); setToName(''); setToPv(0); setToEntryId('')
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 pl-[34px] text-[13px] text-text-secondary">
        <span className="flex-1">
          Was {unit.nameAndVariant} ({done.fromPv} PV) · costs {done.spCost} SP
        </span>
        <button type="button" onClick={() => removePurchase(sortie.id, done.id)}
          aria-label={`Undo reconfiguring ${unit.nameAndVariant}`}
          className="min-h-touch px-2 field-label text-result hover:underline">Undo</button>
      </div>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start ml-[34px] min-h-touch field-label text-result hover:underline">
        Reconfigure OMNI ›
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2.5 ml-[34px] p-3 bg-surface border border-line">
      {unit.unitListId && !unitList && <p className="m-0 text-sm text-text-secondary">Loading configurations…</p>}
      {(!unit.unitListId || unitList) && (configurations.length > 0 ? (
        <Field id={`omni-config-${unit.id}`} label="New configuration" hint={toEntry ? `Costs ${omniReconfigurationCost(unit.pvAtSkill4, toEntry.pv, unit.size)} SP` : 'Size × 5 or PV difference × 40 SP'}>
          <Select id={`omni-config-${unit.id}`} value={toEntryId} onChange={id => {
            const picked = configurations.find(e => e.id === id)
            setToEntryId(id)
            if (picked) { setToName(unitListName(picked)); setToPv(picked.pv) }
          }}>
            <option value="">Choose a configuration</option>
            {configurations.map(e => (
              <option key={e.id} value={e.id}>
                {e.model} · {e.pv} PV · {omniReconfigurationCost(unit.pvAtSkill4, e.pv, unit.size)} SP
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        // Not in the unit list (an imported or hand-entered OMNI): name the configuration by hand.
        <>
          <Field id={`omni-to-${unit.id}`} label="New configuration">
            <TextInput id={`omni-to-${unit.id}`} value={toName} onChange={setToName} />
          </Field>
          <Field id={`omni-pv-${unit.id}`} label="New PV at Skill 4" hint={`Costs ${omniReconfigurationCost(unit.pvAtSkill4, toPv, unit.size)} SP`}>
            <NumberInput id={`omni-pv-${unit.id}`} value={toPv} onChange={setToPv} />
          </Field>
        </>
      ))}
      <div className="flex gap-2">
        <DossierButton variant="secondary" disabled={!toName || toPv <= 0}
          onClick={() => { reconfigureOmni(sortie.id, unit.id, toName, toPv, toEntry); close() }}>
          Reconfigure
        </DossierButton>
        <button type="button" onClick={close} className="min-h-touch px-3 field-label text-text-secondary hover:text-text-primary">Cancel</button>
      </div>
    </div>
  )
}

function TriggerGameEndWaypoints({ sortie }: Props) {
  const { updateSortie } = useSortie()
  const net = selectWaypointsNet(sortie)
  return (
    <>
      <p className="m-0 text-sm text-text-secondary">Add up every waypoint revealed during the battle and at game end that changed your SP. Some cost SP, some give it.</p>
      <Field id="waypoints-sp" label="SP paid to waypoints" hint="The total SP that waypoint text told you to pay.">
        <NumberInput id="waypoints-sp" min={0} value={sortie.waypointsSP} onChange={waypointsSP => updateSortie(sortie.id, { waypointsSP })} />
      </Field>
      <Field id="waypoints-gained" label="SP gained from waypoints" hint="The total SP that waypoint text gave you.">
        <NumberInput id="waypoints-gained" min={0} value={sortie.waypointsGainedSP} onChange={waypointsGainedSP => updateSortie(sortie.id, { waypointsGainedSP })} />
      </Field>
      <Readout
        label="Waypoints on the Sortie Log"
        value={net > 0 ? `−${net} SP` : net < 0 ? `+${-net} SP` : '0 SP'}
        tone={net > 0 ? 'text-danger' : net < 0 ? 'text-result' : 'text-text-primary'}
      />
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
          <div key={k} className="flex items-center gap-2.5 py-1 border-b border-line min-h-touch">
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
        {selectWaypointsNet(sortie) !== 0 && (
          <Readout label="Waypoints (paid less gained)" value={selectWaypointsNet(sortie)} tone="text-result" />
        )}
        <Readout label={`Rearming · ${selectRearmingUnits(sortie)} units without ENE × 20`} value={selectRearmingUnits(sortie) * 20} tone="text-result" />
        <Readout label="Total Expenses" value={selectTotalExpenses(sortie)} tone="text-text-primary" />
      </Section>
      <HireSection sortie={sortie} />
      <Readout label="Earnings" value={`${earnings >= 0 ? '+' : '−'}${Math.abs(earnings)} SP`} tone={earnings >= 0 ? 'text-active' : 'text-danger'} />
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
    <div className="flex items-center gap-2.5 py-2 border-b border-line min-h-touch">
      <span className="flex-1">{label}</span>
      <span className={`font-display font-bold text-lg tabular-nums ${credit ? 'text-result' : 'text-active'}`}>
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
          ? <BuyUnitPanel onBuy={unit => { buyUnit(sortie.id, unit); setBuying(false) }} onCancel={() => setBuying(false)} />
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

      <div className="bg-surface border border-line">
        <div className="flex justify-between px-3 py-2 bg-active text-on-active font-label font-bold text-sm tracking-[1px]">
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
