'use client'

import { useRouter } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { selectNextSortieNote } from '@/store/selectors'
import { DossierButton } from '@/components/dossier/DossierButton'
import { cn } from '@/lib/utils'

/** The campaign round's way in: start the next sortie, or pick up the one in progress. */
export function StartSortieButton({ className, showNext = false }: { className?: string; showNext?: boolean }) {
  const router = useRouter()
  const { campaign, addSortie } = useCampaignStore()
  const draft = campaign.sorties.find(s => s.status === 'draft')
  const nextNumber = String(campaign.sorties.length + 1).padStart(2, '0')
  const nextNote = selectNextSortieNote(campaign)

  function start() {
    router.push(`/sortie/${addSortie()}`)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <DossierButton variant="primary" onClick={start}>
        {draft ? `Continue Sortie ${draft.sortieNumber}` : `Start Sortie ${nextNumber}`}
      </DossierButton>
      <span className="text-[13px] text-text-secondary">
        {draft
          ? 'Pick up where you left off in the sortie steps.'
          : showNext && nextNote
            ? `Next up: ${nextNote}. Walks you through the book's setup steps, the battle and the after-sortie steps.`
            : "Walks you through the book's setup steps, the battle and the after-sortie steps."}
      </span>
    </div>
  )
}
