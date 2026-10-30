// The unit list: MegaMek's generated unit catalog trimmed to what Aces uses (ADR 0005).
// Only type imports here: the build script runs this file directly in Node.
import type { Unit, UnitType } from '@/lib/types'

/** Alpha Strike unit types an Aces force may include (Aces Rulebook p. 26). */
export const ACES_UNIT_TYPES = { BM: 'BattleMech', CV: 'Combat Vehicle', BA: 'Battle Armor', CI: 'Conventional Infantry' } as const satisfies Record<string, UnitType>
export type AcesTypeCode = keyof typeof ACES_UNIT_TYPES

/** BattleTech eras, named and dated as on Sarna (https://www.sarna.net/wiki/BattleTech_eras). */
export const ERAS = [
  { name: 'Age of War', from: 2005, to: 2570 },
  { name: 'Star League', from: 2571, to: 2780 },
  { name: 'Early Succession War', from: 2781, to: 2900 },
  { name: 'Late Succession War - LosTech', from: 2901, to: 3019 },
  { name: 'Late Succession War - Renaissance', from: 3020, to: 3049 },
  { name: 'Clan Invasion', from: 3050, to: 3061 },
  { name: 'Civil War', from: 3062, to: 3067 },
  { name: 'Jihad', from: 3068, to: 3080 },
  { name: 'Republic Age', from: 3081, to: 3130 },
  { name: 'Dark Age', from: 3131, to: 3150 },
  { name: 'ilClan', from: 3151, to: undefined },
] as const

// MekBay's era ids, as indexes into ERAS. MekBay splits the Republic Age into Early (15) and Late (254).
const MEKBAY_ERAS: Record<string, number> = { 9: 0, 10: 1, 11: 2, 255: 3, 256: 4, 13: 5, 247: 6, 14: 7, 15: 8, 254: 8, 16: 9, 257: 10 }

/** A faction a unit can be available to (ADR 0008). */
export interface UnitListFaction {
  name: string
  group: string
}

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
  /** Factions the unit is available to: each pair is an index into the file's factions and a bitmask of ERAS indexes. */
  factions?: [faction: number, eras: number][]
}

export interface UnitListFile {
  source: string
  license: string
  attribution: string
  catalogVersion: string
  /** The mm-data commit the unit icons are loaded from. */
  iconsCommit: string
  fetchedAt: string
  factionsSource: string
  /** The version of MekBay's faction file the availability comes from (ADR 0008). */
  factionsVersion: string
  factions: UnitListFaction[]
  units: UnitListEntry[]
}

/** MekBay's faction file: each faction's units, by MUL id, per MekBay era id (ADR 0008). */
export interface FactionCatalog {
  version: number
  factions: { id: number; name: string; group: string; eras: Record<string, number[]> }[]
}

/** The factions in the unit list, sorted by group then name; unit entries index into this order. */
export function unitListFactions(catalog: FactionCatalog): UnitListFaction[] {
  return sortedFactions(catalog).map(({ name, group }) => ({ name, group }))
}

function sortedFactions(catalog: FactionCatalog): FactionCatalog['factions'] {
  return [...catalog.factions].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
}

/** Each MUL id's factions and the eras it is available to them, as stored on unit entries. */
function availabilityByMulId(catalog: FactionCatalog): Map<number, [number, number][]> {
  const byMulId = new Map<number, Map<number, number>>()
  sortedFactions(catalog).forEach((faction, index) => {
    for (const [eraId, mulIds] of Object.entries(faction.eras)) {
      const era = MEKBAY_ERAS[eraId]
      if (era === undefined) continue
      for (const mulId of mulIds) {
        const masks = byMulId.get(mulId) ?? new Map<number, number>()
        masks.set(index, (masks.get(index) ?? 0) | (1 << era))
        byMulId.set(mulId, masks)
      }
    }
  })
  return new Map([...byMulId].map(([mulId, masks]) => [mulId, [...masks].sort((a, b) => a[0] - b[0])]))
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

/** Keeps the units an Aces force may include, trimmed to their Alpha Strike stats, sorted by name. `factions` adds availability. */
export function convertCatalog(units: CatalogUnit[], iconPaths?: Set<string>, factions?: FactionCatalog): UnitListEntry[] {
  const availability = factions ? availabilityByMulId(factions) : new Map<number, [number, number][]>()
  return units
    .filter(isAcesUnit)
    .map(u => toUnitListEntry(u, iconPaths))
    .map(e => {
      const available = e.mulId ? availability.get(e.mulId) : undefined
      return available ? { ...e, factions: available } : e
    })
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
  /** Damage at least this much (0* counts as 0) at every range in `damageRanges`, or at every range if none are given. */
  minDamage?: number
  /** Ranges the damage filter checks: 0 short, 1 medium, 2 long. */
  damageRanges?: number[]
  /** Available to any of these factions (indexes into the file's factions), in `era` if one is given. */
  factions?: number[]
  /** Available in this era (an index into ERAS), to any of `factions` if some are given. */
  era?: number
  limit?: number
}

/** The roles in the unit list, for the role filter. */
export function unitListRoles(entries: UnitListEntry[]): string[] {
  return [...new Set(entries.flatMap(e => (e.role ? [e.role] : [])))].sort()
}

/** Every word of the search must appear in the unit's name, and every filter set must match; results keep the list's order. */
export function searchUnitList(entries: UnitListEntry[], query: UnitListQuery): UnitListEntry[] {
  const { text = '', types, pvMin, pvMax, sizes, role, minMove, minDamage, damageRanges, factions, era, limit = 50 } = query
  const ranges = damageRanges?.length ? damageRanges : [0, 1, 2]
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  const results: UnitListEntry[] = []
  for (const entry of entries) {
    if (types?.length && !types.includes(entry.type)) continue
    if (pvMin !== undefined && entry.pv < pvMin) continue
    if (pvMax !== undefined && entry.pv > pvMax) continue
    if (sizes?.length && !sizes.includes(entry.size)) continue
    if (role && entry.role !== role) continue
    if (minMove !== undefined && (Object.values(entry.move)[0] ?? 0) < minMove) continue
    if (minDamage !== undefined && ranges.some(r => damageNumber(entry.damage[r]) < minDamage)) continue
    if ((factions?.length || era !== undefined) && !isAvailable(entry, factions, era)) continue
    const name = unitListName(entry).toLowerCase()
    if (!words.every(w => name.includes(w))) continue
    results.push(entry)
    if (results.length >= limit) break
  }
  return results
}

function isAvailable(entry: UnitListEntry, factions: number[] | undefined, era: number | undefined): boolean {
  return !!entry.factions?.some(([faction, eras]) =>
    (!factions?.length || factions.includes(faction)) && (era === undefined || (eras & (1 << era)) !== 0))
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
