'use client'

import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { useCampaignStore } from '@/store/campaign'
import { MAX_NAMED_PILOTS, selectCampaignStarted, selectPilotAssignedUnit } from '@/store/selectors'
import { NAMED_PILOT_STARTING_SP } from '@/lib/rules'
import { DossierButton } from '@/components/dossier/DossierButton'
import { BenchPilotCard } from './BenchPilotCard'

export function PilotBench() {
  const router = useRouter()
  const { campaign, addPilot } = useCampaignStore()
  const started = selectCampaignStarted(campaign)
  const total = campaign.namedPilots.length
  const unassigned = campaign.namedPilots.filter(p => !selectPilotAssignedUnit(campaign.units, p.id))
  const open = Math.max(0, MAX_NAMED_PILOTS - total)

  function newPilot() {
    const id = uuidv4()
    addPilot({
      id, callsign: 'New Pilot', pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: NAMED_PILOT_STARTING_SP,
      spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0, edgeAbilitiesLearned: [], campaignHistory: [],
    })
    router.push(`/pilots/${id}`)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 pb-1 border-b-2 border-steel-500">
        <h2 className="m-0 text-lg text-amber">Unassigned Named Pilots</h2>
        <span className="text-sm text-text-secondary">
          {total === 0
            ? 'No Named Pilots yet.'
            : `${unassigned.length} unassigned · ${total - unassigned.length} assigned · ${open} slot${open === 1 ? '' : 's'} open`}
        </span>
      </div>

      {unassigned.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {unassigned.map(p => <BenchPilotCard key={p.id} pilot={p} />)}
        </div>
      )}
      {total > 0 && unassigned.length === 0 && <p className="m-0 text-sm text-text-secondary">Every Named Pilot is assigned to a unit.</p>}

      {started
        ? <p className="m-0 text-[13px] text-text-secondary">New Named Pilots are hired in After-Sortie step 4 for {NAMED_PILOT_STARTING_SP} SP.</p>
        : open > 0 && <DossierButton variant="secondary" className="self-start" onClick={newPilot}>+ Add a Named Pilot</DossierButton>}
    </section>
  )
}
