'use client'

import { useRef } from 'react'
import { compressImage } from '@/hooks/useCompressImage'
import { useCampaignStore } from '@/store/campaign'
import type { NamedPilot } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A Named Pilot's photo, or a camera placeholder. With `editable`, tapping it uploads a new one. */
export function PilotPhoto({ pilot, size, editable = false }: { pilot: NamedPilot; size: number; editable?: boolean }) {
  const updatePilot = useCampaignStore(s => s.updatePilot)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      updatePilot(pilot.id, { photoUrl: await compressImage(file) })
    } catch (err) {
      console.error('Failed to compress image:', err)
    }
  }

  const face = pilot.photoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={pilot.photoUrl} alt={pilot.callsign} className="w-full h-full object-cover" />
    : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="w-2/5 h-2/5 text-text-secondary">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  const box = 'shrink-0 overflow-hidden bg-surface-raised border border-line flex items-center justify-center'

  if (!editable) return <div className={box} style={{ width: size, height: size }}>{face}</div>
  return (
    <>
      <button type="button" onClick={() => fileRef.current?.click()} aria-label={`Upload a photo of ${pilot.callsign || 'this pilot'}`}
        className={cn(box, 'hover:border-active')} style={{ width: size, height: size }}>
        {face}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" aria-hidden="true" tabIndex={-1} />
    </>
  )
}

/** Wounds are set by the sortie's Crew Checks and heal after the next sortie. */
export const WOUNDED_LABEL = 'Wounded · sits out next sortie'
