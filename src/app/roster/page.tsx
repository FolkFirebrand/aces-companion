'use client'

import { useCampaignStore } from '@/store/campaign'
import { PvSummaryBar } from '@/components/roster/PvSummaryBar'
import { UnitGrid } from '@/components/roster/UnitGrid'
import { PilotBench } from '@/components/roster/PilotBench'
import { Memorial } from '@/components/roster/Memorial'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'
import { StartSortieButton } from '@/components/campaign/StartSortieButton'

export default function RosterPage() {
  const campaign = useCampaignStore(s => s.campaign)

  return (
    <>
      <FileHeader label={`${campaign.forceName || 'New force'} · Player force`} title="Player Force Roster" />
      <PageBody>
        <StartSortieButton className="md:max-w-sm" showNext />
        <PvSummaryBar />
        <PilotBench />
        <UnitGrid />
        <Memorial />
      </PageBody>
    </>
  )
}
