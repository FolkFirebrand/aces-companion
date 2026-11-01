'use client'

import Link from 'next/link'
import { useState } from 'react'
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
  hit: 'bg-active border-active',
  pendingHit: 'border-dashed border-danger bg-[repeating-linear-gradient(45deg,rgba(239,122,95,.45)_0_4px,transparent_4px_8px)]',
  pendingHeal: 'border-dashed border-result',
}

const PIP_LABELS: Record<PipState, string> = { empty: '', hit: ', hit', pendingHit: ', hit (pending)', pendingHeal: ', repaired (pending)' }

function PipTrack({ label, short, total, field, committed, shown, structure, disabled, onTap }: {
  label: string
  short: string
  total: number
  field: 'armor' | 'structure'
  committed: BattleMarks
  shown: BattleMarks
  structure?: boolean
  disabled: boolean
  onTap: (hits: number) => void
}) {
  return (
    <div className="flex items-start" role="group" aria-label={`${label} · ${Math.max(0, total - shown[field])} of ${total} left`}>
      <span className="field-label text-[11px] tracking-[1.5px] text-text-secondary w-5 shrink-0 leading-8">{short}</span>
      <div className="flex-1 flex flex-wrap">
        {Array.from({ length: total }, (_, i) => {
          const state = pipState(i, committed[field], shown[field])
          return (
            <button key={i} type="button" aria-label={`${label} ${i + 1}${PIP_LABELS[state]}`} disabled={disabled} onClick={() => onTap(tapPip(shown[field], i))}
              className="w-7 h-8 flex items-center justify-center shrink-0">
              <span className={cn('block w-[22px] h-[22px] rounded-full border-2', structure ? 'border-text-secondary bg-surface-raised' : 'border-text-primary', PIP_STYLES[state])} />
            </button>
          )
        })}
      </div>
      <span className="font-label font-bold text-sm leading-8 shrink-0 pl-1">
        {Math.max(0, total - shown[field])}<span className="text-text-secondary">/{total}</span>
      </span>
    </div>
  )
}

/** A small tap target holding one crit or motive pip. */
function CritPip({ label, state, disabled, onClick }: { label: string; state: PipState; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={`${label}${PIP_LABELS[state]}`} disabled={disabled} onClick={onClick} className="w-[22px] h-[30px] flex items-center justify-center shrink-0">
      <span className={cn('block w-[18px] h-[18px] rounded-full border-2 border-text-primary', state === 'hit' ? 'bg-text-primary' : PIP_STYLES[state])} />
    </button>
  )
}

/** One box of the critical-hit grid: name and pips on top, the effect underneath, as on the printed card. */
function CritBox({ label, effect, pending, children }: { label: string; effect: string; pending: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('bg-surface-deep border px-1.5 pt-0.5 pb-1 flex flex-col min-w-0', pending ? 'border-dashed border-danger' : 'border-surface-raised')}>
      <div className="flex items-center gap-0.5">
        <span className="flex-1 min-w-0 font-label font-bold text-xs tracking-[0.5px] uppercase truncate">{label}</span>
        {children}
      </div>
      <span className="text-[11px] leading-tight text-text-secondary">{effect}</span>
    </div>
  )
}

/** Armor and structure left, as tiny bars for a closed card. */
function MiniTrack({ short, total, hits }: { short: string; total: number; hits: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      <span className="field-label text-[10px] tracking-[1px] text-text-secondary mr-0.5">{short}</span>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('w-1.5 h-3 border', i < hits ? 'bg-active border-active' : 'border-text-secondary')} />
      ))}
    </span>
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

  // On the open card's teal header bar the tags turn dark so they stay readable.
  const headerBar = open && !committedDestroyed
  const onBar = headerBar ? 'bg-surface-deep border-0' : ''
  const [notesOpen, setNotesOpen] = useState(record.notes !== '')
  const heatShown = mech && shown.heat > 0

  const edge = edgeTokens !== undefined && edgeTokens > 0 && (
    <>
      <span className="field-label text-[11px] tracking-[1.5px] text-text-secondary">Edge</span>
      <div className="flex flex-wrap" role="group" aria-label={`Edge tokens · ${edgeTokensLeft(edgeTokens, shown.edgeSpent)} of ${edgeTokens} left`}>
        {Array.from({ length: edgeTokens }, (_, i) => {
          const state = pipState(i, record.committed.edgeSpent, shown.edgeSpent)
          return (
            <button key={i} type="button" aria-label={`Edge token ${i + 1}${state === 'empty' ? '' : state === 'hit' ? ', spent' : state === 'pendingHit' ? ', spent (pending)' : ', restored (pending)'}`}
              disabled={readOnly}
              onClick={() => markBattle(sortieId, unit.id, { edgeSpent: Math.min(edgeTokens, tapPip(shown.edgeSpent, i)) })}
              className="w-[30px] h-[30px] flex items-center justify-center">
              <span className={cn('block w-4 h-4 rotate-45 border-2 border-active', state === 'hit' ? 'bg-active' : PIP_STYLES[state])} />
            </button>
          )
        })}
      </div>
    </>
  )
  // A few Edge tokens fit beside Heat; more get their own row.
  const edgeBesideHeat = mech && (edgeTokens ?? 0) <= 3

  const header = (
    <>
      <UnitPhoto unit={unit} size={open ? 32 : 28} />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className={cn('font-label font-bold text-[15px] leading-tight tracking-[0.5px] uppercase truncate', committedDestroyed && 'line-through decoration-danger')}>
          {unit.nameAndVariant}
        </span>
        <span className={cn('flex flex-wrap items-center gap-1.5 text-xs', headerBar ? 'text-on-active' : 'text-text-secondary')}>
          <span>{pilotName ?? crewLabel} · Sk {skill} · {TYPE_CODES[unit.unitType]} · SZ {unit.size}</span>
          {committedDestroyed && <StatusTag tone="hurt">Destroyed{record.destroyedRound ? ` · round ${record.destroyedRound}` : ''}</StatusTag>}
          {committedReadout.crippled && <StatusTag tone="active" className={cn(onBar, headerBar && 'text-active')}>Crippled</StatusTag>}
          {committedReadout.shutdown && !committedDestroyed && <StatusTag tone="hurt" className={cn(onBar, headerBar && 'text-danger')}>Shutdown</StatusTag>}
          {pending && <StatusTag tone="neutral" className={cn('border-dashed', headerBar ? 'border-on-active text-on-active' : 'border-danger text-danger')}>Pending</StatusTag>}
        </span>
      </span>
      {open ? (
        <span className={cn('font-display font-bold text-[22px]', headerBar ? 'text-on-active' : 'text-active')}>{unit.pvAtSkill4}</span>
      ) : !readout.missingStats && !committedDestroyed && (
        <>
          <span className="flex flex-col items-end gap-[3px]">
            <MiniTrack short="A" total={unit.armor ?? 0} hits={shown.armor} />
            <MiniTrack short="S" total={unit.structure ?? 0} hits={shown.structure} />
          </span>
          <span className="sr-only">Armor {readout.armorLeft} of {unit.armor ?? 0}, structure {readout.structureLeft} of {unit.structure ?? 0} left</span>
          {heatShown && <StatusTag tone="keyword">{shown.heat >= SHUTDOWN ? 'Heat S' : `Heat ${shown.heat}`}</StatusTag>}
        </>
      )}
    </>
  )

  const chip = 'h-8 px-2 border font-label font-bold text-xs tracking-[1px] uppercase inline-flex items-center gap-1.5'

  return (
    <div className={cn('bg-surface border border-line', pending && 'outline-2 outline-dashed outline-danger -outline-offset-1')}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 text-left min-h-touch', headerBar && 'bg-active text-on-active')}>
        {header}
      </button>

      {open && (
        <>
          {readout.missingStats ? (
            <div className="px-2.5 py-2 border-t border-line text-[13px] text-text-secondary">
              This unit has no armor or structure yet. <Link href="/roster" className="text-result underline">Link it to the unit list or fill its stats in on the Roster</Link> to track it.
            </div>
          ) : (
            <div className="px-2 pt-1.5 pb-2 flex flex-col gap-1.5">
              <div className="grid grid-cols-7 gap-[3px] text-center"
                title={`To-hit is Skill + range${mech ? ' + heat + fire control' : vehicle ? ' + fire control' : ''}. Add the target's TMM and terrain at the table.`}>
                {[
                  ['MV', readout.move, committedReadout.move, readout.move !== readout.baseMove ? readout.baseMove : null],
                  ['SPR', readout.sprint, committedReadout.sprint, null],
                  ['TMM', readout.tmm ?? '–', committedReadout.tmm ?? '–', null],
                  ['OV', unit.overheat ?? 0, unit.overheat ?? 0, null],
                ].map(([label, value, committedValue, base]) => (
                  <div key={String(label)} className={cn('bg-surface-deep border py-0.5 min-w-0', value !== committedValue ? 'border-dashed border-danger' : 'border-surface-raised')}>
                    <div className="field-label text-[10px] tracking-[1px] text-text-secondary">{label}</div>
                    <div className="font-label font-bold text-[15px] leading-tight">{value}</div>
                    {base !== null && <div className="text-[10px] leading-tight text-text-secondary">({base})</div>}
                  </div>
                ))}
                {readout.damage.map((d, i) => (
                  <div key={d.range} className={cn('bg-surface-deep border py-0.5 min-w-0',
                    d.text !== committedReadout.damage[i].text || d.toHit !== committedReadout.damage[i].toHit ? 'border-dashed border-danger' : 'border-surface-raised')}>
                    <div className="field-label text-[10px] tracking-[1px] text-text-secondary">{d.range}</div>
                    <div className="font-label font-bold text-[15px] leading-tight whitespace-nowrap">
                      {d.text}<span className="sr-only">, to-hit</span><span className="text-xs text-result ml-0.5">{d.toHit}+</span>
                    </div>
                  </div>
                ))}
              </div>

              {mech && (
                <div className="flex items-center gap-1">
                  <span className="field-label text-[11px] tracking-[1.5px] text-text-secondary w-9">Heat</span>
                  <div className="flex gap-[3px]" role="group" aria-label="Heat">
                    {[0, 1, 2, 3, SHUTDOWN].map(level => {
                      const now = record.committed.heat === level
                      const next = shown.heat === level && shown.heat !== record.committed.heat
                      return (
                        <button key={level} type="button" aria-pressed={shown.heat === level} disabled={readOnly}
                          onClick={() => markBattle(sortieId, unit.id, { heat: level })}
                          className={cn('w-8 h-[30px] border font-display font-bold text-[15px]',
                            next ? 'border-2 border-dashed border-danger text-danger' : now ? 'bg-active border-active text-on-active' : 'border-line bg-surface-deep text-text-secondary')}>
                          {level === SHUTDOWN ? 'S' : level}
                        </button>
                      )
                    })}
                  </div>
                  <span className="flex-1" />
                  {edgeBesideHeat && edge}
                </div>
              )}
              {!edgeBesideHeat && edge && <div className="flex items-center gap-1 justify-end">{edge}</div>}
              {mech && shown.heat !== record.committed.heat && (
                <span className="text-[11px] text-danger">Pending heat {shown.heat === SHUTDOWN ? 'S' : shown.heat}: {heatEffect(shown.heat)}</span>
              )}

              <div className="flex flex-col">
                <PipTrack label="Armor" short="A" total={unit.armor ?? 0} field="armor" committed={record.committed} shown={shown} disabled={readOnly}
                  onTap={hits => markBattle(sortieId, unit.id, { armor: hits })} />
                <PipTrack label="Structure" short="S" total={unit.structure ?? 0} field="structure" committed={record.committed} shown={shown} structure disabled={readOnly}
                  onTap={hits => markBattle(sortieId, unit.id, { structure: hits })} />
                {shown.structure > record.committed.structure && (
                  <span className="text-[11px] text-danger">Structure hit: roll for a critical hit{mech || vehicle ? ' and mark it below' : ''}.</span>
                )}
                {vehicle && (shown.armor > record.committed.armor || shown.structure > record.committed.structure) && (
                  <span className="text-[11px] text-result">Hit to a vehicle: roll for motive damage ({motiveRollModifier(unit)}).</span>
                )}
              </div>

              {crits.length > 0 && (
                <div className="grid grid-cols-2 gap-[3px]" role="group" aria-label="Critical hits">
                  {crits.map(c => (
                    <CritBox key={c.key} label={c.key === 'fireControl' ? 'Fire ctrl' : c.label} effect={c.effect} pending={shown[c.key] !== record.committed[c.key]}>
                      {Array.from({ length: CRIT_SLOTS[c.key] }, (_, i) => (
                        <CritPip key={i} label={`${c.label} ${i + 1}`} state={pipState(i, record.committed[c.key], shown[c.key])} disabled={readOnly}
                          onClick={() => markBattle(sortieId, unit.id, { [c.key]: tapPip(shown[c.key], i) })} />
                      ))}
                    </CritBox>
                  ))}
                  {vehicle && MOTIVE.map(m => {
                    const committedCount = record.committed.motive.filter(x => x === m.kind).length
                    const shownCount = shown.motive.filter(x => x === m.kind).length
                    return (
                      <CritBox key={m.kind} label={m.label} effect={m.effect} pending={shownCount !== committedCount}>
                        {Array.from({ length: MOTIVE_SLOTS[m.kind] }, (_, i) => (
                          <CritPip key={i} label={`${m.label} ${i + 1}`} state={pipState(i, committedCount, shownCount)} disabled={readOnly}
                            onClick={() => markBattle(sortieId, unit.id, { motive: withMotiveCount(shown.motive, m.kind, tapPip(shownCount, i)) })} />
                        ))}
                      </CritBox>
                    )
                  })}
                  {vehicle && (
                    <CritBox label="Immobile" effect="No move, TMM −4" pending={shown.immobilized !== record.committed.immobilized}>
                      <CritPip label="Immobilized" state={pipState(0, record.committed.immobilized ? 1 : 0, shown.immobilized ? 1 : 0)} disabled={readOnly}
                        onClick={() => markBattle(sortieId, unit.id, { immobilized: !shown.immobilized })} />
                    </CritBox>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1">
                {(unit.abilities ?? []).map(a => {
                  const counter = specialCounter(a)
                  if (!counter) return <span key={a} className={cn(chip, 'border-line bg-surface-deep text-text-primary')}>{a}</span>
                  const used = shown.specialsUsed[a] ?? 0
                  const pendingUse = used !== (record.committed.specialsUsed[a] ?? 0)
                  const step = (change: 1 | -1) => markBattle(sortieId, unit.id, { specialsUsed: withSpecialUse(shown.specialsUsed, a, change) })
                  const frame = cn('h-8 flex border bg-surface-deep', pendingUse ? 'border-dashed border-danger' : 'border-result')
                  if (counter.kind === 'uses') {
                    return (
                      <span key={a} className={cn(frame, 'items-stretch')}>
                        <span className="px-2 flex items-center gap-1 font-label font-bold text-xs tracking-[0.5px] text-active">
                          {a}<span className="text-text-secondary font-normal">· {counter.max - used} left</span>
                        </span>
                        <button type="button" aria-label={`Undo a use of ${a}`} disabled={readOnly || used === 0} onClick={() => step(-1)}
                          className="w-8 border-l border-line text-result font-bold disabled:text-text-disabled">−</button>
                        <button type="button" aria-label={`Use ${a}`} disabled={readOnly || used >= counter.max} onClick={() => step(1)}
                          className="px-2 border-l border-line text-result font-label font-bold text-xs tracking-[1px] uppercase disabled:text-text-disabled">Use</button>
                      </span>
                    )
                  }
                  return (
                    <button key={a} type="button" disabled={readOnly} aria-pressed={used > 0} onClick={() => step(used ? -1 : 1)}
                      className={cn(frame, 'px-2 items-center gap-1 font-label font-bold text-xs tracking-[0.5px] text-active')}>
                      {a}<span className="text-text-secondary font-normal">· {used ? 'Exhausted' : 'Ready'}</span>
                    </button>
                  )
                })}
                {crits.length > 0 && (
                  <button type="button" disabled={readOnly} aria-pressed={shown.ammoHit} onClick={() => markBattle(sortieId, unit.id, { ammoHit: !shown.ammoHit })}
                    className={cn(chip, shown.ammoHit !== record.committed.ammoHit ? 'border-2 border-dashed border-danger text-danger'
                      : shown.ammoHit ? 'bg-text-primary text-ink border-text-primary' : 'border-line bg-surface-deep text-text-secondary')}>
                    Ammo hit
                  </button>
                )}
                <button type="button" aria-expanded={notesOpen} onClick={() => setNotesOpen(!notesOpen)}
                  className={cn(chip, 'border-line bg-surface-deep', record.notes ? 'text-text-primary' : 'text-text-secondary')}>
                  Notes {notesOpen ? '−' : '+'}
                </button>
                <span className="flex-1" />
                {!readOnly && !structureGone && (
                  <button type="button" onClick={() => markBattle(sortieId, unit.id, { destroyed: !shown.destroyed })}
                    className={cn(chip, shown.destroyed ? 'border-result text-result' : 'border-danger text-danger')}>
                    {shown.destroyed ? 'Not destroyed' : 'Mark destroyed'}
                  </button>
                )}
              </div>
              {shown.ammoHit && <span className="text-[11px] text-text-secondary">Ammo hit: {ammoHitEffect(unit)}</span>}
            </div>
          )}

          {(readout.missingStats || notesOpen) && (
            <div className="px-2 pb-2">
              <label htmlFor={`notes-${unit.id}`} className="sr-only">Notes</label>
              <TextInput id={`notes-${unit.id}`} value={record.notes} disabled={readOnly} onChange={notes => setBattleNotes(sortieId, unit.id, notes)} />
            </div>
          )}

          {pending && !readOnly && (
            <div className="px-2 pb-2 grid grid-cols-[1fr_auto] gap-1.5">
              <DossierButton variant="primary" className="h-touch text-base" onClick={() => applyBattle(sortieId, unit.id)}>Apply</DossierButton>
              <DossierButton variant="secondary" onClick={() => discardBattle(sortieId, unit.id)}>Discard</DossierButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}
