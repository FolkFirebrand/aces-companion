'use client'

import Link from 'next/link'
import { selectEffectivePilot, selectPilotSkill, selectPilotEdgeTokens } from '@/store/selectors'
import { useCampaignStore } from '@/store/campaign'
import { StatusTag } from '@/components/dossier/StatusTag'
import { PilotPhoto, WOUNDED_LABEL } from '@/components/pilots/PilotPhoto'
import type { NamedPilot } from '@/lib/types'

interface Props {
  pilot: NamedPilot
  onUnassign: () => void
}

/** The Named Pilot assigned to a unit, inside that unit's card. */
export function PilotMiniCard({ pilot: stored, onUnassign }: Props) {
  const campaign = useCampaignStore(s => s.campaign)
  const pilot = selectEffectivePilot(campaign, stored)
  const tokens = selectPilotEdgeTokens(pilot)

  return (
    <div className="flex items-center gap-2.5">
      <PilotPhoto pilot={pilot} size={40} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <Link href={`/pilots/${pilot.id}`} className="font-condensed font-bold text-base tracking-[1px] uppercase text-amber truncate hover:underline">
          {pilot.callsign || 'Unnamed pilot'}
        </Link>
        <span className="text-[13px] text-text-secondary">Skill {selectPilotSkill(pilot)} · {tokens} token{tokens === 1 ? '' : 's'}</span>
        {pilot.wounded && <StatusTag tone="hurt" className="self-start">{WOUNDED_LABEL}</StatusTag>}
      </div>
      <button type="button" onClick={onUnassign} aria-label={`Unassign ${pilot.callsign || 'pilot'} from this unit`}
        className="w-touch h-touch shrink-0 text-text-secondary hover:text-danger">✕</button>
    </div>
  )
}
