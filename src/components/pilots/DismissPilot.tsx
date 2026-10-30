'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { selectDismissBlocker } from '@/store/selectors'
import { DossierButton } from '@/components/dossier/DossierButton'

/** Dismissing costs nothing and refunds nothing; the pilot goes to the Memorial as dismissed. */
export function DismissPilot({ pilotId, callsign }: { pilotId: string; callsign: string }) {
  const router = useRouter()
  const { campaign, dismissPilot } = useCampaignStore()
  const [confirming, setConfirming] = useState(false)
  const blocker = selectDismissBlocker(campaign, pilotId)

  return (
    <div className="flex flex-col gap-2 pt-2">
      {blocker ? (
        <p className="m-0 text-sm text-text-secondary">{blocker}</p>
      ) : confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-danger">Dismiss {callsign}? They leave your force for good, with no refund.</span>
          <DossierButton variant="danger" onClick={() => { dismissPilot(pilotId); router.push('/pilots') }}>Dismiss pilot</DossierButton>
          <DossierButton variant="secondary" onClick={() => setConfirming(false)}>Keep them</DossierButton>
        </div>
      ) : (
        <DossierButton variant="danger" onClick={() => setConfirming(true)}>Dismiss pilot</DossierButton>
      )}
    </div>
  )
}
