'use client'

import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { PvSummaryBar } from '@/components/roster/PvSummaryBar'
import { UnitGrid } from '@/components/roster/UnitGrid'
import { PilotBench } from '@/components/roster/PilotBench'
import { BenchPilotCard } from '@/components/roster/BenchPilotCard'
import { Memorial } from '@/components/roster/Memorial'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'

export default function RosterPage() {
  const { campaign, assignPilot } = useCampaignStore()
  const [activePilotId, setActivePilotId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    setActivePilotId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActivePilotId(null)
    if (over) {
      assignPilot(over.id as string, active.id as string)
    }
  }

  const activePilot = activePilotId
    ? campaign.namedPilots.find(p => p.id === activePilotId)
    : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <FileHeader label={`${campaign.forceName || 'New force'} · Player force`} title="Player Force Roster" />
      <PageBody>
        <PvSummaryBar />
        <PilotBench />
        <UnitGrid />
        <Memorial />
      </PageBody>
      <DragOverlay>
        {activePilot && <BenchPilotCard pilot={activePilot} />}
      </DragOverlay>
    </DndContext>
  )
}
