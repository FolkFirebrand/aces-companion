'use client'

import { useRef, useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { forceFileContents, importForce } from '@/lib/unit-list/import-force'
import type { ForceUnit } from '@/lib/unit-list/import-force'
import { loadUnitList } from '@/lib/unit-list/load'
import { downloadTextFile } from '@/lib/campaign-io'
import type { Unit } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'

/** Upload a force built elsewhere (e.g. on a PC), or download this one (#37). Shares the Opposing Force's importer (#40). */
export function ForceFileButtons({ units, onUpload }: { units: Unit[]; onUpload: (units: ForceUnit[]) => void }) {
  const campaignName = useCampaignStore(s => s.campaign.name)
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const list = await loadUnitList().catch(() => [])
      const { units: uploaded, unmatched } = importForce(await file.text(), list)
      onUpload(uploaded)
      setNote({
        ok: true,
        text: `${uploaded.length} unit${uploaded.length === 1 ? '' : 's'} uploaded.${unmatched.length ? ` Not on the unit list, so added as custom units: ${unmatched.join(', ')}.` : ''}`,
      })
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'The file could not be uploaded.' })
    }
  }

  function download() {
    const forceUnits: ForceUnit[] = units.map(u => {
      const unit: Partial<Unit> = { ...u }
      delete unit.id
      delete unit.photoUrl
      return { ...(unit as Omit<Unit, 'id'>), pilotId: null, totalSpEarned: 0 }
    })
    const name = (campaignName || 'force').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadTextFile(`${name}_player-force.json`, forceFileContents(forceUnits, 'player'))
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <DossierButton variant="secondary" onClick={() => fileRef.current?.click()}>Upload file</DossierButton>
        <DossierButton variant="secondary" onClick={download} disabled={units.length === 0}>Download</DossierButton>
        <input ref={fileRef} type="file" accept=".mul,.json,.xml,application/json" onChange={handleUpload} className="hidden" aria-hidden="true" tabIndex={-1} />
      </div>
      <p className="m-0 text-[13px] text-text-secondary">
        Upload a MegaMek .mul (e.g. from MekBay), a Unit Builder file, or a force downloaded from this app, e.g. built on your PC.
      </p>
      {note && <p role={note.ok ? 'status' : 'alert'} className={note.ok ? 'm-0 text-sm text-text-secondary' : 'm-0 text-sm text-danger'}>{note.text}</p>}
    </>
  )
}
