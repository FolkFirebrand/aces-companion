'use client'

import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { useHydrated } from '@/lib/useHydrated'
import { SortieChecklist } from '@/components/sortie/SortieChecklist'
import { SortieCompleted } from '@/components/sortie/SortieCompleted'

export default function SortiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const campaign = useCampaignStore(s => s.campaign)
  const sortie = campaign.sorties.find(s => s.id === id)
  const hydrated = useHydrated()
  // Kept here, not in the checklist, so a save failure still shows once the page switches to the completed view.
  const [completeError, setCompleteError] = useState<string | null>(null)

  // The campaign lives in this browser, so only after hydration can a missing sortie be told apart.
  if (!hydrated) return null
  if (!sortie) return notFound()

  return sortie.status === 'completed'
    ? <SortieCompleted sortie={sortie} saveError={completeError} />
    : <SortieChecklist sortie={sortie} completeError={completeError} onCompleteError={setCompleteError} />
}
