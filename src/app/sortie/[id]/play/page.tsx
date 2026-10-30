'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { useHydrated } from '@/lib/useHydrated'
import { PlayMode } from '@/components/play/PlayMode'

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const campaign = useCampaignStore(s => s.campaign)
  const sortie = campaign.sorties.find(s => s.id === id)
  const hydrated = useHydrated()

  // The campaign lives in this browser, so only after hydration can a missing sortie be told apart.
  if (!hydrated) return null
  if (!sortie) return notFound()
  return <PlayMode sortie={sortie} />
}
