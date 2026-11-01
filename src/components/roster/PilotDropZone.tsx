'use client'

import { useDroppable } from '@dnd-kit/core'
import { PilotMiniCard } from './PilotMiniCard'
import type { NamedPilot } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  unitId: string
  assignedPilot: NamedPilot | undefined
  onUnassign: () => void
}

export function PilotDropZone({ unitId, assignedPilot, onUnassign }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: unitId })

  if (assignedPilot) {
    return (
      <div ref={setNodeRef} className={cn(isOver && 'outline-2 outline-dashed outline-active')}>
        <PilotMiniCard pilot={assignedPilot} onUnassign={onUnassign} />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-touch flex items-center justify-center border-2 border-dashed field-label',
        isOver ? 'border-active text-active bg-active/10' : 'border-line text-text-secondary',
      )}
    >
      No pilot · drop a Named Pilot here
    </div>
  )
}
