'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useCampaignStore } from '@/store/campaign'
import { useDownloadBackup } from '@/components/campaign/LoadCampaignFile'
import { downloadForceFile } from '@/components/roster/ForceFile'
import { cn } from '@/lib/utils'

/** The top bar's Save menu: a force file or the Campaign File, from any page. Everything also autosaves in the browser. */
export function SaveMenu() {
  const pathname = usePathname()
  const campaign = useCampaignStore(s => s.campaign)
  const draft = useCampaignStore(s => s.setupDraft)
  const downloadCampaignFile = useDownloadBackup()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  // During setup the force is the draft's; the campaign in this browser may be an older one.
  const inSetup = pathname.startsWith('/setup')
  const units = inSetup ? draft?.units ?? [] : campaign.units
  const name = inSetup ? draft?.name ?? '' : campaign.name

  const item = 'w-full min-h-16 px-3.5 py-2.5 flex flex-col gap-0.5 text-left border-t border-steel-500 disabled:cursor-default'
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className={cn('h-9 px-3.5 border-2 border-signal-blue text-signal-blue font-condensed font-bold text-sm tracking-[1px] uppercase', open && 'bg-steel-600')}>
        Save {open ? '▴' : '▾'}
      </button>
      {open && (
        <div role="menu" aria-label="Save" className="absolute right-0 top-full mt-1 z-50 w-[300px] max-w-[calc(100vw-36px)] bg-steel-800 border border-steel-500 border-t-2 border-t-signal-blue flex flex-col">
          <span className="px-3.5 pt-2.5 pb-1.5 dossier-label text-text-secondary">Save</span>
          {!inSetup && (
            <button type="button" role="menuitem" className={item} onClick={() => { downloadCampaignFile(); setOpen(false) }}>
              <span className="font-condensed font-bold text-[15px] tracking-[1px] uppercase text-signal-blue">Download Campaign File</span>
              <span className="text-[13px] text-text-secondary">Everything: force, pilots, sorties, Warchest.</span>
            </button>
          )}
          <button type="button" role="menuitem" disabled={units.length === 0} className={item}
            onClick={() => { downloadForceFile(units, name); setOpen(false) }}>
            <span className={cn('font-condensed font-bold text-[15px] tracking-[1px] uppercase', units.length ? 'text-signal-blue' : 'text-text-disabled')}>Download force file</span>
            <span className="text-[13px] text-text-secondary">
              {units.length ? 'Just your units, to open on another device with Upload a force file.' : 'Add a unit first.'}
            </span>
          </button>
          {inSetup && (
            <button type="button" role="menuitem" disabled className={item}>
              <span className="font-condensed font-bold text-[15px] tracking-[1px] uppercase text-text-disabled">Download Campaign File</span>
              <span className="text-[13px] text-text-secondary">Ready once the campaign starts.</span>
            </button>
          )}
          <span className="px-3.5 py-2.5 border-t border-steel-500 text-xs text-text-muted">Your work is also kept in this browser as you go.</span>
        </div>
      )}
    </div>
  )
}
