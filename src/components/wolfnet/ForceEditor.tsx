'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWolfnetStore } from '@/store/wolfnet'
import { ERAS } from '@/lib/unit-list/convert'
import {
  ARTILLERY, FORCE_PV, GENERAL_LISTS, MAX_FORCE_UNITS, SKILL_RANGE, TYPE_LIMITS, TYPE_NAMES, checkDeployment, checkForce,
  defaultGeneralList, forcePv, playableFactions, unitPv,
} from '@/lib/wolfnet/rules'
import type { ArtilleryKind, WnForce } from '@/lib/wolfnet/types'
import { FileHeader, PageBody } from '@/components/dossier/FileHeader'
import { DossierButton } from '@/components/dossier/DossierButton'
import { StatusTag } from '@/components/dossier/StatusTag'
import { Field, Section, Select, TextInput } from '@/components/sortie/fields'
import { UnitListPicker } from '@/components/roster/UnitListPicker'
import { DeploymentPicker, type DeploymentPick } from './DeploymentPicker'
import { useListContext } from './useListContext'
import { cn } from '@/lib/utils'

const stepper = 'w-touch h-touch border border-line font-display font-bold text-lg disabled:opacity-40'

/** Build and check a Wolfnet 350 force, and save the 250 PV deployments to take into scenarios. */
export function ForceEditor({ force }: { force: WnForce }) {
  const router = useRouter()
  const store = useWolfnetStore()
  const list = useListContext()
  const [adding, setAdding] = useState(force.units.length === 0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const check = useMemo(() => checkForce(force, list ?? undefined), [force, list])
  const pv = forcePv(force.units, force.artillery)
  const factions = useMemo(() => playableFactions(list?.factions ?? []), [list])
  const groups = [...new Set(factions.map(f => f.group))]
  const pickerFactions = list
    ? [force.faction, force.generalList].map(name => list.factions.findIndex(f => f.name === name)).filter(i => i >= 0)
    : []

  function setFaction(name: string) {
    const faction = list?.factions.find(f => f.name === name)
    store.updateForce(force.id, { faction: name || null, generalList: defaultGeneralList(faction?.group) })
  }

  return (
    <>
      <FileHeader label="Wolfnet 350 · Force" title={force.name || 'New force'}
        summary={force.faction && force.era !== null ? `${force.faction} · ${ERAS[force.era].name}` : 'Choose an era and faction, then add units.'}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          <span className={cn('font-mono font-bold text-lg', pv > FORCE_PV ? 'text-danger' : 'text-result')}>{pv}/{FORCE_PV} PV</span>
          <span className={cn('font-mono font-bold text-lg', force.units.length > MAX_FORCE_UNITS ? 'text-danger' : 'text-result')}>{force.units.length}/{MAX_FORCE_UNITS} units</span>
          {check.problems.length === 0 ? <StatusTag tone="keyword">Tournament legal</StatusTag> : <StatusTag tone="hurt">Not tournament legal</StatusTag>}
        </div>
      </FileHeader>
      <PageBody>
        <Section title="Force">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="wn-force-name" label="Force name">
              <TextInput id="wn-force-name" value={force.name} onChange={name => store.updateForce(force.id, { name })} placeholder="e.g. Third Battle Group" />
            </Field>
            <Field id="wn-era" label="Era" hint="Tournaments set the era for everyone.">
              <Select id="wn-era" value={force.era === null ? '' : String(force.era)} onChange={v => store.updateForce(force.id, { era: v === '' ? null : Number(v) })}>
                <option value="">Choose an era</option>
                {ERAS.map((era, i) => <option key={era.name} value={i}>{era.name} ({era.from}–{era.to ?? ''})</option>)}
              </Select>
            </Field>
            <Field id="wn-faction" label="Faction">
              <Select id="wn-faction" value={force.faction ?? ''} onChange={setFaction}>
                <option value="">{list ? 'Choose a faction' : 'Loading factions…'}</option>
                {groups.map(group => (
                  <optgroup key={group} label={group}>
                    {factions.filter(f => f.group === group).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field id="wn-general" label="General List" hint="Check beside your faction's name on the MUL; some factions have none.">
              <Select id="wn-general" value={force.generalList ?? ''} onChange={v => store.updateForce(force.id, { generalList: v || null })}>
                <option value="">None (Blank General List)</option>
                {GENERAL_LISTS.map(g => <option key={g} value={g}>{g}</option>)}
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Construction check" aside={list ? undefined : 'Loading unit list…'}>
          {check.problems.length === 0 && <p className="m-0 text-sm text-active">No rules broken.</p>}
          {check.problems.length > 0 && (
            <ul className="m-0 pl-4 text-sm text-danger flex flex-col gap-0.5">{check.problems.map(p => <li key={p}>{p}</li>)}</ul>
          )}
          {check.notes.length > 0 && (
            <ul className="m-0 pl-4 text-sm text-text-secondary flex flex-col gap-0.5">{check.notes.map(n => <li key={n}>{n}</li>)}</ul>
          )}
          <p className="m-0 text-xs text-text-muted">
            {TYPE_LIMITS.map(l => `${force.units.filter(u => l.types.includes(u.type)).length}/${l.max} ${l.label}`).join(' · ')}.
            {' '}Not checked here: alternate munitions, special abilities and formation bonuses (none allowed), and the banned-unit list.
          </p>
        </Section>

        <Section title="Units" aside={`${force.units.length} of ${MAX_FORCE_UNITS}`}>
          {force.units.length > 0 && (
            <ul className="m-0 p-0 list-none bg-surface border border-line">
              {force.units.map(u => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 border-b border-line">
                  <span className="flex-1 min-w-[10rem] flex flex-col">
                    <span className="font-label font-bold">{u.name}</span>
                    <span className="text-xs text-text-secondary">{TYPE_NAMES[u.type]} · Size {u.size} · {u.basePv} PV at Skill 4{u.rules && u.rules !== 'Introductory' ? ` · ${u.rules}` : ''}</span>
                  </span>
                  <span className="flex items-center gap-1" role="group" aria-label={`Skill of ${u.name}`}>
                    <button type="button" className={stepper} aria-label="Better Skill" disabled={u.skill <= SKILL_RANGE.min} onClick={() => store.setUnitSkill(force.id, u.id, u.skill - 1)}>−</button>
                    <span className="w-14 text-center font-label text-xs text-text-secondary">SKILL<br /><span className="font-mono font-bold text-base text-text-primary">{u.skill}</span></span>
                    <button type="button" className={stepper} aria-label="Worse Skill" disabled={u.skill >= SKILL_RANGE.max} onClick={() => store.setUnitSkill(force.id, u.id, u.skill + 1)}>+</button>
                  </span>
                  <span className="w-12 text-right font-mono font-bold text-lg text-active">{unitPv(u)}</span>
                  <button type="button" aria-label={`Remove ${u.name}`} onClick={() => store.removeUnit(force.id, u.id)}
                    className="w-touch h-touch text-danger font-bold">✕</button>
                </li>
              ))}
            </ul>
          )}
          {adding ? (
            <div className="bg-surface border border-line p-3 flex flex-col gap-2">
              {/* Remounts when the faction or era changes, so its filters start from them. */}
              <UnitListPicker key={`${pickerFactions.join()}-${force.era}`} allTypes tapToAdd label="Add a unit from the unit list"
                pvLeft={FORCE_PV - pv} preset={{ factions: pickerFactions, era: force.era ?? undefined }}
                onPick={entry => store.addUnit(force.id, entry)}
                aside={<button type="button" className="field-label text-text-secondary underline" onClick={() => setAdding(false)}>Done adding</button>} />
            </div>
          ) : (
            <DossierButton variant="secondary" className="self-start" onClick={() => setAdding(true)}>+ Add units</DossierButton>
          )}
        </Section>

        <Section title="Off-Board Artillery Support" aside="PV counts; not a unit">
          {force.artillery.map(a => (
            <div key={a.id} className="flex items-center gap-3 px-2 py-1.5 bg-surface border border-line">
              <span className="flex-1 flex flex-col">
                <span className="font-label font-bold">{ARTILLERY[a.kind].name}</span>
                <span className="text-xs text-text-secondary">To-hit {ARTILLERY[a.kind].toHit} · Damage {ARTILLERY[a.kind].damage} · {ARTILLERY[a.kind].template} template · {ARTILLERY[a.kind].special}</span>
              </span>
              <span className="font-mono font-bold text-lg text-active">{ARTILLERY[a.kind].pv}</span>
              <button type="button" aria-label={`Remove ${ARTILLERY[a.kind].name}`} onClick={() => store.removeArtillery(force.id, a.id)} className="w-touch h-touch text-danger font-bold">✕</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ARTILLERY) as ArtilleryKind[]).map(kind => (
              <DossierButton key={kind} variant="secondary" onClick={() => store.addArtillery(force.id, kind)}>+ {kind === 'sniper' ? 'Sniper' : 'Thumper'} ({ARTILLERY[kind].pv} PV)</DossierButton>
            ))}
          </div>
        </Section>

        <Deployments force={force} />

        <div className="pt-4 border-t border-line flex flex-wrap gap-2">
          {confirmDelete ? (
            <>
              <span className="w-full text-sm">Delete {force.name || 'this force'} and its deployments from this device?</span>
              <DossierButton variant="danger" onClick={() => { store.deleteForce(force.id); router.push('/wolfnet') }}>Delete force</DossierButton>
              <DossierButton variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</DossierButton>
            </>
          ) : (
            <DossierButton variant="danger" onClick={() => setConfirmDelete(true)}>Delete force</DossierButton>
          )}
        </div>
      </PageBody>
    </>
  )
}

/** The force's saved 250 PV lists; one is picked when a match starts. */
function Deployments({ force }: { force: WnForce }) {
  const { saveDeployment, deleteDeployment } = useWolfnetStore()
  const [editing, setEditing] = useState<{ id?: string; name: string; pick: DeploymentPick } | null>(null)

  if (editing) {
    return (
      <Section title={editing.id ? 'Edit deployment' : 'New deployment'}>
        <Field id="wn-deploy-name" label="Name">
          <TextInput id="wn-deploy-name" value={editing.name} onChange={name => setEditing({ ...editing, name })} placeholder="e.g. Objective grabbers" />
        </Field>
        <DeploymentPicker force={force} pick={editing.pick} onChange={pick => setEditing({ ...editing, pick })} />
        <div className="flex flex-wrap gap-2">
          <DossierButton variant="primary" className="sm:max-w-xs" onClick={() => {
            saveDeployment(force.id, { id: editing.id, name: editing.name.trim() || `Deployment ${force.deployments.length + 1}`, ...editing.pick })
            setEditing(null)
          }}>Save deployment</DossierButton>
          <DossierButton variant="secondary" onClick={() => setEditing(null)}>Cancel</DossierButton>
        </div>
      </Section>
    )
  }

  return (
    <Section title="Deployments" aside="250 PV · 10 units">
      <p className="m-0 text-sm text-text-secondary">Build your 250 PV lists ahead of time, then pick one when a match starts.</p>
      {force.deployments.map(d => {
        const units = force.units.filter(u => d.unitIds.includes(u.id))
        const pv = forcePv(units, force.artillery.filter(a => d.artilleryIds.includes(a.id)))
        const legal = checkDeployment(force, d).problems.length === 0
        return (
          <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 bg-surface border border-line">
            <span className="flex-1 min-w-[10rem] flex flex-col">
              <span className="font-label font-bold">{d.name}</span>
              <span className="text-xs text-text-secondary">{pv} PV · {units.length} units{d.artilleryIds.length ? ` + ${d.artilleryIds.length} artillery` : ''}</span>
            </span>
            {legal ? <StatusTag tone="keyword">Legal</StatusTag> : <StatusTag tone="hurt">Problems</StatusTag>}
            <button type="button" className="field-label text-active underline min-h-touch" onClick={() => setEditing({ id: d.id, name: d.name, pick: d })}>Edit</button>
            <button type="button" className="field-label text-danger underline min-h-touch" onClick={() => deleteDeployment(force.id, d.id)}>Delete</button>
          </div>
        )
      })}
      <DossierButton variant="secondary" className="self-start" disabled={force.units.length === 0}
        onClick={() => setEditing({ name: '', pick: { unitIds: [], artilleryIds: [] } })}>+ New deployment</DossierButton>
    </Section>
  )
}
