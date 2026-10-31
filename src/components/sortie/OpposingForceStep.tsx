'use client'

import { useRef, useState } from 'react'
import { useCampaignStore } from '@/store/campaign'
import { opposingForcePv, opposingTemplate } from '@/lib/opposing-force'
import { importForce, forceFileContents } from '@/lib/unit-list/import-force'
import type { ForceUnit } from '@/lib/unit-list/import-force'
import { loadUnitList } from '@/lib/unit-list/load'
import { unitFromEntry, unitListName } from '@/lib/unit-list/convert'
import type { UnitListEntry } from '@/lib/unit-list/convert'
import { downloadTextFile } from '@/lib/campaign-io'
import type { OpposingUnit, Sortie, UnitType } from '@/lib/types'
import { DossierButton } from '@/components/dossier/DossierButton'
import { Select, TextInput } from '@/components/sortie/fields'
import { UnitListPicker } from '@/components/roster/UnitListPicker'
import { UnitPhoto } from '@/components/roster/UnitPhoto'

const TYPE_LABELS: Record<UnitType, string> = { BattleMech: "'Mech", 'Combat Vehicle': 'Vehicle', 'Battle Armor': 'Battle armor', 'Conventional Infantry': 'Infantry' }
const SKILLS = [0, 1, 2, 3, 4, 5, 6, 7]

function statLine(u: OpposingUnit) {
  const damage = u.damageText?.join('/') ?? (u.damage ? `${u.damage.short}/${u.damage.medium}/${u.damage.long}` : null)
  return [TYPE_LABELS[u.unitType], `Size ${u.size}`, u.armor !== undefined ? `A${u.armor} S${u.structure ?? 0}` : null, damage, `${u.pvAtSkill4} PV`, `Skill ${u.skill}`]
    .filter(Boolean).join(' · ')
}

function EnemyRow({ sortieId, unit }: { sortieId: string; unit: OpposingUnit }) {
  const { updateOpposingUnit, removeOpposingUnit } = useCampaignStore()
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex flex-col border-b border-steel-500 py-2 gap-2">
      <div className="flex items-center gap-2.5">
        <UnitPhoto unit={unit} size={40} />
        <button type="button" onClick={() => setEditing(e => !e)} aria-expanded={editing} className="flex-1 min-w-0 flex flex-col text-left min-h-touch justify-center">
          <span className="font-condensed font-bold text-base tracking-[0.5px] truncate">{unit.nameAndVariant}</span>
          <span className="text-[13px] text-text-secondary">{statLine(unit)}</span>
        </button>
        <button type="button" onClick={() => removeOpposingUnit(sortieId, unit.id)} aria-label={`Remove ${unit.nameAndVariant}`}
          className="w-touch h-touch shrink-0 text-text-secondary hover:text-danger">✕</button>
      </div>
      {editing && (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end pl-[50px]">
          <label className="flex flex-col gap-1">
            <span className="dossier-label text-text-secondary">Name</span>
            <TextInput id={`enemy-name-${unit.id}`} value={unit.nameAndVariant} onChange={nameAndVariant => updateOpposingUnit(sortieId, unit.id, { nameAndVariant })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="dossier-label text-text-secondary">Skill</span>
            <Select id={`enemy-skill-${unit.id}`} value={String(unit.skill)} onChange={v => updateOpposingUnit(sortieId, unit.id, { skill: Number(v) })}>
              {SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
        </div>
      )}
    </div>
  )
}

/** Sortie Setup step 6: this sortie's enemy units, tracked in play mode. */
export function OpposingForceStep({ sortie }: { sortie: Sortie }) {
  const { campaign, addOpposingCopies } = useCampaignStore()
  const force = sortie.opposingForce ?? []
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [mode, setMode] = useState<'pick' | null>(force.length === 0 ? 'pick' : null)
  const [picked, setPicked] = useState<UnitListEntry | null>(null)
  const [copies, setCopies] = useState(1)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const list = await loadUnitList().catch(() => [])
      const { units, unmatched } = importForce(await file.text(), list)
      units.forEach(u => addOpposingCopies(sortie.id, opposingTemplate(u, u.skill), 1))
      setNote({
        ok: true,
        text: `${units.length} unit${units.length === 1 ? '' : 's'} uploaded.${unmatched.length ? ` Not on the unit list: ${unmatched.join(', ')}.` : ''}`,
      })
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'The file could not be uploaded.' })
    }
  }

  function download() {
    const units: ForceUnit[] = force.map(u => {
      const unit: Partial<OpposingUnit> = { ...u }
      delete unit.id
      delete unit.baseName
      return { ...(unit as Omit<OpposingUnit, 'id' | 'baseName'>), nameAndVariant: u.baseName, pilotId: null, totalSpEarned: 0 }
    })
    const name = (campaign.name || 'campaign').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadTextFile(`${name}_sortie-${sortie.sortieNumber}_opposing-force.json`, forceFileContents(units, 'opposing'))
  }

  function addPicked() {
    if (!picked) return
    addOpposingCopies(sortie.id, opposingTemplate(unitFromEntry(picked)), copies)
    setPicked(null)
    setCopies(1)
    setMode(null)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <DossierButton variant="secondary" onClick={() => fileRef.current?.click()}>Upload file</DossierButton>
        <DossierButton variant="secondary" onClick={download} disabled={force.length === 0}>Download</DossierButton>
        <input ref={fileRef} type="file" accept=".mul,.json,.xml,application/json" onChange={handleUpload} className="hidden" aria-hidden="true" tabIndex={-1} />
      </div>
      <p className="m-0 text-[13px] text-text-secondary">
        Upload a MegaMek .mul (e.g. from MekBay), a Unit Builder file, or an Opposing Force downloaded from this app, e.g. built on your PC.
      </p>
      {note && <p role={note.ok ? 'status' : 'alert'} className={note.ok ? 'm-0 text-sm text-text-secondary' : 'm-0 text-sm text-danger'}>{note.text}</p>}

      <section className="flex flex-col">
        <div className="flex justify-between items-baseline pb-1 border-b-2 border-steel-500">
          <span className="dossier-label text-text-secondary">Enemy units · {force.length}</span>
          <span className="font-stencil text-xl text-amber">{opposingForcePv(force)} <span className="text-xs text-text-secondary">PV</span></span>
        </div>
        {force.length === 0
          ? <p className="m-0 py-2 text-sm text-text-secondary">No enemy units yet.</p>
          : force.map(u => <EnemyRow key={u.id} sortieId={sortie.id} unit={u} />)}
        {force.length > 0 && <p className="m-0 pt-1.5 text-[13px] text-text-secondary">Tap a unit to rename it or set its Skill, e.g. to match the counter on your table.</p>}
      </section>

      {mode === null && (
        <DossierButton variant="secondary" className="self-start" onClick={() => setMode('pick')}>+ Add enemy units</DossierButton>
      )}

      {mode === 'pick' && (
        <div className="flex flex-col gap-3 p-3.5 bg-steel-800 border border-steel-500">
          <span className="font-condensed font-bold text-sm tracking-[1px] text-amber">ADD ENEMY UNITS</span>
          {picked ? (
            <>
              <div className="flex items-center gap-2.5 pb-2 border-b border-steel-500">
                <span className="flex-1 flex flex-col">
                  <span className="font-condensed font-bold text-[15px]">{unitListName(picked)}</span>
                  <span className="text-[13px] text-text-secondary">Size {picked.size} · A{picked.armor} S{picked.structure} · {picked.damage.join('/')} · {picked.pv} PV</span>
                </span>
                <button type="button" onClick={() => setPicked(null)} className="dossier-label text-signal-blue min-h-touch px-1">Change</button>
              </div>
              <div className="flex justify-between items-center">
                <span className="dossier-label text-text-secondary">Copies</span>
                <span className="flex items-center gap-2.5">
                  <button type="button" aria-label="Fewer copies" disabled={copies <= 1} onClick={() => setCopies(c => c - 1)}
                    className="w-touch h-touch border-2 border-signal-blue text-signal-blue font-condensed font-bold text-lg disabled:border-steel-500 disabled:text-text-disabled">−</button>
                  <span className="font-stencil text-2xl w-7 text-center">{copies}</span>
                  <button type="button" aria-label="More copies" disabled={copies >= 12} onClick={() => setCopies(c => c + 1)}
                    className="w-touch h-touch border-2 border-signal-blue text-signal-blue font-condensed font-bold text-lg disabled:border-steel-500 disabled:text-text-disabled">+</button>
                </span>
              </div>
              <DossierButton variant="primary" className="h-touch text-base" onClick={addPicked}>
                Add {copies === 1 ? '1 unit' : `${copies} units`}
              </DossierButton>
            </>
          ) : (
            <UnitListPicker onPick={entry => { setPicked(entry); setCopies(1) }} />
          )}
          {force.length > 0 && (
            <DossierButton variant="secondary" className="self-start border-steel-500 text-text-secondary" onClick={() => { setPicked(null); setMode(null) }}>Cancel</DossierButton>
          )}
        </div>
      )}

      <p className="m-0 text-[13px] text-text-secondary">
        The Opposing Force belongs to this sortie only. It never joins your Roster and never counts toward the Warchest or Campaign Log. You&apos;ll track it in Play the Sortie.
      </p>
    </>
  )
}
