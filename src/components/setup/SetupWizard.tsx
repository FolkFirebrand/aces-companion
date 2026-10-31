'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { useCampaignStore } from '@/store/campaign'
import { selectSetupForceErrors, selectSetupPilotErrors, selectTotalRosterPV } from '@/store/selectors'
import {
  DIFFICULTY_LEVELS, FORCE_PV_LIMIT, NAMED_PILOT_STARTING_SP, SP_PER_UNSPENT_PV, STARTING_SP,
  existingForceModifier, existingForceStartingWarchest, setupStartingWarchest,
} from '@/lib/rules'
import { EDGE_ABILITY_THRESHOLDS, EDGE_TOKEN_THRESHOLDS, SKILL_THRESHOLDS, lookupStatFromSP } from '@/lib/thresholds'
import { UNIT_TYPES } from '@/lib/types'
import type { DifficultyLevel, NamedPilot, SetupDraft, UnitType } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { TrackSteppers } from '@/components/pilots/PilotTracks'
import { ChassisCheckButton, ForceBuilder, ForceRules } from '@/components/roster/ForceBuilder'
import { Field, NumberInput, Section, Select, TextInput } from '@/components/sortie/fields'
import { cn } from '@/lib/utils'

const TITLES = ['Name and Difficulty', 'Build the Force', 'Named Pilots', 'Review'] as const
const SUMMARIES = [
  'Name your campaign and choose how hard it plays',
  `Choose units worth up to ${FORCE_PV_LIMIT} PV at Skill 4`,
  `Create 2 to 6 Named Pilots (4 recommended). Each spends ${NAMED_PILOT_STARTING_SP} SP`,
  'Check everything, then start the campaign.',
]
const EXISTING_SUMMARIES = [
  'Name the new campaign and choose how hard it plays',
  `Your force carries over. You may add units up to ${FORCE_PV_LIMIT} PV`,
  `Your Named Pilots carry over with their SP. New pilots spend ${NAMED_PILOT_STARTING_SP} SP`,
  'Check everything, then start the campaign.',
]

function isCarried(draft: SetupDraft, p: NamedPilot) {
  return !!draft.existingForce && p.carriedOverSp !== undefined
}

const LEVEL_NOTES: Record<Exclude<DifficultyLevel, 'custom'>, string> = {
  rookie: 'New to Alpha Strike and Aces',
  standard: 'Some Alpha Strike, new to Aces',
  veteran: 'Played Aces before',
  elite: 'Experts wanting a challenge',
  legendary: 'Something to prove',
}

function percent(n: number) {
  return n > 0 ? `+${n}%` : n === 0 ? '±0%' : `${n}%`
}

function pilotSummary(p: NamedPilot) {
  const tokens = lookupStatFromSP(p.spSpentOnEdgeTokens, EDGE_TOKEN_THRESHOLDS)
  const abilities = lookupStatFromSP(p.spSpentOnEdgeAbilities, EDGE_ABILITY_THRESHOLDS)
  return `${p.pilotType} · Skill ${lookupStatFromSP(p.spSpentOnSkill, SKILL_THRESHOLDS)} · ${tokens} token${tokens === 1 ? '' : 's'} · ${abilities} abilit${abilities === 1 ? 'y' : 'ies'}`
}

function NameStep({ draft }: { draft: SetupDraft }) {
  const { updateSetup } = useCampaignStore()
  return (
    <>
      <Field id="setup-name" label="Campaign name"><TextInput id="setup-name" value={draft.name} onChange={name => updateSetup({ name })} /></Field>
      <Field id="setup-force" label="Force name"><TextInput id="setup-force" value={draft.forceName} onChange={forceName => updateSetup({ forceName })} /></Field>
      <Field id="setup-co" label="Commanding officer (optional)"><TextInput id="setup-co" value={draft.commandingOfficer} onChange={commandingOfficer => updateSetup({ commandingOfficer })} /></Field>
      <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
        <legend className="dossier-label text-text-secondary mb-2">Difficulty Level</legend>
        {[...Object.entries(DIFFICULTY_LEVELS), ['custom', null] as const].map(([id, level]) => {
          const on = draft.difficultyLevel === id
          return (
            <label key={id} className={cn('flex items-center gap-2.5 min-h-14 px-3 py-2 border-2 cursor-pointer', on ? 'border-amber' : 'border-steel-500')}>
              <input type="radio" name="difficulty" checked={on} onChange={() => updateSetup({ difficultyLevel: id as DifficultyLevel })} className="sr-only" />
              <span className="flex-1 flex flex-col">
                <span className={cn('font-condensed font-bold text-base tracking-[1px] uppercase', on && 'text-amber')}>{level ? level.name : 'Custom'}</span>
                <span className="text-[13px] text-text-secondary">{level ? LEVEL_NOTES[id as keyof typeof LEVEL_NOTES] : 'Set your own percentages'}</span>
              </span>
              <span className="font-condensed font-bold text-[13px] tracking-[1px] text-signal-blue text-right">
                {level ? <>PV {percent(level.pvPercent)}<br />SP {level.spPercent}%</> : <span className="text-text-secondary">Your choice</span>}
              </span>
            </label>
          )
        })}
      </fieldset>
      {draft.difficultyLevel === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Field id="setup-custom-pv" label="Player Force PV %"><NumberInput id="setup-custom-pv" value={draft.customPvPercent} onChange={customPvPercent => updateSetup({ customPvPercent })} /></Field>
          <Field id="setup-custom-sp" label="SP Earned %"><NumberInput id="setup-custom-sp" value={draft.customSpPercent} onChange={customSpPercent => updateSetup({ customSpPercent })} /></Field>
        </div>
      )}
    </>
  )
}

function ForceStep({ draft }: { draft: SetupDraft }) {
  const { addSetupUnit, removeSetupUnit } = useCampaignStore()
  const pv = selectTotalRosterPV(draft.units)
  const existing = draft.existingForce
  const carried = (unitId: string) => !!existing?.unitIds.includes(unitId)
  const added = draft.units.some(u => !carried(u.id))
  // A carried-over force already above 400 PV is allowed; it just can't add units.
  const over = pv > FORCE_PV_LIMIT && (!existing || added)
  const typesOk = { ok: draft.units.every(u => UNIT_TYPES.includes(u.unitType)), text: 'BattleMechs, battle armor, vehicles and infantry only' }
  const checks = existing
    ? [{ ok: !over, text: `Added units bring it no higher than ${FORCE_PV_LIMIT} PV` }, typesOk]
    : [
        { ok: !over, text: `No more than ${FORCE_PV_LIMIT} PV` },
        { ok: draft.units.length >= 8, text: `At least 8 units (${draft.units.length} so far)` },
        { ok: true, text: 'All at Skill 4' },
        typesOk,
      ]

  return (
    <>
      <ForceBuilder units={draft.units} onAdd={addSetupUnit} onRemove={removeSetupUnit} isCarried={carried} over={over}
        overNote={pv > FORCE_PV_LIMIT ? 'Carried over above the limit' : null} />
      <ForceRules checks={checks}>
        {!existing && <ChassisCheckButton units={draft.units} />}
      </ForceRules>
    </>
  )
}

function PilotsStep({ draft }: { draft: SetupDraft }) {
  const { addSetupPilot, updateSetupPilot, removeSetupPilot } = useCampaignStore()
  const [editing, setEditing] = useState<string | null>(null)

  function addPilot() {
    const id = uuidv4()
    addSetupPilot({
      id, callsign: '', pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: NAMED_PILOT_STARTING_SP,
      spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0, edgeAbilitiesLearned: [], campaignHistory: [],
    })
    setEditing(id)
  }

  return (
    <>
      {draft.pilots.map((p, i) => {
        const left = p.totalSpEarned - p.spSpentOnSkill - p.spSpentOnEdgeTokens - p.spSpentOnEdgeAbilities
        if (isCarried(draft, p)) {
          return (
            <div key={p.id} className="flex justify-between items-center gap-3 min-h-13 px-3 py-2 bg-steel-800 border border-steel-500">
              <span className="flex flex-col">
                <span className="font-condensed font-bold text-base tracking-[1px] uppercase">{p.callsign}</span>
                <span className="text-[13px] text-text-secondary">{pilotSummary(p)}</span>
              </span>
              <span className="font-condensed font-bold text-xs tracking-[1px] whitespace-nowrap text-signal-blue text-right">
                Carried over<br />{p.totalSpEarned} SP
              </span>
            </div>
          )
        }
        if (editing !== p.id) {
          return (
            <button key={p.id} type="button" onClick={() => setEditing(p.id)}
              className="flex justify-between items-center gap-3 min-h-13 px-3 py-2 bg-steel-800 border border-steel-500 text-left">
              <span className="flex flex-col">
                <span className="font-condensed font-bold text-base tracking-[1px] uppercase">{p.callsign || `Pilot ${i + 1}`}</span>
                <span className="text-[13px] text-text-secondary">{pilotSummary(p)}</span>
              </span>
              <span className={cn('font-condensed font-bold text-xs tracking-[1px] whitespace-nowrap', left === 0 ? 'text-signal-blue' : 'text-danger')}>
                {p.totalSpEarned - left} / {p.totalSpEarned}
              </span>
            </button>
          )
        }
        return (
          <div key={p.id} className="bg-steel-800 border border-steel-500">
            <div className="flex justify-between px-3 py-2 bg-amber text-on-amber font-condensed font-bold text-sm tracking-[1px] uppercase">
              <span>{p.callsign || `Pilot ${i + 1}`}</span>
              <span>{left === 0 ? 'All allocated' : left > 0 ? `${left} left` : `${-left} too many`}</span>
            </div>
            <div className="p-3 flex flex-col gap-2.5">
              <Field id={`setup-cs-${p.id}`} label="Callsign"><TextInput id={`setup-cs-${p.id}`} value={p.callsign} onChange={callsign => updateSetupPilot(p.id, { callsign })} /></Field>
              <Field id={`setup-ty-${p.id}`} label="Type">
                <Select id={`setup-ty-${p.id}`} value={p.pilotType} onChange={v => updateSetupPilot(p.id, { pilotType: v as UnitType })}>
                  {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <p className="m-0 text-[13px] text-text-secondary">
                {`Split all ${p.totalSpEarned} SP between the three tracks. SP doesn't have to reach a level: what's left counts toward the next one.`}
              </p>
              <TrackSteppers pilot={p} available={Math.max(0, left)} onChange={(_track, field, delta) => updateSetupPilot(p.id, { [field]: p[field] + delta })} />
              {(left !== 0 || !p.callsign.trim()) && (
                <p className="m-0 text-[13px] text-danger">
                  {[!p.callsign.trim() && 'Give this pilot a callsign.', left > 0 && `${left} SP left to allocate.`, left < 0 && `${-left} SP too many.`].filter(Boolean).join(' ')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <DossierButton variant="secondary" onClick={() => setEditing(null)}>Done</DossierButton>
                <DossierButton variant="danger" onClick={() => removeSetupPilot(p.id)}>Remove pilot</DossierButton>
              </div>
            </div>
          </div>
        )
      })}
      {draft.pilots.length < 6 && (
        <DossierButton variant="secondary" onClick={addPilot}>+ Add a Named Pilot ({draft.pilots.length} of 6)</DossierButton>
      )}
      <p className="m-0 text-[13px] text-text-secondary">You&apos;ll assign pilots to units on the Roster, and choose who&apos;s fielded each sortie.</p>
    </>
  )
}

function ReviewStep({ draft }: { draft: SetupDraft }) {
  const { updateSetup } = useCampaignStore()
  const pv = selectTotalRosterPV(draft.units)
  const unspent = Math.max(0, FORCE_PV_LIMIT - pv)
  const existing = draft.existingForce
  const modifier = existingForceModifier(draft.pilots.reduce((sum, p) => sum + p.totalSpEarned, 0))
  const level = draft.difficultyLevel === 'custom'
    ? `Custom · PV ${percent(draft.customPvPercent)} · SP ${draft.customSpPercent}%`
    : `${DIFFICULTY_LEVELS[draft.difficultyLevel].name} · PV ${percent(DIFFICULTY_LEVELS[draft.difficultyLevel].pvPercent)} · SP ${DIFFICULTY_LEVELS[draft.difficultyLevel].spPercent}%`
  const rows: { label: string; value: string; step: SetupDraft['step'] }[] = [
    { label: 'Campaign', value: [draft.name, draft.forceName].filter(Boolean).join(' · ') || 'Unnamed', step: 1 },
    { label: 'Difficulty', value: existing ? `${level} · Existing-Force Modifier PV ${percent(modifier)}` : level, step: 1 },
    { label: 'Force', value: `${draft.units.length} units · ${pv} / ${FORCE_PV_LIMIT} PV`, step: 2 },
    { label: 'Named Pilots', value: draft.pilots.map(p => p.callsign).join(', '), step: 3 },
  ]
  return (
    <>
      <div className="flex flex-col">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between items-center gap-3 py-2.5 border-b border-steel-500">
            <span className="flex flex-col"><span className="dossier-label text-text-secondary">{r.label}</span><span className="text-[15px]">{r.value}</span></span>
            <button type="button" onClick={() => updateSetup({ step: r.step })} className="dossier-label text-signal-blue min-h-touch px-1">Edit</button>
          </div>
        ))}
      </div>
      <Section title="Starting Warchest Balance">
        {existing ? (
          <>
            <div className="flex justify-between text-[15px]"><span className="text-text-secondary">Warchest from {existing.fromCampaign || 'the last campaign'}</span><span>{existing.warchest}</span></div>
            {existing.warchest < STARTING_SP && (
              <div className="flex justify-between text-[15px]"><span className="text-text-secondary">Raised to {STARTING_SP} SP</span><span>+{STARTING_SP - existing.warchest}</span></div>
            )}
          </>
        ) : (
          <div className="flex justify-between text-[15px]"><span className="text-text-secondary">Starting SP</span><span>{STARTING_SP}</span></div>
        )}
        <div className="flex justify-between text-[15px]"><span className="text-text-secondary">{unspent} unspent PV × {SP_PER_UNSPENT_PV}</span><span>+{unspent * SP_PER_UNSPENT_PV}</span></div>
        <div className="flex justify-between items-baseline pt-1.5 border-t border-steel-500">
          <span className="dossier-label text-text-secondary">Warchest</span>
          <span className="font-stencil text-[32px] text-amber">{existing ? existingForceStartingWarchest(existing.warchest, pv) : setupStartingWarchest(pv)} SP</span>
        </div>
      </Section>
      <p className="m-0 text-[13px] text-text-secondary">Next: assign pilots to units on the Roster, then log your first sortie from the Campaign Log.</p>
    </>
  )
}

export function SetupWizard() {
  const router = useRouter()
  const { setupDraft: draft, startSetup, updateSetup, cancelSetup, finishSetup } = useCampaignStore()

  // Opening the wizard starts (or resumes) a setup once. Not on every render: after Start or Cancel
  // clears the draft, the wizard must not recreate it while the page is navigating away.
  useEffect(() => { startSetup() }, [startSetup])
  if (!draft) return null

  const step = draft.step
  const blockers = step === 2 ? selectSetupForceErrors(draft) : step === 3 ? selectSetupPilotErrors(draft) : []

  return (
    <>
      <header className="bg-steel-800 border-b-2 border-amber">
        <div className="max-w-6xl mx-auto px-gutter pt-4 pb-3 flex flex-col gap-2">
          <div className="dossier-label flex justify-between text-text-secondary"><span>{draft.existingForce ? 'Existing Force' : 'New campaign'} · Setup</span><span>{step} of 4</span></div>
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map(n => <span key={n} className={cn('flex-1 h-1', n <= step ? 'bg-amber' : 'bg-steel-500')} />)}
          </div>
          <h1 className="m-0 text-[28px] sm:text-[34px] leading-[1.05] text-amber">{TITLES[step - 1]}</h1>
          <p className="m-0 text-sm text-text-secondary">{(draft.existingForce ? EXISTING_SUMMARIES : SUMMARIES)[step - 1]}</p>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-gutter py-4 flex flex-col gap-3.5">
        {step === 1 && <NameStep draft={draft} />}
        {step === 2 && <ForceStep draft={draft} />}
        {step === 3 && <PilotsStep draft={draft} />}
        {step === 4 && <ReviewStep draft={draft} />}

        {blockers.length > 0 && (
          <ul className="m-0 pl-5 text-[13px] text-danger flex flex-col gap-0.5">{blockers.map(b => <li key={b}>{b}</li>)}</ul>
        )}
        <div className="flex gap-2 pt-2">
          {step === 1 ? (
            <DossierButton variant="secondary" className="h-button-primary" onClick={() => { cancelSetup(); router.push('/') }}>Cancel</DossierButton>
          ) : (
            <DossierButton variant="secondary" className="h-button-primary" onClick={() => updateSetup({ step: (step - 1) as SetupDraft['step'] })}>Back</DossierButton>
          )}
          {step < 4 ? (
            <DossierButton variant="primary" className="flex-1" disabled={blockers.length > 0}
              onClick={() => updateSetup({ step: (step + 1) as SetupDraft['step'] })}>
              Next: {TITLES[step as 1 | 2 | 3]}
            </DossierButton>
          ) : (
            <DossierButton variant="primary" className="flex-1" onClick={() => { if (finishSetup()) router.push('/roster') }}>
              Start campaign
            </DossierButton>
          )}
        </div>
      </div>
    </>
  )
}
