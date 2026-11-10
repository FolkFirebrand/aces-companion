'use client'

import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { selectAvailableSP, selectCanPilot, selectEffectivePilot, selectPilotAssignedUnit, selectPilotSkill, selectPilotEdgeTokens } from '@/store/selectors'
import { StatusTag } from '@/components/dossier/StatusTag'
import { Select } from '@/components/sortie/fields'
import { PilotPhoto, WOUNDED_LABEL } from '@/components/pilots/PilotPhoto'
import type { NamedPilot } from '@/lib/types'

/** A Named Pilot on the Roster; pick a unit of their type to assign or move them. */
export function BenchPilotCard({ pilot: stored }: { pilot: NamedPilot }) {
  const { campaign, assignPilot } = useCampaignStore()
  const pilot = selectEffectivePilot(campaign, stored)
  const tokens = selectPilotEdgeTokens(pilot)
  const available = selectAvailableSP(pilot)
  const unit = selectPilotAssignedUnit(campaign.units, pilot.id)
  const selectId = `pilot-unit-${pilot.id}`

  return (
    <div className="bg-surface border border-line flex flex-col">
      <div className="flex gap-2.5 p-3">
        <PilotPhoto pilot={pilot} size={48} editable />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="flex justify-between items-baseline gap-2">
            <Link href={`/pilots/${pilot.id}`} className="font-label font-bold text-base tracking-[1px] uppercase text-active truncate hover:underline">
              {pilot.callsign || 'Unnamed pilot'}
            </Link>
            <span className="font-label font-bold text-xs tracking-[1px] text-text-secondary whitespace-nowrap">{pilot.pilotType}</span>
          </span>
          <span className="text-[13px] text-text-secondary">
            Skill {selectPilotSkill(pilot)} · {tokens} token{tokens === 1 ? '' : 's'}{available > 0 ? ` · ${available} SP unspent` : ''}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {pilot.wounded && <StatusTag tone="hurt">{WOUNDED_LABEL}</StatusTag>}
            <StatusTag tone={unit ? 'neutral' : 'active'}>{unit ? `On ${unit.nameAndVariant || 'unnamed unit'}` : 'No unit'}</StatusTag>
          </span>
          {pilot.edgeAbilitiesLearned.filter(Boolean).length > 0 && (
            <span className="flex flex-wrap gap-1 pt-0.5">
              {pilot.edgeAbilitiesLearned.filter(Boolean).map(a => <StatusTag key={a} tone="keyword">{a}</StatusTag>)}
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-line p-2 flex flex-col gap-1">
        <label htmlFor={selectId} className="field-label text-text-secondary">Unit · {pilot.pilotType} only</label>
        <Select id={selectId} value={unit?.id ?? ''} className="max-w-none"
          onChange={v => (v ? assignPilot(v, pilot.id) : unit && assignPilot(unit.id, null))}>
          <option value="">No unit</option>
          {campaign.units.filter(u => selectCanPilot(pilot, u) || u.id === unit?.id).map(u => {
            const other = u.pilotId && u.pilotId !== pilot.id ? campaign.namedPilots.find(p => p.id === u.pilotId) : undefined
            return (
              <option key={u.id} value={u.id}>
                {u.nameAndVariant || 'Unnamed unit'}{other ? ` · replaces ${other.callsign || 'unnamed pilot'}` : ''}
              </option>
            )
          })}
        </Select>
      </div>
    </div>
  )
}
