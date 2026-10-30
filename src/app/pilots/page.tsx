'use client'

import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { useCampaignStore } from '@/store/campaign'
import { MAX_NAMED_PILOTS, selectCampaignStarted, selectPilotAssignedUnit } from '@/store/selectors'
import { NAMED_PILOT_STARTING_SP } from '@/lib/rules'
import { PilotCard } from '@/components/pilots/PilotCard'
import { DossierButton } from '@/components/dossier/DossierButton'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'

export default function PilotsPage() {
  const router = useRouter()
  const { campaign, addPilot } = useCampaignStore()
  const pilots = campaign.namedPilots
  const started = selectCampaignStarted(campaign)

  function newPilot() {
    const id = uuidv4()
    addPilot({
      id, callsign: 'New Pilot', pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: NAMED_PILOT_STARTING_SP,
      spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0, edgeAbilitiesLearned: [], campaignHistory: [],
    })
    router.push(`/pilots/${id}`)
  }

  return (
    <>
      <FileHeader label={`${campaign.forceName || 'New force'} · Personnel files`} position={`${pilots.length} of ${MAX_NAMED_PILOTS}`} title="Named Pilots" />
      <PageBody>
        {pilots.length === 0
          ? <p className="m-0 text-sm text-text-secondary">No Named Pilots yet.</p>
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {pilots.map(p => <PilotCard key={p.id} pilot={p} assignedUnit={selectPilotAssignedUnit(campaign.units, p.id)} />)}
            </div>
          )}
        {started
          ? <p className="m-0 text-[13px] text-text-secondary">New Named Pilots are hired in After-Sortie step 4 for {NAMED_PILOT_STARTING_SP} SP.</p>
          : pilots.length < MAX_NAMED_PILOTS && <DossierButton variant="secondary" className="self-start" onClick={newPilot}>+ Add a Named Pilot</DossierButton>}
      </PageBody>
    </>
  )
}
