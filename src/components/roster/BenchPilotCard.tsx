'use client'

import { useDraggable } from '@dnd-kit/core'
import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import { selectAvailableSP, selectEffectivePilot, selectPilotSkill, selectPilotEdgeTokens } from '@/store/selectors'
import { StatusTag } from '@/components/dossier/StatusTag'
import { PilotPhoto, WOUNDED_LABEL } from '@/components/pilots/PilotPhoto'
import type { NamedPilot } from '@/lib/types'
import { cn } from '@/lib/utils'

/** An unassigned Named Pilot; drag the handle onto a unit to assign them. */
export function BenchPilotCard({ pilot: stored }: { pilot: NamedPilot }) {
  const campaign = useCampaignStore(s => s.campaign)
  const pilot = selectEffectivePilot(campaign, stored)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: pilot.id })
  const tokens = selectPilotEdgeTokens(pilot)
  const available = selectAvailableSP(pilot)
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div ref={setNodeRef} style={style}
      className={cn('bg-steel-800 border border-steel-500 flex flex-col select-none', isDragging && 'opacity-60 z-50 shadow-lg')}>
      <div className="flex gap-2.5 p-3">
        <PilotPhoto pilot={pilot} size={48} editable />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="flex justify-between items-baseline gap-2">
            <Link href={`/pilots/${pilot.id}`} className="font-condensed font-bold text-base tracking-[1px] uppercase text-amber truncate hover:underline">
              {pilot.callsign || 'Unnamed pilot'}
            </Link>
            <span className="font-condensed font-bold text-xs tracking-[1px] text-text-secondary whitespace-nowrap">{pilot.pilotType}</span>
          </span>
          <span className="text-[13px] text-text-secondary">
            Skill {selectPilotSkill(pilot)} · {tokens} token{tokens === 1 ? '' : 's'}{available > 0 ? ` · ${available} SP unspent` : ''}
          </span>
          {pilot.wounded && <StatusTag tone="hurt" className="self-start">{WOUNDED_LABEL}</StatusTag>}
          {pilot.edgeAbilitiesLearned.filter(Boolean).length > 0 && (
            <span className="flex flex-wrap gap-1 pt-0.5">
              {pilot.edgeAbilitiesLearned.filter(Boolean).map(a => <StatusTag key={a} tone="keyword">{a}</StatusTag>)}
            </span>
          )}
        </div>
      </div>
      <button type="button" {...listeners} {...attributes}
        className="touch-none min-h-touch flex items-center justify-center gap-1.5 border-t border-steel-500 dossier-label text-signal-blue cursor-grab active:cursor-grabbing">
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="w-3.5 h-3.5">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
        Drag onto a unit
      </button>
    </div>
  )
}
