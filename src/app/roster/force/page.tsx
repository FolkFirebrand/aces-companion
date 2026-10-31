'use client'

import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { selectCanEditStartingForce, selectTotalRosterPV } from '@/store/selectors'
import { FORCE_PV_LIMIT, MIN_SETUP_UNITS } from '@/lib/rules'
import { UNIT_TYPES } from '@/lib/types'
import { FileHeader } from '@/components/dossier/FileHeader'
import { ForceBuilder, ForceRules } from '@/components/roster/ForceBuilder'

/** Build the Force again from the Roster, for a unit missed at setup. Only until the first sortie is logged. */
export default function RosterForcePage() {
  const { campaign, addStartingUnit, removeStartingUnit } = useCampaignStore()
  const pv = selectTotalRosterPV(campaign.units)
  const over = pv > FORCE_PV_LIMIT

  return (
    <>
      <FileHeader label={`${campaign.forceName || 'New force'} · Player force`} title="Build the Force"
        summary={`Choose units worth up to ${FORCE_PV_LIMIT} PV at Skill 4`} />
      <div className="max-w-xl mx-auto px-gutter py-4 flex flex-col gap-3.5">
        {selectCanEditStartingForce(campaign) ? (
          <>
            <ForceBuilder units={campaign.units} onAdd={addStartingUnit} onRemove={removeStartingUnit} over={over} />
            <ForceRules checks={[
              { ok: !over, text: `No more than ${FORCE_PV_LIMIT} PV` },
              { ok: campaign.units.length >= MIN_SETUP_UNITS, text: `At least ${MIN_SETUP_UNITS} units (${campaign.units.length} so far)` },
              { ok: true, text: 'All at Skill 4' },
              { ok: campaign.units.every(u => UNIT_TYPES.includes(u.unitType)), text: 'BattleMechs, battle armor, vehicles and infantry only' },
            ]} />
            <p className="m-0 text-[13px] text-text-secondary">Unspent PV still converts to SP, so your starting Warchest follows the force&apos;s PV.</p>
          </>
        ) : (
          <p className="m-0 text-sm text-text-secondary">
            Your first sortie is logged, so the starting force is set. New units join through Purchase Additional Units after a sortie.
          </p>
        )}
        <Link href="/roster" className="self-start min-h-touch flex items-center dossier-label text-signal-blue">‹ Back to the Roster</Link>
      </div>
    </>
  )
}
