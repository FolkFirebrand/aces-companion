'use client'

import { useRef } from 'react'
import { forceFileContents, importForce } from '@/lib/unit-list/import-force'
import type { ForceUnit } from '@/lib/unit-list/import-force'
import { loadUnitList } from '@/lib/unit-list/load'
import { downloadTextFile } from '@/lib/campaign-io'
import type { Unit } from '@/lib/types'

/** Downloads a player force as a force file, e.g. to open on another device (#37). */
export function downloadForceFile(units: Unit[], campaignName: string) {
  const forceUnits: ForceUnit[] = units.map(u => {
    const unit: Partial<Unit> = { ...u }
    delete unit.id
    delete unit.photoUrl
    return { ...(unit as Omit<Unit, 'id'>), pilotId: null, totalSpEarned: 0 }
  })
  const name = (campaignName || 'force').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  downloadTextFile(`${name}_player-force.json`, forceFileContents(forceUnits, 'player'))
}

/**
 * Upload a force built elsewhere, e.g. a MegaMek .mul or a force file from this app. Shares the Opposing Force's
 * importer (#40); units not on the unit list still come in, with the stats the file gives.
 */
export type UploadNote = { ok: boolean; text: string }

export function UploadForceLink({ onUpload, onNote }: { onUpload: (units: ForceUnit[]) => void; onNote: (note: UploadNote) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const list = await loadUnitList().catch(() => [])
      const { units: uploaded, unmatched } = importForce(await file.text(), list)
      onUpload(uploaded)
      onNote({
        ok: true,
        text: `${uploaded.length} unit${uploaded.length === 1 ? '' : 's'} uploaded.${unmatched.length ? ` Not on the unit list: ${unmatched.join(', ')}.` : ''}`,
      })
    } catch (err) {
      onNote({ ok: false, text: err instanceof Error ? err.message : 'The file could not be uploaded.' })
    }
  }

  return (
    <>
      <button type="button" onClick={() => fileRef.current?.click()} className="min-h-touch field-label text-result"
        title="A MegaMek .mul (e.g. from MekBay), a Unit Builder file, or a force file from this app">
        Upload a force file ›
      </button>
      <input ref={fileRef} type="file" accept=".mul,.json,.xml,application/json" onChange={handleUpload} className="hidden" aria-hidden="true" tabIndex={-1} />
    </>
  )
}
