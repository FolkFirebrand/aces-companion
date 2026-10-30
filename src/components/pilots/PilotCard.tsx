'use client'

import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { selectEffectivePilot, selectPilotEdgeAbilities, selectPilotEdgeTokens, selectPilotSkill } from '@/store/selectors'
import { StatusTag } from '@/components/dossier/StatusTag'
import { PilotPhoto, WOUNDED_LABEL } from './PilotPhoto'
import type { NamedPilot, Unit } from '@/lib/types'

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** A Named Pilot's summary on the Pilots screen; the full record is on their own page. */
export function PilotCard({ pilot: stored, assignedUnit }: { pilot: NamedPilot; assignedUnit: Unit | undefined }) {
  const campaign = useCampaignStore(s => s.campaign)
  const pilot = selectEffectivePilot(campaign, stored)

  return (
    <div className="bg-steel-800 border border-steel-500 flex flex-col">
      <Link href={`/pilots/${pilot.id}`} className="flex gap-3 p-3 min-h-touch hover:bg-steel-700">
        <PilotPhoto pilot={pilot} size={56} />
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="flex justify-between items-baseline gap-2">
            <span className="font-condensed font-bold text-lg tracking-[1px] uppercase truncate">{pilot.callsign || 'Unnamed pilot'}</span>
            <span className="font-stencil text-xl text-amber whitespace-nowrap">{pilot.totalSpEarned} <span className="text-xs text-text-secondary">SP</span></span>
          </span>
          <span className="text-[13px] text-text-secondary">
            {pilot.pilotType} · Skill {selectPilotSkill(pilot)} · {plural(selectPilotEdgeTokens(pilot), 'token', 'tokens')} · {plural(selectPilotEdgeAbilities(pilot), 'ability', 'abilities')}
          </span>
          {(pilot.wounded || assignedUnit) && (
            <span className="flex flex-wrap gap-1.5">
              {pilot.wounded && <StatusTag tone="hurt">{WOUNDED_LABEL}</StatusTag>}
              {assignedUnit && <StatusTag tone="neutral">{assignedUnit.nameAndVariant || 'Unnamed unit'}</StatusTag>}
            </span>
          )}
        </span>
      </Link>
      <Link href="/roster" className="flex items-center justify-between px-3 min-h-touch border-t border-steel-500 dossier-label text-signal-blue">
        {assignedUnit ? 'View on Roster' : 'Add to Roster'} <span aria-hidden="true">&gt;</span>
      </Link>
    </div>
  )
}
