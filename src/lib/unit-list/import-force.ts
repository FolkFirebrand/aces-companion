// Uploading a force built elsewhere, e.g. on a PC (#37, #40): MegaMek .mul files (MekBay exports them),
// Unit Builder JSON, or this app's own force file. Units are linked to the unit list where they match.
import { parseUnitBuilderJson } from '@/lib/importUnitBuilder'
import type { Unit } from '@/lib/types'
import { unitFromEntry, unitListName } from './convert'
import type { UnitListEntry } from './convert'

export const FORCE_FILE_FORMAT = 'aces-campaign-log/force'

export type ForceUnit = Omit<Unit, 'id'> & { skill?: number }

export interface ForceImport {
  units: ForceUnit[]
  /** Names of units with no match in the unit list; they come in as custom units. */
  unmatched: string[]
}

export function forceFileContents(units: ForceUnit[], kind: 'player' | 'opposing', now = new Date()): string {
  return JSON.stringify({ format: FORCE_FILE_FORMAT, version: 1, kind, exportedAt: now.toISOString(), units }, null, 2)
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function byChassisAndModel(list: UnitListEntry[], chassis: string, model: string): UnitListEntry | undefined {
  return list.find(e => same(e.chassis, chassis) && same(e.model, model))
}

function byName(list: UnitListEntry[], name: string): UnitListEntry | undefined {
  return list.find(e => same(unitListName(e), name))
}

function customUnit(name: string): Omit<Unit, 'id'> {
  return { nameAndVariant: name, unitType: 'BattleMech', pvAtSkill4: 0, size: 1, ene: false, pilotId: null, totalSpEarned: 0 }
}

// MegaMek .mul: <unit><entity chassis="Atlas" model="AS7-D" …><pilot gunnery="4" …/></entity>…</unit>
function readMul(text: string, list: UnitListEntry[]): ForceImport {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This .mul file could not be read.')
  const result: ForceImport = { units: [], unmatched: [] }
  for (const entity of Array.from(doc.getElementsByTagName('entity'))) {
    const chassis = entity.getAttribute('chassis') ?? ''
    const model = entity.getAttribute('model') ?? ''
    const gunnery = Number(entity.getElementsByTagName('pilot')[0]?.getAttribute('gunnery'))
    const skill = Number.isFinite(gunnery) && gunnery > 0 ? gunnery : undefined
    const entry = byChassisAndModel(list, chassis, model)
    const name = model ? `${chassis} ${model}` : chassis
    if (!entry) result.unmatched.push(name)
    result.units.push({ ...(entry ? unitFromEntry(entry) : customUnit(name)), ...(skill !== undefined ? { skill } : {}) })
  }
  return result
}

/** Reads an uploaded force file; throws with a message to show when it isn't one. */
export function importForce(text: string, list: UnitListEntry[]): ForceImport {
  const trimmed = text.trim()
  if (trimmed.startsWith('<')) return readMul(trimmed, list)

  let json: unknown
  try {
    json = JSON.parse(trimmed)
  } catch {
    throw new Error('This file could not be read. Upload a MegaMek .mul, a Unit Builder file, or a force file from this app.')
  }
  const data = json as { format?: string; units?: ForceUnit[]; members?: unknown[] }

  if (data.format === FORCE_FILE_FORMAT && Array.isArray(data.units)) {
    return { units: data.units, unmatched: data.units.filter(u => !u.unitListId).map(u => u.nameAndVariant) }
  }
  if (Array.isArray(data.members)) {
    const result: ForceImport = { units: [], unmatched: [] }
    for (const parsed of parseUnitBuilderJson(json)) {
      const unit: ForceUnit = { ...parsed }
      delete (unit as Partial<Unit>).id
      const entry = byName(list, unit.nameAndVariant)
      if (!entry) result.unmatched.push(unit.nameAndVariant)
      result.units.push(entry ? { ...unitFromEntry(entry), pvAtSkill4: unit.pvAtSkill4 } : unit)
    }
    return result
  }
  throw new Error('This is not a force file. Upload a MegaMek .mul, a Unit Builder file, or a force file from this app.')
}
