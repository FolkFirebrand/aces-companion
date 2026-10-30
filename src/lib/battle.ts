// Play mode (v2): a sortie's battle, card by card. Effects are derived from the marks, never stored (ADR 0007).
// Heat and critical-hit effects follow the formulas of BattleTech Tools' Alpha Strike play mode (GPL; see NOTICE).
import type { BattleMarks, DamageState, MotiveHit, SortieBattle, Unit, UnitBattle } from './types'

export const NO_MARKS: BattleMarks = {
  armor: 0, structure: 0, destroyed: false, heat: 0, engine: 0, fireControl: 0, mp: 0, weapons: 0, ammoHit: false, motive: [], immobilized: false,
  edgeSpent: 0, specialsUsed: {},
}

/** A Named Pilot's Edge tokens left this battle: their Edge Tokens stat less those spent, never below zero. */
export function edgeTokensLeft(tokens: number, spent: number): number {
  return Math.max(0, tokens - spent)
}

/** Heat levels 0–3, and 4 for Shutdown (S). */
export const SHUTDOWN = 4
export const CRIT_SLOTS = { engine: 2, fireControl: 4, mp: 4, weapons: 4 } as const
export const MOTIVE_SLOTS: Record<MotiveHit, number> = { minus2: 2, half: 2 }

// Records saved before heat and crits existed (#41) have only armor, structure and destroyed.
function marksOf(marks: Partial<BattleMarks> | undefined): BattleMarks {
  return { ...NO_MARKS, ...marks }
}

export function sortieBattle(battle: SortieBattle | undefined): SortieBattle {
  return battle ?? { round: 1, units: {} }
}

export function unitBattle(battle: SortieBattle | undefined, unitId: string): UnitBattle {
  const record = battle?.units[unitId]
  if (!record) return { committed: NO_MARKS, notes: '' }
  return { ...record, committed: marksOf(record.committed), pending: record.pending && marksOf(record.pending) }
}

function sameUses(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every(k => (a[k] ?? 0) === (b[k] ?? 0))
}

function sameMarks(a: BattleMarks, b: BattleMarks): boolean {
  return (Object.keys(NO_MARKS) as (keyof BattleMarks)[]).every(key =>
    key === 'specialsUsed' ? sameUses(a.specialsUsed, b.specialsUsed)
      : Array.isArray(a[key]) ? (a[key] as MotiveHit[]).join() === (b[key] as MotiveHit[]).join() : a[key] === b[key])
}

export type SpecialCounter = { kind: 'uses'; max: number } | { kind: 'exhaust' }

/**
 * Specials tracked during play (#55): consumables with a count in their code (BOMB#, MDS#, FUEL#, and the one-shot
 * TSEMP-O#), and exhaustible ones (RHS, ECS). Other specials are shown as plain codes.
 */
export function specialCounter(code: string): SpecialCounter | null {
  const uses = /^(BOMB|MDS|FUEL|TSEMP-O)(\d+)$/.exec(code.toUpperCase())
  if (uses) return { kind: 'uses', max: Number(uses[2]) }
  if (['RHS', 'ECS'].includes(code.toUpperCase())) return { kind: 'exhaust' }
  return null
}

/** The new uses of a special after one more use (+1) or undo (−1), kept between 0 and its limit. */
export function withSpecialUse(used: Record<string, number>, code: string, change: 1 | -1): Record<string, number> {
  const counter = specialCounter(code)
  if (!counter) return used
  const max = counter.kind === 'uses' ? counter.max : 1
  const next = Math.min(max, Math.max(0, (used[code] ?? 0) + change))
  const rest = { ...used }
  delete rest[code]
  return next ? { ...rest, [code]: next } : rest
}

/** Sets how many hits of one motive kind a vehicle has, keeping the order the hits happened in. */
export function withMotiveCount(motive: MotiveHit[], kind: MotiveHit, count: number): MotiveHit[] {
  const current = motive.filter(m => m === kind).length
  if (count > current) return [...motive, ...Array<MotiveHit>(count - current).fill(kind)]
  let toRemove = current - count
  const next = [...motive]
  for (let i = next.length - 1; i >= 0 && toRemove > 0; i--) {
    if (next[i] === kind) { next.splice(i, 1); toRemove-- }
  }
  return next
}

/** What the card shows: pending marks when there are any, otherwise the committed ones. */
export function shownMarks(record: UnitBattle): BattleMarks {
  return marksOf(record.pending ?? record.committed)
}

export function hasPending(record: UnitBattle): boolean {
  return !!record.pending && !sameMarks(marksOf(record.pending), marksOf(record.committed))
}

/** Tapping pip `index` (from 0) on a track with `hits` marked: a marked pip is unmarked with those after it; an unmarked one is marked with those before it. */
export function tapPip(hits: number, index: number): number {
  return index < hits ? index : index + 1
}

/** Changes the pending marks; back to the committed marks means nothing is pending. */
export function withPending(record: UnitBattle, change: Partial<BattleMarks>): UnitBattle {
  const committed = marksOf(record.committed)
  const pending = { ...shownMarks(record), ...change }
  return sameMarks(pending, committed) ? { ...record, committed, pending: undefined } : { ...record, committed, pending }
}

type CardUnit = Pick<Unit, 'unitType' | 'armor' | 'structure' | 'tmm' | 'move' | 'damage' | 'damageText' | 'abilities'>

function hasSpecial(unit: CardUnit, code: string): boolean {
  return (unit.abilities ?? []).some(a => a.toUpperCase() === code)
}

/** An ammo critical destroys a unit outright unless it has CASE, CASEII or ENE: an automatic Truly Destroyed case (Aces Rulebook p. 33). */
export function trulyDestroyedCause(marks: BattleMarks, unit: CardUnit): 'ammo' | null {
  return marks.ammoHit && !['CASE', 'CASEII', 'ENE'].some(code => hasSpecial(unit, code)) ? 'ammo' : null
}

/** What an ammo critical does to this unit, for the card. */
export function ammoHitEffect(unit: CardUnit): string {
  if (hasSpecial(unit, 'CASEII') || hasSpecial(unit, 'ENE')) return 'No effect (CASEII or ENE)'
  if (hasSpecial(unit, 'CASE')) return 'Has CASE: 1 extra damage'
  return 'No CASE: destroyed'
}

export function isDestroyed(marks: BattleMarks, unit: CardUnit): boolean {
  return marks.destroyed
    || (!!unit.structure && marks.structure >= unit.structure)
    || marks.engine >= CRIT_SLOTS.engine
    || trulyDestroyedCause(marks, unit) !== null
}

/** Apply: pending marks become committed, noting the round a unit is destroyed in. */
export function commitUnit(record: UnitBattle, round: number, unit: CardUnit): UnitBattle {
  if (!record.pending) return record
  const committed = marksOf(record.pending)
  const destroyedRound = isDestroyed(committed, unit) ? (record.destroyedRound ?? round) : undefined
  return { ...record, committed, pending: undefined, destroyedRound }
}

const RANGE_MODIFIERS = [0, 2, 4] as const
export const RANGES = ['S', 'M', 'L'] as const

/** Heat and the 'Mech crit tracks apply to BattleMechs; vehicles get their own tracks (#44). */
export function usesHeatAndMechCrits(unit: Pick<Unit, 'unitType'>): boolean {
  return unit.unitType === 'BattleMech'
}

/** Combat vehicles: Engine, Fire Control, Weapons, Ammo hit and motive damage; no heat. */
export function usesVehicleCrits(unit: Pick<Unit, 'unitType'>): boolean {
  return unit.unitType === 'Combat Vehicle'
}

// Motive damage roll modifiers by movement type (MegaMek move codes).
const MOTIVE_MODIFIERS: Record<string, [string, number]> = {
  t: ['tracked', 0], n: ['naval', 0], s: ['naval', 0], w: ['wheeled', 1], h: ['hover', 1], v: ['VTOL', 2], g: ['WiGE', 2],
}

/** The motive damage roll modifier for a vehicle's movement type, for the reminder. */
export function motiveRollModifier(unit: Pick<Unit, 'move'>): string {
  const known = MOTIVE_MODIFIERS[unit.move?.[0]?.type ?? '']
  return known ? `${known[0]} +${known[1]}` : 'tracked/naval +0, wheeled/hover +1, VTOL/WiGE +2'
}

// Weapons hits: −1 damage each; a value that falls to exactly 0 becomes minimal damage (0*), and 0* hit again is 0.
function damageAfterHits(text: string, hits: number, halve = false): string {
  if ((!hits && !halve) || text === '–') return text
  if (text === '0*') return hits ? '0' : text
  const parsed = parseInt(text, 10)
  if (!Number.isFinite(parsed)) return text
  // A vehicle's engine hit halves its damage (rounded down) before weapons hits.
  const value = halve ? Math.floor(parsed / 2) : parsed
  if (!hits) return String(value)
  const left = value - hits
  return left === 0 ? '0*' : left < 0 ? '0' : String(left)
}

// MP hits halve move (rounded), losing at least 2"; TMM likewise, losing at least 1.
function halved(value: number, minimumLoss: number): number {
  return Math.max(0, value - Math.max(minimumLoss, Math.round(value / 2)))
}

export interface CardReadout {
  move: string
  /** Move before any damage, shown alongside when it has changed. */
  baseMove: string
  sprint: string
  tmm: number | null
  damage: { range: (typeof RANGES)[number]; text: string; toHit: number }[]
  armorLeft: number
  structureLeft: number
  destroyed: boolean
  shutdown: boolean
  /** Alpha Strike Forced Withdrawal crippling damage (AS:QSR p. 12, as cited in Aces Rulebook p. 34). */
  crippled: boolean
  /** No armor or structure on the unit: link it to the unit list or fill the stats in. */
  missingStats: boolean
}

/** The live values on a unit's card: to-hit is Skill + range + heat + 2 per fire-control hit. */
export function cardReadout(unit: CardUnit, marks: BattleMarks, skill: number): CardReadout {
  const mech = usesHeatAndMechCrits(unit)
  const vehicle = usesVehicleCrits(unit)
  const heat = mech ? marks.heat : 0
  const mpHits = mech ? marks.mp : 0
  const fireControl = mech || vehicle ? marks.fireControl : 0
  const weapons = mech || vehicle ? marks.weapons : 0
  const vehicleEngine = vehicle && marks.engine > 0
  const motive = vehicle ? marks.motive : []
  const immobilized = vehicle && marks.immobilized

  const baseMoves = (unit.move ?? []).map(m => ({ move: m.move, type: m.type ?? '' }))
  // Damage first (MP hits), then heat, which slows ground movement only; Shutdown stops it.
  const damagedMoves = baseMoves.map(m => {
    let move = m.move
    for (let i = 0; i < mpHits; i++) move = halved(move, 2)
    // Vehicles: an engine hit halves move; motive hits follow in the order they happened.
    if (vehicleEngine) move = Math.floor(move / 2)
    for (const hit of motive) move = Math.max(0, hit === 'minus2' ? move - 2 : move - Math.max(2, Math.floor(move / 2)))
    if (immobilized) move = 0
    return { move, type: m.type }
  })
  const moves = damagedMoves.map(m => ({
    move: m.type !== 'j' || baseMoves.length === 1 ? (heat >= SHUTDOWN ? 0 : Math.max(0, m.move - heat * 2)) : m.move,
    type: m.type,
  }))
  const ground = moves[0]?.move

  let tmm = unit.tmm ?? null
  if (tmm !== null) {
    for (let i = 0; i < mpHits; i++) tmm = halved(tmm, 1)
    if (vehicleEngine) tmm = Math.floor(tmm / 2)
    for (const hit of motive) tmm = Math.max(0, hit === 'minus2' ? tmm - 1 : tmm - Math.max(1, Math.floor(tmm / 2)))
    if (heat >= SHUTDOWN || (baseMoves.length > 0 && ground === 0)) tmm = -4
    else if (heat >= 2) tmm = Math.max(0, tmm - 1)
  }

  const format = (list: { move: number; type: string }[]) => (list.length ? list.map(m => `${m.move}"${m.type}`).join('/') : '–')
  const damageText = unit.damageText ?? (unit.damage ? [unit.damage.short, unit.damage.medium, unit.damage.long].map(String) : ['–', '–', '–'])
  const damage = RANGES.map((range, i) => ({
    range,
    text: damageAfterHits(damageText[i] ?? '–', weapons, vehicleEngine),
    toHit: skill + RANGE_MODIFIERS[i] + heat + fireControl * 2,
  }))
  const armorLeft = Math.max(0, (unit.armor ?? 0) - marks.armor)
  const structureLeft = Math.max(0, (unit.structure ?? 0) - marks.structure)
  const destroyed = isDestroyed(marks, unit)
  const crippled = !destroyed && !!unit.structure && (
    (armorLeft === 0 && structureLeft * 2 <= unit.structure)
    || (damage.every(d => d.text === '0') && damageText.some(t => t !== '0' && t !== '–'))
    // Unable to move from damage; heat and Shutdown pass.
    || (damagedMoves.length > 0 && damagedMoves.every(m => m.move === 0))
  )

  return {
    move: format(moves),
    baseMove: format(baseMoves),
    // Alpha Strike sprinting: half again the ground move.
    sprint: ground ? `${ground * 1.5}"` : ground === 0 ? '0"' : '–',
    tmm,
    damage,
    armorLeft,
    structureLeft,
    destroyed,
    shutdown: heat >= SHUTDOWN,
    crippled,
    missingStats: !unit.armor && !unit.structure,
  }
}

export interface SideSummary {
  active: number
  crippled: number
  destroyed: number
  pending: number
}

/** One side's line in play mode: how many units are active, crippled, destroyed or have pending changes (committed marks). */
export function sideSummary(cards: { unit: CardUnit; record: UnitBattle; skill: number }[]): SideSummary {
  return cards.reduce((sum, c) => {
    const readout = cardReadout(c.unit, marksOf(c.record.committed), c.skill)
    return {
      active: sum.active + (readout.destroyed ? 0 : 1),
      crippled: sum.crippled + (readout.crippled ? 1 : 0),
      destroyed: sum.destroyed + (readout.destroyed ? 1 : 0),
      pending: sum.pending + (hasPending(c.record) ? 1 : 0),
    }
  }, { active: 0, crippled: 0, destroyed: 0, pending: 0 })
}

/**
 * The Damage State a battle leaves a Fielded Unit in (After-Sortie step 3, Aces Rulebook p. 33–34): destroyed, crippled,
 * structure damage or criticals, armor damage only, or undamaged. Heat leaves no damage.
 */
export function battleDamageState(marks: BattleMarks, unit: CardUnit): DamageState {
  const readout = cardReadout(unit, marks, 4)
  if (readout.destroyed) return 'destroyed'
  if (readout.crippled) return 'crippled'
  if (marks.structure > 0 || marks.engine > 0 || marks.fireControl > 0 || marks.mp > 0 || marks.weapons > 0 || marks.ammoHit
    || marks.motive.length > 0 || marks.immobilized) return 'structure'
  if (marks.armor > 0) return 'armor'
  return 'undamaged'
}
