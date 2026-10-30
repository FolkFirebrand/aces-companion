'use client'

import Link from 'next/link'
import { useCampaignStore } from '@/store/campaign'
import {
  CRIT_SLOTS, MOTIVE_SLOTS, SHUTDOWN, ammoHitEffect, edgeTokensLeft, specialCounter, withSpecialUse, cardReadout, hasPending, motiveRollModifier, shownMarks, tapPip, usesHeatAndMechCrits,
  usesVehicleCrits, withMotiveCount,
} from '@/lib/battle'
import type { MotiveHit } from '@/lib/types'
import type { BattleMarks, Unit, UnitBattle, UnitType } from '@/lib/types'
import { StatusTag } from '@/components/dossier/StatusTag'
import { DossierButton } from '@/components/dossier/DossierButton'
import { TextInput } from '@/components/sortie/fields'
import { UnitPhoto } from '@/components/roster/UnitPhoto'
import { cn } from '@/lib/utils'

const TYPE_CODES: Record<UnitType, string> = { BattleMech: 'BM', 'Combat Vehicle': 'CV', 'Battle Armor': 'BA', 'Conventional Infantry': 'CI' }

type PipState = 'empty' | 'hit' | 'pendingHit' | 'pendingHeal'

function pipState(index: number, committed: number, shown: number): PipState {
  if (index < Math.min(committed, shown)) return 'hit'
  if (index < shown) return 'pendingHit'
  if (index < committed) return 'pendingHeal'
  return 'empty'
}

const PIP_STYLES: Record<PipState, string> = {
  empty: 'bg-transparent',
  hit: 'bg-amber border-amber',
  pendingHit: 'border-dashed border-danger bg-[repeating-linear-gradient(45deg,rgba(240,122,74,.45)_0_4px,transparent_4px_8px)]',
  pendingHeal: 'border-dashed border-signal-blue',
}

const PIP_LABELS: Record<PipState, string> = { empty: '', hit: ', hit', pendingHit: ', hit (pending)', pendingHeal: ', repaired (pending)' }

function PipTrack({ label, total, field, committed, shown, structure, onTap }: {
  label: string
  total: number
  field: 'armor' | 'structure'
  committed: BattleMarks
  shown: BattleMarks
  structure?: boolean
  onTap: (hits: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="dossier-label text-text-secondary">{label} · {Math.max(0, total - shown[field])} of {total} left</span>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const state = pipState(i, committed[field], shown[field])
          return (
            <button key={i} type="button" aria-label={`${label} ${i + 1}${PIP_LABELS[state]}`} onClick={() => onTap(tapPip(shown[field], i))}
              className={cn('w-8 h-8 rounded-full border-2', structure ? 'border-text-secondary bg-steel-600' : 'border-text-primary', PIP_STYLES[state])} />
          )
        })}
      </div>
    </div>
  )
}

const CRITS: { key: 'engine' | 'fireControl' | 'mp' | 'weapons'; label: string; effect: string }[] = [
  { key: 'engine', label: 'Engine', effect: '+1 heat firing · 2nd destroys' },
  { key: 'fireControl', label: 'Fire control', effect: '+2 to-hit each' },
  { key: 'mp', label: 'MP', effect: '½ move and TMM each' },
  { key: 'weapons', label: 'Weapons', effect: '−1 damage each' },
]

const VEHICLE_CRITS: { key: 'engine' | 'fireControl' | 'weapons'; label: string; effect: string }[] = [
  { key: 'engine', label: 'Engine', effect: '½ move and damage · 2nd destroys' },
  { key: 'fireControl', label: 'Fire control', effect: '+2 to-hit each' },
  { key: 'weapons', label: 'Weapons', effect: '−1 damage each' },
]

const MOTIVE: { kind: MotiveHit; label: string; effect: string }[] = [
  { kind: 'minus2', label: '−2" move', effect: '−2" and −1 TMM each' },
  { kind: 'half', label: '½ move', effect: '½ move and TMM each' },
]

function heatEffect(heat: number): string {
  if (heat >= SHUTDOWN) return 'Shutdown: no move, TMM −4'
  if (heat === 0) return 'No heat effects'
  return `−${heat * 2}" move${heat >= 2 ? ', −1 TMM' : ''}, +${heat} to-hit`
}

/** One unit's Alpha Strike card in play mode (#41, #43): compact when closed, full when open. */
export function BattleCard({ sortieId, unit, record, pilotName, skill, open, onToggle, readOnly, crewLabel = 'Crew', edgeTokens }: {
  sortieId: string
  unit: Unit
  record: UnitBattle
  pilotName: string | null
  skill: number
  open: boolean
  onToggle: () => void
  readOnly: boolean
  /** Shown in place of a Named Pilot: 'Crew' for the Player Force, 'Enemy' for the Opposing Force. */
  crewLabel?: string
  /** The Named Pilot's Edge Tokens stat (#45); absent for crews and enemies. */
  edgeTokens?: number
}) {
  const { markBattle, applyBattle, discardBattle, setBattleNotes } = useCampaignStore()
  const shown = shownMarks(record)
  const readout = cardReadout(unit, shown, skill)
  const pending = hasPending(record)
  const committedReadout = cardReadout(unit, record.committed, skill)
  const committedDestroyed = committedReadout.destroyed
  const mech = usesHeatAndMechCrits(unit)
  const vehicle = usesVehicleCrits(unit)
  const crits = mech ? CRITS : vehicle ? VEHICLE_CRITS : []
  // Structure gone destroys the unit by itself; the button is for crit results like a 12.
  const structureGone = !!unit.structure && shown.structure >= unit.structure

  const header = (
    <>
      <UnitPhoto unit={unit} size={open ? 40 : 32} />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className={cn('font-condensed font-bold text-[15px] tracking-[0.5px] uppercase truncate', committedDestroyed && 'line-through decoration-danger')}>
          {unit.nameAndVariant}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
          <span>{pilotName ?? crewLabel} · Sk {skill} · {TYPE_CODES[unit.unitType]} · SZ {unit.size}</span>
          {committedDestroyed && <StatusTag tone="hurt">Destroyed{record.destroyedRound ? ` · round ${record.destroyedRound}` : ''}</StatusTag>}
          {committedReadout.crippled && <StatusTag tone="amber">Crippled</StatusTag>}
          {committedReadout.shutdown && !committedDestroyed && <StatusTag tone="hurt">Shutdown</StatusTag>}
          {pending && <StatusTag tone="neutral" className="border-dashed border-danger text-danger">Pending</StatusTag>}
        </span>
      </span>
      {open
        ? <span className="font-stencil text-xl text-amber">{unit.pvAtSkill4}</span>
        : <span className="text-xs text-text-secondary whitespace-nowrap">A {readout.armorLeft}/{unit.armor ?? 0} · S {readout.structureLeft}/{unit.structure ?? 0}</span>}
    </>
  )

  return (
    <div className={cn('bg-steel-800 border border-steel-500', pending && 'outline-2 outline-dashed outline-danger -outline-offset-1')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-2 px-2.5 py-2 text-left min-h-touch">
        {header}
      </button>

      {open && (
        <>
          {readout.missingStats ? (
            <div className="px-2.5 py-2 border-t border-steel-500 text-[13px] text-text-secondary">
              This unit has no armor or structure yet. <Link href="/roster" className="text-signal-blue underline">Link it to the unit list or fill its stats in on the Roster</Link> to track it.
            </div>
          ) : (
            <>
              <div className="px-2.5 py-2 border-t border-steel-500">
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {[
                    ['MV', readout.move, committedReadout.move, readout.move !== readout.baseMove ? readout.baseMove : null],
                    ['SPR', readout.sprint, committedReadout.sprint, null],
                    ['TMM', readout.tmm ?? '–', committedReadout.tmm ?? '–', null],
                    ['OV', unit.overheat ?? 0, unit.overheat ?? 0, null],
                  ].map(([label, value, committedValue, base]) => (
                    <div key={String(label)} className={cn('bg-steel-900 border py-0.5', value !== committedValue ? 'border-dashed border-danger' : 'border-steel-600')}>
                      <div className="dossier-label text-[10px] text-text-secondary">{label}</div>
                      <div className="font-condensed font-bold text-[15px] leading-tight">{value}</div>
                      {base !== null && <div className="text-[10px] leading-tight text-text-secondary">({base})</div>}
                    </div>
                  ))}
                  {readout.damage.map((d, i) => (
                    <div key={d.range} className={cn('bg-steel-900 border py-0.5',
                      d.text !== committedReadout.damage[i].text || d.toHit !== committedReadout.damage[i].toHit ? 'border-dashed border-danger' : 'border-steel-600')}>
                      <div className="dossier-label text-[10px] text-text-secondary">{d.range}</div>
                      <div className="font-condensed font-bold text-[15px] leading-tight">{d.text}</div>
                      <div className="font-condensed font-bold text-[13px] leading-tight text-signal-blue">{d.toHit}+</div>
                    </div>
                  ))}
                </div>
                <p className="m-0 mt-1 text-[11px] text-text-secondary">To-hit is Skill + range{mech ? ' + heat + fire control' : vehicle ? ' + fire control' : ''}. Add the target&apos;s TMM and terrain at the table.</p>
                {mech && (
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="dossier-label text-text-secondary w-10">Heat</span>
                      <div className="flex-1 grid grid-cols-5 gap-1" role="group" aria-label="Heat">
                        {[0, 1, 2, 3, SHUTDOWN].map(level => {
                          const now = record.committed.heat === level
                          const next = shown.heat === level && shown.heat !== record.committed.heat
                          return (
                            <button key={level} type="button" aria-pressed={shown.heat === level} disabled={readOnly}
                              onClick={() => markBattle(sortieId, unit.id, { heat: level })}
                              className={cn('h-9 border font-stencil text-base',
                                next ? 'border-2 border-dashed border-danger text-danger' : now ? 'bg-amber border-amber text-on-amber' : 'border-steel-500 bg-steel-900 text-text-secondary')}>
                              {level === SHUTDOWN ? 'S' : level}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {shown.heat !== record.committed.heat && (
                      <span className="text-[11px] text-danger">Pending heat {shown.heat === SHUTDOWN ? 'S' : shown.heat}: {heatEffect(shown.heat)}</span>
                    )}
                  </div>
                )}
              </div>

              {edgeTokens !== undefined && edgeTokens > 0 && (
                <div className="px-2.5 py-2 border-t border-steel-500 flex flex-col gap-1">
                  <span className="dossier-label text-text-secondary">
                    Edge · {pilotName} · {edgeTokensLeft(edgeTokens, shown.edgeSpent)} of {edgeTokens} left
                  </span>
                  <div className="flex flex-wrap gap-3.5 px-1.5 py-1" role="group" aria-label="Edge tokens">
                    {Array.from({ length: edgeTokens }, (_, i) => {
                      const state = pipState(i, record.committed.edgeSpent, shown.edgeSpent)
                      return (
                        <button key={i} type="button" aria-label={`Edge token ${i + 1}${state === 'empty' ? '' : state === 'hit' ? ', spent' : state === 'pendingHit' ? ', spent (pending)' : ', restored (pending)'}`}
                          disabled={readOnly}
                          onClick={() => markBattle(sortieId, unit.id, { edgeSpent: Math.min(edgeTokens, tapPip(shown.edgeSpent, i)) })}
                          className={cn('w-7 h-7 rotate-45 border-2 border-amber', state === 'hit' ? 'bg-amber' : PIP_STYLES[state])} />
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="px-2.5 py-2 border-t border-steel-500 flex flex-col gap-2">
                <PipTrack label="Armor" total={unit.armor ?? 0} field="armor" committed={record.committed} shown={shown}
                  onTap={hits => !readOnly && markBattle(sortieId, unit.id, { armor: hits })} />
                <PipTrack label="Structure" total={unit.structure ?? 0} field="structure" committed={record.committed} shown={shown} structure
                  onTap={hits => !readOnly && markBattle(sortieId, unit.id, { structure: hits })} />
                {shown.structure > record.committed.structure && (
                  <span className="text-[11px] text-danger">Structure hit: roll for a critical hit{mech || vehicle ? ' and mark it below' : ''}.</span>
                )}
                {vehicle && (shown.armor > record.committed.armor || shown.structure > record.committed.structure) && (
                  <span className="text-[11px] text-signal-blue">Hit to a vehicle: roll for motive damage ({motiveRollModifier(unit)}).</span>
                )}
              </div>

              {crits.length > 0 && (
                <div className="px-2.5 py-2 border-t border-steel-500 flex flex-col gap-1.5">
                  <span className="dossier-label text-text-secondary">Critical hits</span>
                  <div className="flex flex-col gap-1">
                    {crits.map(c => (
                      <div key={c.key} className="flex items-center gap-1.5 min-h-8">
                        <span className="font-condensed font-bold text-xs tracking-[0.5px] uppercase w-[68px] shrink-0">{c.label}</span>
                        {Array.from({ length: CRIT_SLOTS[c.key] }, (_, i) => {
                          const state = pipState(i, record.committed[c.key], shown[c.key])
                          return (
                            <button key={i} type="button" aria-label={`${c.label} ${i + 1}${PIP_LABELS[state]}`} disabled={readOnly}
                              onClick={() => markBattle(sortieId, unit.id, { [c.key]: tapPip(shown[c.key], i) })}
                              className={cn('w-6 h-6 rounded-full border-2 border-text-primary shrink-0', state === 'hit' ? 'bg-text-primary' : PIP_STYLES[state])} />
                          )
                        })}
                        <span className="flex-1 min-w-0 text-[11px] leading-tight text-text-secondary">{c.effect}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button type="button" disabled={readOnly} aria-pressed={shown.ammoHit} onClick={() => markBattle(sortieId, unit.id, { ammoHit: !shown.ammoHit })}
                      className={cn('h-8 px-2.5 border font-condensed font-bold text-xs tracking-[1px] uppercase',
                        shown.ammoHit !== record.committed.ammoHit ? 'border-2 border-dashed border-danger text-danger' : shown.ammoHit ? 'bg-text-primary text-steel-900 border-text-primary' : 'border-steel-500 text-text-secondary')}>
                      Ammo hit
                    </button>
                    <span className="text-[11px] text-text-secondary">{ammoHitEffect(unit)}</span>
                  </div>
                  {vehicle && (
                    <>
                      <span className="dossier-label text-text-secondary pt-1">Motive damage</span>
                      {MOTIVE.map(m => {
                        const committedCount = record.committed.motive.filter(x => x === m.kind).length
                        const shownCount = shown.motive.filter(x => x === m.kind).length
                        return (
                          <div key={m.kind} className="flex items-center gap-1.5 min-h-8">
                            <span className="font-condensed font-bold text-xs tracking-[0.5px] uppercase w-[68px] shrink-0">{m.label}</span>
                            {Array.from({ length: MOTIVE_SLOTS[m.kind] }, (_, i) => {
                              const state = pipState(i, committedCount, shownCount)
                              return (
                                <button key={i} type="button" aria-label={`${m.label} ${i + 1}${PIP_LABELS[state]}`} disabled={readOnly}
                                  onClick={() => markBattle(sortieId, unit.id, { motive: withMotiveCount(shown.motive, m.kind, tapPip(shownCount, i)) })}
                                  className={cn('w-6 h-6 rounded-full border-2 border-text-primary shrink-0', state === 'hit' ? 'bg-text-primary' : PIP_STYLES[state])} />
                              )
                            })}
                            <span className="flex-1 min-w-0 text-[11px] leading-tight text-text-secondary">{m.effect}</span>
                          </div>
                        )
                      })}
                      <div className="flex items-center gap-1.5 min-h-8">
                        <span className="font-condensed font-bold text-xs tracking-[0.5px] uppercase w-[68px] shrink-0">Immobile</span>
                        {(() => {
                          const state = pipState(0, record.committed.immobilized ? 1 : 0, shown.immobilized ? 1 : 0)
                          return (
                            <button type="button" aria-label={`Immobilized${PIP_LABELS[state]}`} disabled={readOnly}
                              onClick={() => markBattle(sortieId, unit.id, { immobilized: !shown.immobilized })}
                              className={cn('w-6 h-6 rounded-full border-2 border-text-primary shrink-0', state === 'hit' ? 'bg-text-primary' : PIP_STYLES[state])} />
                          )
                        })()}
                        <span className="flex-1 min-w-0 text-[11px] leading-tight text-text-secondary">No move, TMM −4</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="px-2.5 py-2 border-t border-steel-500 flex flex-col gap-2">
                {!readOnly && !structureGone && (
                  <button type="button" onClick={() => markBattle(sortieId, unit.id, { destroyed: !shown.destroyed })}
                    className={cn('self-start h-8 px-2.5 border font-condensed font-bold text-xs tracking-[1px] uppercase', shown.destroyed ? 'border-signal-blue text-signal-blue' : 'border-danger text-danger')}>
                    {shown.destroyed ? 'Not destroyed' : 'Mark destroyed'}
                  </button>
                )}
              </div>

              {(unit.abilities?.length ?? 0) > 0 && (
                <div className="px-2.5 py-2 border-t border-steel-500 flex flex-col gap-1.5">
                  <span className="dossier-label text-text-secondary">Specials</span>
                  <div className="flex flex-wrap gap-1">
                    {unit.abilities!.filter(a => !specialCounter(a)).map(a => (
                      <span key={a} className="font-condensed font-bold text-xs tracking-[0.5px] px-1.5 py-0.5 border border-steel-500 bg-steel-900">{a}</span>
                    ))}
                  </div>
                  {unit.abilities!.flatMap(a => {
                    const counter = specialCounter(a)
                    if (!counter) return []
                    const used = shown.specialsUsed[a] ?? 0
                    const pendingUse = used !== (record.committed.specialsUsed[a] ?? 0)
                    const step = (change: 1 | -1) => markBattle(sortieId, unit.id, { specialsUsed: withSpecialUse(shown.specialsUsed, a, change) })
                    return [(
                      <div key={a} className={cn('flex items-center gap-2 min-h-touch px-2 border bg-steel-900', pendingUse ? 'border-dashed border-danger' : 'border-steel-500')}>
                        <span className="font-condensed font-bold text-sm tracking-[0.5px] text-amber">{a}</span>
                        <span className="flex-1 text-[13px] text-text-secondary">
                          {counter.kind === 'uses' ? `${counter.max - used} of ${counter.max} left` : used ? 'Exhausted' : 'Ready'}
                        </span>
                        {counter.kind === 'uses' ? (
                          <>
                            <button type="button" aria-label={`Undo a use of ${a}`} disabled={readOnly || used === 0} onClick={() => step(-1)}
                              className="w-9 h-9 border-2 border-signal-blue text-signal-blue font-bold disabled:border-steel-500 disabled:text-text-disabled">−</button>
                            <button type="button" aria-label={`Use ${a}`} disabled={readOnly || used >= counter.max} onClick={() => step(1)}
                              className="h-9 px-3 border-2 border-signal-blue text-signal-blue font-condensed font-bold text-xs tracking-[1px] uppercase disabled:border-steel-500 disabled:text-text-disabled">Use</button>
                          </>
                        ) : (
                          <button type="button" disabled={readOnly} onClick={() => step(used ? -1 : 1)}
                            className="h-9 px-3 border-2 border-signal-blue text-signal-blue font-condensed font-bold text-xs tracking-[1px] uppercase">
                            {used ? 'Restore' : 'Exhaust'}
                          </button>
                        )}
                      </div>
                    )]
                  })}
                </div>
              )}
            </>
          )}

          <div className="px-2.5 py-2 border-t border-steel-500 flex flex-col gap-1">
            <label htmlFor={`notes-${unit.id}`} className="dossier-label text-text-secondary">Notes</label>
            <TextInput id={`notes-${unit.id}`} value={record.notes} disabled={readOnly} onChange={notes => setBattleNotes(sortieId, unit.id, notes)} />
          </div>

          {pending && !readOnly && (
            <div className="px-2.5 py-2 border-t border-steel-500 grid grid-cols-[1fr_auto] gap-2">
              <DossierButton variant="primary" className="h-touch text-base" onClick={() => applyBattle(sortieId, unit.id)}>Apply</DossierButton>
              <DossierButton variant="secondary" onClick={() => discardBattle(sortieId, unit.id)}>Discard</DossierButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}
