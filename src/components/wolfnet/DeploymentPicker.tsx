'use client'

import { ARTILLERY, MAX_DEPLOYED_UNITS, SCENARIO_PV, TYPE_NAMES, checkDeployment, forcePv, unitPv } from '@/lib/wolfnet/rules'
import type { WnDeployment, WnForce } from '@/lib/wolfnet/types'
import { StatusTag } from '@/components/dossier/StatusTag'
import { cn } from '@/lib/utils'

export type DeploymentPick = Pick<WnDeployment, 'unitIds' | 'artilleryIds'>

function toggled(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

/** The running totals and any rules a deployment breaks. */
export function DeploymentTotals({ force, pick }: { force: WnForce; pick: DeploymentPick }) {
  const units = force.units.filter(u => pick.unitIds.includes(u.id))
  const pv = forcePv(units, force.artillery.filter(a => pick.artilleryIds.includes(a.id)))
  const { problems } = checkDeployment(force, pick)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={cn('font-mono font-bold text-lg', pv > SCENARIO_PV ? 'text-danger' : 'text-result')}>{pv}/{SCENARIO_PV} PV</span>
        <span className={cn('font-mono font-bold text-lg', units.length > MAX_DEPLOYED_UNITS ? 'text-danger' : 'text-result')}>{units.length}/{MAX_DEPLOYED_UNITS} units</span>
        {problems.length === 0 ? <StatusTag tone="keyword">Legal deployment</StatusTag> : <StatusTag tone="hurt">{problems.length === 1 ? '1 problem' : `${problems.length} problems`}</StatusTag>}
      </div>
      {problems.length > 0 && (
        <ul className="m-0 pl-4 text-sm text-danger flex flex-col gap-0.5">
          {problems.map(p => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  )
}

/** Tick the units and artillery cards to deploy for a scenario, with the totals kept as you go. */
export function DeploymentPicker({ force, pick, onChange }: { force: WnForce; pick: DeploymentPick; onChange: (pick: DeploymentPick) => void }) {
  const row = 'min-h-touch flex items-center gap-3 px-2 py-1.5 border-b border-line cursor-pointer'
  return (
    <div className="flex flex-col gap-2">
      <DeploymentTotals force={force} pick={pick} />
      <ul className="m-0 p-0 list-none bg-surface border border-line">
        {force.units.map(u => {
          const on = pick.unitIds.includes(u.id)
          return (
            <li key={u.id}>
              <label className={cn(row, on && 'bg-surface-raised')}>
                <input type="checkbox" checked={on} onChange={() => onChange({ ...pick, unitIds: toggled(pick.unitIds, u.id) })} className="size-5 accent-[var(--color-active)]" />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-label font-bold truncate">{u.name}</span>
                  <span className="text-xs text-text-secondary">{TYPE_NAMES[u.type]} · Skill {u.skill}</span>
                </span>
                <span className="font-mono font-bold text-active">{unitPv(u)}</span>
              </label>
            </li>
          )
        })}
        {force.artillery.map(a => {
          const on = pick.artilleryIds.includes(a.id)
          return (
            <li key={a.id}>
              <label className={cn(row, on && 'bg-surface-raised')}>
                <input type="checkbox" checked={on} onChange={() => onChange({ ...pick, artilleryIds: toggled(pick.artilleryIds, a.id) })} className="size-5 accent-[var(--color-active)]" />
                <span className="flex-1 min-w-0 font-label font-bold truncate">{ARTILLERY[a.kind].name}</span>
                <span className="font-mono font-bold text-active">{ARTILLERY[a.kind].pv}</span>
              </label>
            </li>
          )
        })}
        {force.units.length + force.artillery.length === 0 && <li className="p-3 text-sm text-text-secondary">This force has no units yet.</li>}
      </ul>
    </div>
  )
}
