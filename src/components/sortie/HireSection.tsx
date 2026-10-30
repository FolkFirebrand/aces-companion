'use client'

import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { selectHireBlocker } from '@/store/selectors'
import { UNIT_TYPES } from '@/lib/types'
import type { Sortie, UnitType } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { Field, NumberInput, Section, Select, TextInput } from './fields'

const STARTING_SP = 150

/** After-Sortie step 4: hire an extra or replacement Named Pilot for 150 SP. */
export function HireSection({ sortie }: { sortie: Sortie }) {
  const { campaign, hirePilot, removeHire } = useCampaignStore()
  const [open, setOpen] = useState(false)
  const [callsign, setCallsign] = useState('')
  const [pilotType, setPilotType] = useState<UnitType>('BattleMech')
  const [skill, setSkill] = useState(0)
  const [edgeTokens, setEdgeTokens] = useState(0)
  const [edgeAbilities, setEdgeAbilities] = useState(0)
  const blocker = selectHireBlocker(campaign, sortie)
  const left = STARTING_SP - skill - edgeTokens - edgeAbilities
  const ready = callsign.trim() !== '' && left === 0

  function reset() {
    setCallsign(''); setPilotType('BattleMech'); setSkill(0); setEdgeTokens(0); setEdgeAbilities(0); setOpen(false)
  }

  return (
    <Section title="Hire Named Pilots" aside="150 SP each">
      {sortie.hires.map(p => (
        <div key={p.id} className="flex items-center gap-2.5 py-2 border-b border-steel-500 min-h-touch">
          <span className="flex-1">{p.callsign} <span className="text-text-secondary">· {p.pilotType} · joins when completed</span></span>
          <span className="font-stencil text-lg text-amber">−150</span>
          <button type="button" aria-label={`Don't hire ${p.callsign}`} onClick={() => removeHire(sortie.id, p.id)} className="h-touch w-touch text-text-secondary">✕</button>
        </div>
      ))}
      {blocker ? (
        <p className="m-0 text-sm text-text-secondary">{blocker}</p>
      ) : open ? (
        <form
          className="flex flex-col gap-3 p-3 bg-steel-800 border border-steel-500"
          onSubmit={e => {
            e.preventDefault()
            if (!ready) return
            hirePilot(sortie.id, { callsign, pilotType, skill, edgeTokens, edgeAbilities })
            reset()
          }}
        >
          <Field id="hire-callsign" label="Callsign">
            <TextInput id="hire-callsign" value={callsign} onChange={setCallsign} />
          </Field>
          <Field id="hire-type" label="Type">
            <Select id="hire-type" value={pilotType} onChange={v => setPilotType(v as UnitType)}>
              {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <div className="flex flex-col gap-1">
            <span className="dossier-label text-text-secondary">Starting SP · {STARTING_SP} to allocate</span>
            <div className="grid grid-cols-3 gap-2">
              <Field id="hire-skill" label="Skill"><NumberInput id="hire-skill" value={skill} onChange={setSkill} min={0} /></Field>
              <Field id="hire-tokens" label="Edge Tokens"><NumberInput id="hire-tokens" value={edgeTokens} onChange={setEdgeTokens} min={0} /></Field>
              <Field id="hire-abilities" label="Edge Abilities"><NumberInput id="hire-abilities" value={edgeAbilities} onChange={setEdgeAbilities} min={0} /></Field>
            </div>
            <p className={`m-0 text-[13px] ${left === 0 ? 'text-signal-blue' : 'text-danger'}`}>
              {left === 0 ? 'All 150 SP allocated.' : left > 0 ? `${left} SP left to allocate.` : `${-left} SP too many.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DossierButton variant="secondary" type="submit" disabled={!ready}>Hire for 150 SP</DossierButton>
            <DossierButton variant="secondary" onClick={reset} className="border-steel-500 text-text-secondary">Cancel</DossierButton>
          </div>
        </form>
      ) : (
        <DossierButton variant="secondary" className="self-start" onClick={() => setOpen(true)}>+ Hire a Named Pilot</DossierButton>
      )}
      <p className="m-0 text-[13px] text-text-secondary">A new pilot joins your force when you complete the sortie, and takes no share of this one&apos;s SP.</p>
    </Section>
  )
}
