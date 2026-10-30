'use client'

import { useRef } from 'react'
import { compressImage } from '@/hooks/useCompressImage'
import { useUnitIcon } from '@/lib/unit-list/icons'
import type { Unit } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * A unit's picture (ADR 0006): the player's own photo, else a picture from an older import, else MegaMek's
 * icon, else a placeholder. With `onPhotoChange`, tapping it uploads a photo, e.g. of the painted miniature.
 */
export function UnitPhoto({ unit, size, onPhotoChange }: {
  unit: Pick<Unit, 'nameAndVariant' | 'photoUrl' | 'imageURL' | 'iconPath'>
  size: number
  onPhotoChange?: (photoUrl: string | undefined) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const icon = useUnitIcon(unit.photoUrl || unit.imageURL ? undefined : unit.iconPath)
  const src = unit.photoUrl || unit.imageURL || icon

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onPhotoChange) return
    try {
      onPhotoChange(await compressImage(file))
    } catch (err) {
      console.error('Failed to compress image:', err)
    }
  }

  const face = src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" className={cn('w-full h-full', unit.photoUrl ? 'object-cover' : 'object-contain')} />
    : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="w-2/5 h-2/5 text-text-secondary">
        <path d="M12 3 4 7v10l8 4 8-4V7z M4 7l8 4 8-4 M12 11v10" strokeLinejoin="round" />
      </svg>
    )
  const box = 'shrink-0 overflow-hidden bg-steel-900 border border-steel-500 flex items-center justify-center'

  if (!onPhotoChange) return <div className={box} style={{ width: size, height: size }}>{face}</div>
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <button type="button" onClick={() => fileRef.current?.click()} aria-label={`Add a photo of ${unit.nameAndVariant || 'this unit'}`}
        className={cn(box, 'hover:border-amber')} style={{ width: size, height: size }}>
        {face}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" aria-hidden="true" tabIndex={-1} />
      {unit.photoUrl && (
        <button type="button" onClick={() => onPhotoChange(undefined)} className="dossier-label text-[11px] text-signal-blue min-h-6 px-1">Use icon</button>
      )}
    </div>
  )
}
