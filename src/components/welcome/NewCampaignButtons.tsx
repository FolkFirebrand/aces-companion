'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { DossierButton } from '@/components/dossier/DossierButton'
import { ReplaceCampaignDialog } from '@/components/campaign/LoadCampaignFile'
import { ExistingForceButton } from './ExistingForceButton'

/** Start a new campaign, fresh or with an Existing Force; a setup in progress is resumed instead. */
export function NewCampaignButtons() {
  const router = useRouter()
  const { setupDraft, startSetup, hasCampaignData } = useCampaignStore()
  const [confirmNew, setConfirmNew] = useState(false)

  function beginSetup() {
    startSetup()
    router.push('/setup')
  }

  if (setupDraft) {
    return (
      <DossierButton variant="primary" onClick={() => router.push('/setup')}>
        Continue setting up{setupDraft.name ? `: ${setupDraft.name}` : ''}
      </DossierButton>
    )
  }

  return (
    <>
      <DossierButton variant="primary" onClick={() => (hasCampaignData() ? setConfirmNew(true) : beginSetup())}>
        Start new campaign
      </DossierButton>
      <ExistingForceButton />
      <ReplaceCampaignDialog
        open={confirmNew}
        title="Start a new campaign?"
        confirmLabel="Start new campaign"
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => { setConfirmNew(false); beginSetup() }}
      />
    </>
  )
}
