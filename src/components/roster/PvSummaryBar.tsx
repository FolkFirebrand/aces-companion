'use client'

import { useCampaignStore } from '@/store/campaign'
import { selectTotalRosterPV } from '@/store/selectors'
import { FORCE_PV_LIMIT } from '@/lib/rules'
import { cn } from '@/lib/utils'

/** The force's total PV at Skill 4 against the 400 PV a new force is built with. */
export function PvSummaryBar() {
  const { campaign } = useCampaignStore()
  const pv = selectTotalRosterPV(campaign.units)
  const over = pv > FORCE_PV_LIMIT

  return (
    <div className="bg-steel-800 border border-steel-500 px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="dossier-label text-text-secondary">Force PV</span>
        <span className={cn('font-stencil text-2xl tabular-nums', over ? 'text-danger' : 'text-amber')}>
          {pv} <span className="text-base text-text-secondary">/ {FORCE_PV_LIMIT}</span>
        </span>
      </div>
      <div className="h-2 bg-steel-900 border border-steel-500" aria-hidden="true">
        <div className={cn('h-full', over ? 'bg-danger' : 'bg-amber')} style={{ width: `${Math.min(100, (pv / FORCE_PV_LIMIT) * 100)}%` }} />
      </div>
      <div className="flex justify-between text-[13px] text-text-secondary">
        <span>{campaign.units.length} unit{campaign.units.length === 1 ? '' : 's'}</span>
        {over && <span className="text-danger">{pv - FORCE_PV_LIMIT} PV over the starting limit</span>}
      </div>
    </div>
  )
}
