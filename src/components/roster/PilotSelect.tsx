'use client'

import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { selectAssignedPilot, selectEffectivePilot, selectPilotAssignedUnit, selectPilotSkill, selectPilotEdgeTokens } from '@/store/selectors'
import { Select } from '@/components/sortie/fields'
import { StatusTag } from '@/components/dossier/StatusTag'
import { PilotPhoto, WOUNDED_LABEL } from '@/components/pilots/PilotPhoto'
import type { Unit } from '@/lib/types'

/** A unit's Named Pilot: pick one from the Roster, or none. Picking a pilot moves them off any other unit. */
export function PilotSelect({ unit }: { unit: Unit }) {
  const { campaign, assignPilot } = useCampaignStore()
  const stored = selectAssignedPilot(campaign.units, campaign.namedPilots, unit.id)
  const pilot = stored && selectEffectivePilot(campaign, stored)
  const tokens = pilot ? selectPilotEdgeTokens(pilot) : 0
  const selectId = `unit-pilot-${unit.id}`

  return (
    <div className="flex items-center gap-2.5">
      {pilot && <PilotPhoto pilot={pilot} size={40} />}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <label htmlFor={selectId} className="field-label text-text-secondary">Named Pilot</label>
        <Select id={selectId} value={unit.pilotId ?? ''} onChange={v => assignPilot(unit.id, v || null)} className="max-w-none">
          <option value="">No Named Pilot</option>
          {campaign.namedPilots.map(p => {
            const on = selectPilotAssignedUnit(campaign.units, p.id)
            return (
              <option key={p.id} value={p.id}>
                {p.callsign || 'Unnamed pilot'}{on && on.id !== unit.id ? ` · on ${on.nameAndVariant || 'unnamed unit'}` : ''}
              </option>
            )
          })}
        </Select>
        {pilot && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-secondary">
            Skill {selectPilotSkill(pilot)} · {tokens} token{tokens === 1 ? '' : 's'}
            <Link href={`/pilots/${pilot.id}`} className="field-label text-result hover:underline">Open file ›</Link>
            {pilot.wounded && <StatusTag tone="hurt">{WOUNDED_LABEL}</StatusTag>}
          </span>
        )}
      </div>
    </div>
  )
}
