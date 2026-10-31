'use client'

import { use } from 'react'
import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { useHydrated } from '@/lib/useHydrated'
import { selectEffectivePilot, selectPilotAssignedUnit, selectPilotEdgeAbilities, selectPilotSpBreakdown } from '@/store/selectors'
import { EDGE_ABILITY_THRESHOLDS } from '@/lib/thresholds'
import { PageBody } from '@/components/dossier/FileHeader'
import { StatusTag } from '@/components/dossier/StatusTag'
import { Field, Section, Select, TextInput } from '@/components/sortie/fields'
import { DismissPilot } from '@/components/pilots/DismissPilot'
import { PilotPhoto, WOUNDED_LABEL } from '@/components/pilots/PilotPhoto'
import { PilotTracks } from '@/components/pilots/PilotTracks'
import { UNIT_TYPES } from '@/lib/types'
import type { UnitType } from '@/lib/types'

// SP on the Edge Abilities track that unlocks each ability slot, lowest first.
const ABILITY_UNLOCKS = EDGE_ABILITY_THRESHOLDS.filter(([sp]) => sp > 0).map(([sp]) => sp).reverse()

export default function PilotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { campaign, updatePilot } = useCampaignStore()
  const stored = campaign.namedPilots.find(p => p.id === id)
  const hydrated = useHydrated()

  // The campaign lives in this browser, so only after hydration can a missing pilot be told apart.
  if (!hydrated) return null
  if (!stored) {
    return (
      <PageBody>
        <p className="m-0 text-text-secondary">This Named Pilot is no longer in your force. They may have been dismissed or killed in action; check the Memorial on the Roster.</p>
        <Link href="/roster" className="dossier-label text-signal-blue">&lt; Roster</Link>
      </PageBody>
    )
  }

  const pilot = selectEffectivePilot(campaign, stored)
  const sp = selectPilotSpBreakdown(campaign, stored)
  const unit = selectPilotAssignedUnit(campaign.units, pilot.id)
  const abilityCount = selectPilotEdgeAbilities(pilot)
  const knownAbilities = [...new Set(campaign.namedPilots.flatMap(p => p.edgeAbilitiesLearned).filter(Boolean))]
  const spParts = [
    `${sp.start} start`,
    ...(sp.carriedOver ? [`${sp.carriedOver} carried over`] : []),
    ...(sp.sorties ? [`${sp.sorties} sorties`] : []),
    ...(sp.mvp ? [`${sp.mvp} MVP`] : []),
  ]

  return (
    <>
      <header className="bg-steel-800 border-b-2 border-amber">
        <div className="max-w-6xl mx-auto px-gutter pt-4 pb-3 flex gap-3.5">
          <PilotPhoto pilot={pilot} size={84} editable />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="dossier-label text-text-secondary">Personnel file · {pilot.pilotType}</span>
            <h1 className="m-0 text-[28px] sm:text-[34px] leading-[1.05] text-amber break-words">{pilot.callsign || 'Named Pilot'}</h1>
            <span className="flex flex-wrap gap-1.5">
              {pilot.wounded && <StatusTag tone="hurt">{WOUNDED_LABEL}</StatusTag>}
              <StatusTag tone="neutral">{unit ? unit.nameAndVariant || 'Unnamed unit' : 'No unit assigned'}</StatusTag>
            </span>
          </div>
        </div>
      </header>
      <PageBody>
        <div className="max-w-xl w-full flex flex-col gap-5">
          <Link href="/roster" className="dossier-label text-signal-blue">&lt; Roster</Link>

          <Section title="Personnel details">
            <Field id="pilot-callsign" label="Callsign">
              <TextInput id="pilot-callsign" value={pilot.callsign} onChange={callsign => updatePilot(pilot.id, { callsign })} />
            </Field>
            <Field id="pilot-type" label="Type">
              <Select id="pilot-type" value={pilot.pilotType} onChange={v => updatePilot(pilot.id, { pilotType: v as UnitType })}>
                {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Link href="/roster" className="dossier-label text-signal-blue min-h-touch flex items-center">
              {unit ? 'View on Roster' : 'Assign to a unit on the Roster'}&nbsp;&gt;
            </Link>
          </Section>

          <div className="flex justify-between items-end gap-3 pb-2.5 border-b border-steel-500">
            <span className="flex flex-col">
              <span className="dossier-label text-text-secondary whitespace-nowrap">Total SP Earned</span>
              <span className="font-stencil text-[38px] leading-none text-amber">{sp.total}</span>
            </span>
            <span className="text-[13px] text-text-secondary text-right">
              {spParts.join(' + ')}
              <br />
              {sp.sortiesPlayed} sortie{sp.sortiesPlayed === 1 ? '' : 's'} · MVP ×{sp.mvpCount}
            </span>
          </div>

          <PilotTracks pilot={pilot} />

          <Section title="Edge Abilities Learned">
            <datalist id="known-edge-abilities">{knownAbilities.map(a => <option key={a} value={a} />)}</datalist>
            {ABILITY_UNLOCKS.map((unlockAt, i) => (
              <div key={unlockAt} className="flex items-center gap-2.5">
                <span className="font-stencil text-amber w-4">{i + 1}</span>
                <TextInput
                  id={`edge-ability-${i}`}
                  aria-label={`Edge Ability ${i + 1}`}
                  value={pilot.edgeAbilitiesLearned[i] ?? ''}
                  disabled={i >= abilityCount}
                  list="known-edge-abilities"
                  placeholder={i >= abilityCount ? `Unlocks at ${unlockAt} SP` : 'Name from your Edge card'}
                  onChange={value => {
                    const updated = [...pilot.edgeAbilitiesLearned]
                    updated[i] = value
                    updatePilot(pilot.id, { edgeAbilitiesLearned: updated })
                  }}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            ))}
          </Section>


          {pilot.campaignHistory.length > 0 && (
            <Section title="Campaigns played">
              {pilot.campaignHistory.map((c, i) => <span key={i} className="text-[15px]">{c}</span>)}
            </Section>
          )}

          <DismissPilot pilotId={pilot.id} callsign={pilot.callsign} />
        </div>
      </PageBody>
    </>
  )
}
