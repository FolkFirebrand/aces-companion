'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FORCE_PV_LIMIT } from '@/lib/rules'
import { selectTotalRosterPV } from '@/store/selectors'
import { unitFromEntry } from '@/lib/unit-list/convert'
import { checkChassisRule } from '@/lib/unit-list/chassis'
import type { ChassisCheck } from '@/lib/unit-list/chassis'
import { loadUnitList } from '@/lib/unit-list/load'
import type { Unit } from '@/lib/types'
import { UnitListPicker } from './UnitListPicker'
import { UploadForceLink } from './ForceFile'
import type { UploadNote } from './ForceFile'
import { cn } from '@/lib/utils'

/**
 * Build the Force: the force's PV against the limit, the unit-list search (tap a result to add
 * it) and the force so far. Used by setup and, until the first sortie, from the Roster.
 */
export function ForceBuilder({ units, onAdd, onRemove, isCarried = () => false, over, overNote }: {
  units: Unit[]
  onAdd: (unit: Unit) => void
  onRemove: (unitId: string) => void
  /** Carried-over units (an Existing Force) can't be removed. */
  isCarried?: (unitId: string) => boolean
  over: boolean
  /** Shown under the PV bar instead of the overage, e.g. a carried-over force above the limit. */
  overNote?: string | null
}) {
  const [note, setNote] = useState<UploadNote | null>(null)
  const pv = selectTotalRosterPV(units)
  const unspent = Math.max(0, FORCE_PV_LIMIT - pv)

  return (
    <>
      <div className="sticky top-0 z-20 -mx-gutter px-gutter py-3 bg-surface border-y border-line flex flex-col gap-1.5">
        <div className="flex justify-between items-baseline">
          <span className="field-label text-text-secondary">Force</span>
          <span className={cn('font-display font-bold text-2xl tabular-nums', over ? 'text-danger' : 'text-active')}>
            {pv} <span className="text-base text-text-secondary">/ {FORCE_PV_LIMIT} PV</span>
          </span>
        </div>
        <div className="h-2 bg-surface-deep border border-line" aria-hidden="true">
          <div className={cn('h-full', over ? 'bg-danger' : 'bg-active')} style={{ width: `${Math.min(100, (pv / FORCE_PV_LIMIT) * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-text-secondary">{units.length} unit{units.length === 1 ? '' : 's'}</span>
          <span className={over ? 'text-danger' : 'text-result'}>
            {over ? `${pv - FORCE_PV_LIMIT} PV over the limit` : overNote}
          </span>
        </div>
      </div>

      <UnitListPicker
        label="Add a unit"
        tapToAdd
        pvLeft={unspent}
        onPick={entry => onAdd({ id: uuidv4(), ...unitFromEntry(entry) })}
        aside={<UploadForceLink onNote={setNote} onUpload={uploaded => uploaded.forEach(u => onAdd({ ...u, id: uuidv4(), pilotId: null }))} />}
      />
      {note && <p role={note.ok ? 'status' : 'alert'} className={cn('m-0 text-sm', note.ok ? 'text-text-secondary' : 'text-danger')}>{note.text}</p>}

      <div className="flex flex-col border-t border-line">
        <span className="field-label text-text-secondary pt-2.5 pb-1">Your force</span>
        {[...units].sort((a, b) => b.pvAtSkill4 - a.pvAtSkill4).map(u => (
          <div key={u.id} className="flex items-center gap-2 min-h-touch border-b border-line text-[15px]">
            <span className="flex-1">
              {u.nameAndVariant}{' '}
              <span className="font-label font-semibold text-[11px] tracking-[1px] text-text-secondary uppercase">
                · {u.unitType} · Size {u.size}{u.ene ? ' · ENE' : ''}{isCarried(u.id) ? ' · Carried over' : ''}
              </span>
            </span>
            <span className="font-display font-bold text-base text-active w-8 text-right">{u.pvAtSkill4}</span>
            {isCarried(u.id)
              ? <span className="w-touch" aria-hidden="true" />
              : <button type="button" aria-label={`Remove ${u.nameAndVariant}`} onClick={() => onRemove(u.id)} className="w-touch h-touch text-text-secondary">✕</button>}
          </div>
        ))}
        {units.length === 0 && <p className="m-0 text-sm text-text-secondary">No units yet. Search above to add one.</p>}
      </div>
    </>
  )
}

/** The setup rules for a force, ticked or crossed; `children` adds a confirmation under them. */
export function ForceRules({ checks, children }: { checks: { ok: boolean; text: string }[]; children?: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line px-3 py-2.5 flex flex-col gap-0.5">
      <span className="field-label text-text-secondary pb-1">Force rules</span>
      {checks.map(c => (
        <div key={c.text} className="flex items-center gap-2.5 min-h-8 text-sm">
          <span className={cn('font-label font-bold text-xs tracking-[1px] w-7', c.ok ? 'text-result' : 'text-danger')}>{c.ok ? '✓' : '✕'}</span>
          {c.text}
        </div>
      ))}
      {children}
    </div>
  )
}

/** An optional check of the chassis rule against the unit list; the result clears when the force changes. */
export function ChassisCheckButton({ units }: { units: Unit[] }) {
  const [checked, setChecked] = useState<{ force: string; result: ChassisCheck | null } | null>(null)
  const force = units.map(u => u.id).join()
  const result = checked?.force === force ? checked.result : undefined

  async function check() {
    try {
      setChecked({ force, result: checkChassisRule(units, await loadUnitList()) })
    } catch {
      setChecked({ force, result: null })
    }
  }

  return (
    <div className="flex flex-col gap-1 pt-1.5 mt-1 border-t border-line">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <span className="text-[13px] text-text-secondary">Optional: no more than two &apos;Mechs share a chassis, as different variants.</span>
        <button type="button" onClick={check} className="min-h-touch field-label text-result">Check my force ›</button>
      </div>
      {result === null && <p role="alert" className="m-0 text-sm text-danger">The unit list could not be loaded, so the force wasn&apos;t checked.</p>}
      {result && (
        <div role="status" className="flex flex-col gap-0.5 text-sm">
          {result.problems.length === 0
            ? <span className="text-result">✓ No chassis problems.</span>
            : result.problems.map(p => <span key={p} className="text-danger">✕ {p}</span>)}
          {result.unchecked.length > 0 && (
            <span className="text-text-secondary">Not on the unit list, so not checked: {result.unchecked.join(', ')}.</span>
          )}
        </div>
      )}
    </div>
  )
}
