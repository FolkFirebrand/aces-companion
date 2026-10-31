'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { selectNextSortieNote } from '@/store/selectors'
import { DossierButton } from '@/components/dossier/DossierButton'
import { cn } from '@/lib/utils'

/** The campaign round's way in: start the next sortie, or pick up the one in progress. */
export function StartSortieButton({ className, showNext = false }: { className?: string; showNext?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const { campaign, addSortie } = useCampaignStore()
  const [warning, setWarning] = useState(false)
  const draft = campaign.sorties.find(s => s.status === 'draft')
  const nextNumber = String(campaign.sorties.length + 1).padStart(2, '0')
  const nextNote = selectNextSortieNote(campaign)

  // A new sortie fields pilots from the Roster's assignments, so starting with none is usually a slip.
  const anyAssigned = campaign.units.some(u => u.pilotId && campaign.namedPilots.some(p => p.id === u.pilotId))

  function start() {
    if (!draft && !anyAssigned && campaign.namedPilots.length > 0 && !warning) {
      setWarning(true)
      return
    }
    router.push(`/sortie/${addSortie()}`)
  }

  if (warning) {
    return (
      <div role="alertdialog" aria-label="No Named Pilots assigned" className={cn('flex flex-col gap-2.5 p-3 bg-steel-800 border border-danger', className)}>
        <span className="font-condensed font-bold text-[15px] tracking-[1px] uppercase text-danger">No Named Pilots assigned</span>
        <p className="m-0 text-sm">
          None of your units has a Named Pilot. A sortie fields pilots from the Roster, so every unit would go out with a generic crew.
        </p>
        <div className="flex flex-wrap gap-2">
          {pathname === '/roster'
            ? <DossierButton variant="secondary" onClick={() => setWarning(false)}>Assign pilots first</DossierButton>
            : <Link href="/roster" className="h-touch px-3.5 flex items-center border-2 border-signal-blue text-signal-blue font-condensed font-semibold text-[15px] tracking-[1px] uppercase hover:bg-signal-blue/10">Assign pilots on the Roster</Link>}
          <DossierButton variant="danger" onClick={start}>Start anyway</DossierButton>
        </div>
      </div>
    )
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
