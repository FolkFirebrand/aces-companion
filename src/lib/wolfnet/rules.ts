// Wolfnet 350 force construction, deployment and scoring (AS350 rules 3.0). Numbers follow the rules book; the
// wording here is our own.
import { cardReadout, unitBattle } from '@/lib/battle'
import type { Unit } from '@/lib/types'
import { ACES_UNIT_TYPES, ERAS, isAcesType, specialCode, unitListName } from '@/lib/unit-list/convert'
import type { ListTypeCode, UnitListEntry, UnitListFaction } from '@/lib/unit-list/convert'
import type { ArtilleryKind, WnArtillery, WnDeployment, WnForce, WnMatchUnit, WnSide, WnUnit } from './types'

export const FORCE_PV = 350
export const SCENARIO_PV = 250
export const MAX_FORCE_UNITS = 16
export const MAX_DEPLOYED_UNITS = 10
export const MIN_UNIT_PV = 7
export const SKILL_RANGE = { min: 2, max: 6 } as const
/** Units at Skill 2 or 6, together. */
export const MAX_EXTREME_SKILLS = 2
export const MAX_SHARED_CHASSIS = 2
export const MAX_JUMP_STRENGTH = 2
export const PROTOMECH_POINT = 5
export const WIN_VP = 4

/** Type limits per force: 'Mechs of any kind, Combat Vehicles, infantry of any kind, ProtoMechs. */
export const TYPE_LIMITS: { label: string; types: ListTypeCode[]; max: number }[] = [
  { label: "'Mechs", types: ['BM', 'IM'], max: 12 },
  { label: 'Combat Vehicles', types: ['CV'], max: 6 },
  { label: 'Infantry and Battle Armor', types: ['CI', 'BA'], max: 5 },
  { label: 'ProtoMechs', types: ['PM'], max: 5 },
]

export const ARTILLERY: Record<ArtilleryKind, { name: string; pv: number; toHit: number; damage: number; template: string; special: string }> = {
  sniper: { name: 'Off-Board Artillery (Sniper)', pv: 8, toHit: 8, damage: 2, template: '2"', special: 'ARTAIS-1' },
  thumper: { name: 'Off-Board Artillery (Thumper)', pv: 5, toHit: 7, damage: 1, template: '2"', special: 'ARTT-1' },
}

export const TYPE_NAMES: Record<ListTypeCode, string> = {
  BM: 'BattleMech', IM: 'IndustrialMech', PM: 'ProtoMech', CV: 'Combat Vehicle', BA: 'Battle Armor', CI: 'Conventional Infantry',
}

/**
 * A unit's PV at a Skill (Alpha Strike): each level better than 4 adds 20% of the Skill 4 PV, each level worse takes
 * 10% off, rounded normally and at least 1 a level. PV never falls below 1.
 */
export function pvAtSkill(basePv: number, skill: number): number {
  if (skill < 4) return basePv + (4 - skill) * Math.max(1, Math.round(basePv * 0.2))
  if (skill > 4) return Math.max(1, basePv - (skill - 4) * Math.max(1, Math.round(basePv * 0.1)))
  return basePv
}

export function unitPv(unit: Pick<WnUnit, 'basePv' | 'skill'>): number {
  return pvAtSkill(unit.basePv, unit.skill)
}

export function artilleryPv(artillery: WnArtillery[]): number {
  return artillery.reduce((sum, a) => sum + ARTILLERY[a.kind].pv, 0)
}

export function forcePv(units: WnUnit[], artillery: WnArtillery[]): number {
  return units.reduce((sum, u) => sum + unitPv(u), 0) + artilleryPv(artillery)
}

/** A force unit from a unit-list entry, at Skill 4. */
export function unitFromListEntry(entry: UnitListEntry, id: string): WnUnit {
  return {
    id,
    unitListId: entry.id,
    name: unitListName(entry),
    chassis: entry.chassis,
    type: entry.type,
    basePv: entry.pv,
    skill: 4,
    size: entry.size,
    tmm: entry.tmm,
    move: entry.move,
    armor: entry.armor,
    structure: entry.structure,
    damage: entry.damage,
    ov: entry.ov,
    specials: entry.specials,
    ...(entry.icon ? { icon: entry.icon } : {}),
    ...(entry.role ? { role: entry.role } : {}),
    ...(entry.rules ? { rules: entry.rules } : {}),
  }
}

/** The General List the MUL usually adds for a faction's group; players confirm it beside the faction's name. */
export function defaultGeneralList(group: string | undefined): string | null {
  switch (group) {
    case 'Inner Sphere': return 'Inner Sphere General'
    case 'IS Clan': return 'IS Clan General'
    case 'HW Clan': return 'HW Clan General'
    case 'Periphery': return 'Periphery General'
    default: return null
  }
}

export const GENERAL_LISTS = ['Inner Sphere General', 'Periphery General', 'IS Clan General', 'HW Clan General'] as const

/** Factions a force can be built from: the unit list's factions less the General Lists, Unique and Extinct. */
export function playableFactions(factions: UnitListFaction[]): UnitListFaction[] {
  return factions.filter(f => !(GENERAL_LISTS as readonly string[]).includes(f.name) && !['Unique', 'Extinct', 'Star League General'].includes(f.name))
}

export interface ForceCheck {
  /** Rules the force breaks: not tournament legal. */
  problems: string[]
  /** Things to know that don't make it illegal. */
  notes: string[]
}

export interface ListContext {
  entries: Map<string, UnitListEntry>
  factions: UnitListFaction[]
}

function factionIndex(factions: UnitListFaction[], name: string | null): number {
  return name ? factions.findIndex(f => f.name === name) : -1
}

function availableTo(entry: UnitListEntry, faction: number, era: number | null): boolean {
  return faction >= 0 && !!entry.factions?.some(([f, eras]) => f === faction && (era === null || (eras & (1 << era)) !== 0))
}

function jumpStrength(unit: Pick<WnUnit, 'specials'>): number {
  return unit.specials.reduce((sum, s) => sum + Number(/^JMPS(\d+)$/.exec(s)?.[1] ?? 0), 0)
}

/** Combat Vehicles with IT3 or more may, like infantry and ProtoMechs, field two of one variant. */
function mayRepeatVariant(unit: WnUnit): boolean {
  if (['CI', 'BA', 'PM'].includes(unit.type)) return true
  return unit.type === 'CV' && unit.specials.some(s => Number(/^IT([\d.]+)$/.exec(s)?.[1] ?? 0) >= 3)
}

function isTrailer(unit: Pick<WnUnit, 'name'>): boolean {
  return /trailer|carriage/i.test(unit.name)
}

const UNUSABLE_SPECIALS = ['ART', 'DCC', 'MDS', 'HPG', 'BOMB']

/** Checks a force against the AS350 construction rules. Without the unit list, faction and era checks are skipped. */
export function checkForce(force: WnForce, list?: ListContext): ForceCheck {
  const problems: string[] = []
  const notes: string[] = []
  const { units, artillery } = force

  const pv = forcePv(units, artillery)
  if (pv > FORCE_PV) problems.push(`${pv} PV is over the ${FORCE_PV} PV force limit.`)
  if (units.length > MAX_FORCE_UNITS) problems.push(`${units.length} units: no more than ${MAX_FORCE_UNITS} per force (artillery cards don't count).`)
  for (const limit of TYPE_LIMITS) {
    const count = units.filter(u => limit.types.includes(u.type)).length
    if (count > limit.max) problems.push(`${count} ${limit.label}: no more than ${limit.max}.`)
  }

  for (const u of units) {
    if (u.skill < SKILL_RANGE.min || u.skill > SKILL_RANGE.max) problems.push(`${u.name} is at Skill ${u.skill}: Skills run from ${SKILL_RANGE.min} to ${SKILL_RANGE.max}.`)
    const upv = unitPv(u)
    if (upv < MIN_UNIT_PV) problems.push(`${u.name} is ${upv} PV at Skill ${u.skill}: every unit must be ${MIN_UNIT_PV} PV or more.`)
    if (u.rules === 'Experimental') problems.push(`${u.name} is Experimental tech, which isn't allowed.`)
    if (u.rules === 'Unofficial') problems.push(`${u.name} has no official rules level, which isn't allowed.`)
    if (u.specials.some(s => specialCode(s) === 'DRO')) problems.push(`${u.name} has DRO, which isn't allowed.`)
    const unusable = u.specials.filter(s => UNUSABLE_SPECIALS.some(code => specialCode(s).startsWith(code)))
    if (unusable.length) notes.push(`${u.name} may be taken, but can't use ${unusable.join(', ')}.`)
  }

  const extremes = units.filter(u => u.skill === SKILL_RANGE.min || u.skill === SKILL_RANGE.max).length
  if (extremes > MAX_EXTREME_SKILLS) problems.push(`${extremes} units at Skill ${SKILL_RANGE.min} or ${SKILL_RANGE.max}: no more than ${MAX_EXTREME_SKILLS} together.`)

  const jumps = units.reduce((sum, u) => sum + jumpStrength(u), 0)
  if (jumps > MAX_JUMP_STRENGTH) problems.push(`Combined JMPS is ${jumps}: no more than ${MAX_JUMP_STRENGTH} for the force.`)

  const byChassis = new Map<string, WnUnit[]>()
  for (const u of units) byChassis.set(u.chassis, [...(byChassis.get(u.chassis) ?? []), u])
  for (const [chassis, same] of byChassis) {
    if (same.length > MAX_SHARED_CHASSIS) problems.push(`${same.length} ${chassis}: no more than ${MAX_SHARED_CHASSIS} units share a chassis.`)
    else if (same.length === 2 && same[0].unitListId === same[1].unitListId && !mayRepeatVariant(same[0])) {
      problems.push(`Two ${same[0].name}: two units of one chassis must be different variants.`)
    }
  }

  if (units.some(isTrailer) && !units.some(u => u.specials.some(s => specialCode(s) === 'HTC'))) {
    problems.push('A trailer or carriage must be deployed hitched to a unit with HTC, and the force has none.')
  }

  if (force.era === null || !force.faction) problems.push('Choose an era and a faction for the force.')

  if (list) {
    const faction = factionIndex(list.factions, force.faction)
    const general = factionIndex(list.factions, force.generalList)
    const unique = factionIndex(list.factions, 'Unique')
    const extinct = factionIndex(list.factions, 'Extinct')
    const uncheckable: string[] = []
    let uniques = 0
    for (const u of units) {
      const entry = list.entries.get(u.unitListId)
      if (!entry?.factions?.length) { uncheckable.push(u.name); continue }
      if (unique >= 0 && entry.factions.some(([f]) => f === unique)) uniques++
      if (force.era === null || faction < 0) continue
      if (extinct >= 0 && availableTo(entry, extinct, force.era)) problems.push(`${u.name} is extinct in the ${ERAS[force.era].name} era.`)
      else if (!availableTo(entry, faction, force.era) && !availableTo(entry, general, force.era)) {
        problems.push(`${u.name} isn't available to ${force.faction}${force.generalList ? ` or the ${force.generalList} list` : ''} in the ${ERAS[force.era].name} era.`)
      }
    }
    if (uniques > 1) problems.push(`${uniques} Unique units: a force may include only one.`)
    if (uncheckable.length) notes.push(`No faction data for ${uncheckable.join(', ')}: check them on the MUL by hand.`)
  }

  if (units.some(u => u.type === 'BM' && u.specials.includes('OMNI'))) {
    notes.push('Inner Sphere OmniMechs sometimes count as their own chassis (two listings on Sarna); the chassis check here goes by name.')
  }
  return { problems, notes }
}

/** Checks a deployment for one scenario: up to 250 PV and 10 units, ProtoMechs as a full Point, trailers hitched. */
export function checkDeployment(force: WnForce, deployment: Pick<WnDeployment, 'unitIds' | 'artilleryIds'>): ForceCheck {
  const problems: string[] = []
  const units = force.units.filter(u => deployment.unitIds.includes(u.id))
  const artillery = force.artillery.filter(a => deployment.artilleryIds.includes(a.id))
  const pv = forcePv(units, artillery)
  if (pv > SCENARIO_PV) problems.push(`${pv} PV is over the ${SCENARIO_PV} PV scenario limit.`)
  if (units.length > MAX_DEPLOYED_UNITS) problems.push(`${units.length} units: no more than ${MAX_DEPLOYED_UNITS} deployed (artillery cards don't count).`)
  const protos = units.filter(u => u.type === 'PM').length
  if (protos > 0 && protos !== PROTOMECH_POINT) problems.push(`${protos} ProtoMechs: they deploy as a full Point of ${PROTOMECH_POINT} or not at all.`)
  if (units.some(isTrailer) && !units.some(u => u.specials.some(s => specialCode(s) === 'HTC'))) {
    problems.push('A deployed trailer or carriage needs a deployed unit with HTC to hitch to.')
  }
  return { problems, notes: [] }
}

/** The deployed units as match units, with their PV at Skill. */
export function matchUnits(force: WnForce, unitIds: string[]): WnMatchUnit[] {
  return force.units.filter(u => unitIds.includes(u.id)).map(u => ({ ...u, pv: unitPv(u) }))
}

/** A match unit as the Alpha Strike card shows it. IndustrialMechs use the 'Mech card; ProtoMechs the infantry one. */
export function cardUnit(unit: WnMatchUnit): Unit {
  return {
    id: unit.id,
    nameAndVariant: unit.name,
    unitType: isAcesType(unit.type) ? ACES_UNIT_TYPES[unit.type] : unit.type === 'IM' ? 'BattleMech' : 'Battle Armor',
    pvAtSkill4: unit.basePv,
    pilotId: null,
    totalSpEarned: 0,
    size: unit.size,
    ene: unit.specials.includes('ENE'),
    tmm: unit.tmm,
    move: Object.entries(unit.move).map(([type, move]) => ({ move, type })),
    armor: unit.armor,
    structure: unit.structure,
    damageText: unit.damage,
    overheat: unit.ov,
    abilities: unit.specials,
    unitListId: unit.unitListId,
    ...(unit.icon ? { iconPath: unit.icon } : {}),
    ...(unit.role ? { role: unit.role } : {}),
  }
}

export interface SideStanding {
  /** PV still on the board: crippled units count half, rounded up. Artillery never remains. */
  remainingPv: number
  /** Deployed unit PV no longer on the board, crippled units counting half. */
  destroyedPv: number
  allDestroyed: boolean
}

/** Where a side stands, from its committed marks. */
export function sideStanding(side: Pick<WnSide, 'units' | 'battle'>): SideStanding {
  let remainingPv = 0
  let total = 0
  let alive = 0
  for (const u of side.units) {
    total += u.pv
    const readout = cardReadout(cardUnit(u), unitBattle(side.battle, u.id).committed, u.skill)
    if (readout.destroyed) continue
    alive++
    remainingPv += readout.crippled ? Math.ceil(u.pv / 2) : u.pv
  }
  return { remainingPv, destroyedPv: total - remainingPv, allDestroyed: side.units.length > 0 && alive === 0 }
}

/** Margin of Victory: the scenario's 250 PV less the opponent's PV still on the board. */
export function marginOfVictory(opponent: Pick<WnSide, 'units' | 'battle'> | null): number {
  return SCENARIO_PV - (opponent ? sideStanding(opponent).remainingPv : 0)
}
