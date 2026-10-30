// The unit list: MegaMek's generated unit catalog trimmed to what Aces uses (ADR 0005).
// Only type imports here: the build script runs this file directly in Node.
import type { Unit, UnitType } from '@/lib/types'

/** Alpha Strike unit types an Aces force may include (Aces Rulebook p. 26). */
export const ACES_UNIT_TYPES = { BM: 'BattleMech', CV: 'Combat Vehicle', BA: 'Battle Armor', CI: 'Conventional Infantry' } as const satisfies Record<string, UnitType>
export type AcesTypeCode = keyof typeof ACES_UNIT_TYPES

/** One unit in the unit list, with its Alpha Strike stats. Damage keeps the card's text, e.g. "0*". */
export interface UnitListEntry {
  id: string
  chassis: string
  model: string
  type: AcesTypeCode
  pv: number
  size: number
  tmm: number
  /** Move in inches by mode; "" is ground move, "j" jump, and so on. */
  move: Record<string, number>
  armor: number
  structure: number
  damage: [short: string, medium: string, long: string]
  ov: number
  specials: string[]
  role?: string
  tons?: number
  /** Present on OMNI units; configurations share their chassis. */
  omni?: true
  /** MegaMek's unit icon: a path under mm-data's data/images/units/ (ADR 0006). */
  icon?: string
  mulId?: number
}

export interface UnitListFile {
  source: string
  license: string
  attribution: string
  catalogVersion: string
  /** The mm-data commit the unit icons are loaded from. */
  iconsCommit: string
  fetchedAt: string
  units: UnitListEntry[]
}

/** The fields of MegaMek's catalog (as published by MekBay) that the unit list reads. */
export interface CatalogUnit {
  name: string
  chassis: string
  model: string
  type: string
  role?: string
  tons?: number
  omni?: number
  mul1id?: number
  icon?: string
  as: {
    TP: string
    PV: number
    SZ: number
    TMM: number
    MVm?: Record<string, number> | null
    Arm: number
    Str: number
    OV?: number
    dmg: { dmgS: string; dmgM: string; dmgL: string }
    specials?: string[]
  }
}

function isAcesUnit(unit: CatalogUnit): boolean {
  // Emplacements share the combat vehicle type code but aren't vehicles.
  return unit.as.TP in ACES_UNIT_TYPES && unit.type !== 'Building Entity' && unit.as.Str > 0
}

/** `iconPaths`, when given, are the icons that exist in mm-data; others are dropped so the placeholder shows. */
export function toUnitListEntry(unit: CatalogUnit, iconPaths?: Set<string>): UnitListEntry {
  const icon = unit.icon && (!iconPaths || iconPaths.has(unit.icon)) ? unit.icon : undefined
  const a = unit.as
  return {
    id: unit.name,
    chassis: unit.chassis,
    model: unit.model,
    type: a.TP as AcesTypeCode,
    pv: a.PV,
    size: a.SZ,
    tmm: a.TMM,
    move: a.MVm ?? {},
    armor: a.Arm,
    structure: a.Str,
    damage: [a.dmg.dmgS, a.dmg.dmgM, a.dmg.dmgL],
    ov: a.OV ?? 0,
    specials: a.specials ?? [],
    ...(unit.role && unit.role !== 'None' ? { role: unit.role } : {}),
    ...(unit.tons ? { tons: unit.tons } : {}),
    ...(unit.omni ? { omni: true as const } : {}),
    ...(icon ? { icon } : {}),
    ...(unit.mul1id ? { mulId: unit.mul1id } : {}),
  }
}

/** Keeps the units an Aces force may include, trimmed to their Alpha Strike stats, sorted by name. */
export function convertCatalog(units: CatalogUnit[], iconPaths?: Set<string>): UnitListEntry[] {
  return units
    .filter(isAcesUnit)
    .map(u => toUnitListEntry(u, iconPaths))
    .sort((a, b) => unitListName(a).localeCompare(unitListName(b)))
}

export function unitListName(entry: Pick<UnitListEntry, 'chassis' | 'model'>): string {
  return entry.model ? `${entry.chassis} ${entry.model}` : entry.chassis
}

/** Every configuration of an OMNI's chassis (including the entry itself), in list order; none for other units. */
export function omniConfigurations(entries: UnitListEntry[], entry: UnitListEntry): UnitListEntry[] {
  if (!entry.omni) return []
  return entries.filter(e => e.omni && e.chassis === entry.chassis && e.type === entry.type)
}

/** The stats a unit takes on when reconfigured to this entry; its pilot, photo and history stay its own. */
export function configurationStats(entry: UnitListEntry): Partial<Unit> {
  const stats: Partial<Unit> = unitFromEntry(entry)
  delete stats.pilotId
  delete stats.totalSpEarned
  return stats
}

export interface UnitListQuery {
  text?: string
  types?: AcesTypeCode[]
  pvMin?: number
  pvMax?: number
  sizes?: number[]
  role?: string
  /** Ground move at least this many inches. */
  minMove?: number
  /** Damage at medium range at least this much (0* counts as 0). */
  minMediumDamage?: number
  limit?: number
}

/** The roles in the unit list, for the role filter. */
export function unitListRoles(entries: UnitListEntry[]): string[] {
  return [...new Set(entries.flatMap(e => (e.role ? [e.role] : [])))].sort()
}

/** Every word of the search must appear in the unit's name, and every filter set must match; results keep the list's order. */
export function searchUnitList(entries: UnitListEntry[], query: UnitListQuery): UnitListEntry[] {
  const { text = '', types, pvMin, pvMax, sizes, role, minMove, minMediumDamage, limit = 50 } = query
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  const results: UnitListEntry[] = []
  for (const entry of entries) {
    if (types?.length && !types.includes(entry.type)) continue
    if (pvMin !== undefined && entry.pv < pvMin) continue
    if (pvMax !== undefined && entry.pv > pvMax) continue
    if (sizes?.length && !sizes.includes(entry.size)) continue
    if (role && entry.role !== role) continue
    if (minMove !== undefined && (Object.values(entry.move)[0] ?? 0) < minMove) continue
    if (minMediumDamage !== undefined && (parseInt(entry.damage[1], 10) || 0) < minMediumDamage) continue
    const name = unitListName(entry).toLowerCase()
    if (!words.every(w => name.includes(w))) continue
    results.push(entry)
    if (results.length >= limit) break
  }
  return results
}

// "0*" is minimal damage; the Unit's damage numbers record it as 0.
function damageNumber(text: string): number {
  const n = parseInt(text, 10)
  return Number.isFinite(n) ? n : 0
}

/** A Unit for the Player Force, filled in from a unit-list entry. */
export function unitFromEntry(entry: UnitListEntry): Omit<Unit, 'id'> {
  return {
    nameAndVariant: unitListName(entry),
    unitType: ACES_UNIT_TYPES[entry.type],
    pvAtSkill4: entry.pv,
    size: entry.size,
    ene: entry.specials.includes('ENE'),
    pilotId: null,
    totalSpEarned: 0,
    unitListId: entry.id,
    ...(entry.icon ? { iconPath: entry.icon } : {}),
    ...(entry.role ? { role: entry.role } : {}),
    ...(entry.tons ? { tonnage: entry.tons } : {}),
    tmm: entry.tmm,
    move: Object.entries(entry.move).map(([type, move]) => ({ move, type })),
    armor: entry.armor,
    structure: entry.structure,
    damage: { short: damageNumber(entry.damage[0]), medium: damageNumber(entry.damage[1]), long: damageNumber(entry.damage[2]), extreme: 0 },
    damageText: entry.damage,
    overheat: entry.ov,
    abilities: entry.specials,
  }
}
