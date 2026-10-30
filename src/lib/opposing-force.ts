// A sortie's Opposing Force (v2, #40): enemy units with their stats, numbered when there are copies.
import type { OpposingUnit, Unit } from './types'

export const DEFAULT_OPPOSING_SKILL = 4

export type OpposingTemplate = Omit<OpposingUnit, 'id' | 'nameAndVariant'>

/** An enemy unit's template from a unit's stats (picked from the list, custom or uploaded). */
export function opposingTemplate(unit: Omit<Unit, 'id'>, skill = DEFAULT_OPPOSING_SKILL): OpposingTemplate {
  const stats: Partial<Unit> = { ...unit }
  delete stats.pilotId
  delete stats.totalSpEarned
  delete stats.photoUrl
  delete stats.nameAndVariant
  return { ...(stats as Omit<OpposingTemplate, 'baseName' | 'skill'>), baseName: unit.nameAndVariant, skill }
}

/**
 * Adds `count` copies of a unit. Copies are numbered from 1 ("Hunchback HBK-4G 1", "… 2"); a lone unit keeps
 * its plain name, and is numbered 1 when a second copy joins it.
 */
export function addCopies(existing: OpposingUnit[], template: OpposingTemplate, count: number, newId: () => string): OpposingUnit[] {
  if (count < 1) return existing
  const base = template.baseName
  const same = existing.filter(u => u.baseName === base)
  const numbered = same.length + count > 1
  const next = existing.map(u => (numbered && same.length === 1 && u.id === same[0].id && u.nameAndVariant === base ? { ...u, nameAndVariant: `${base} 1` } : u))
  const added = Array.from({ length: count }, (_, i) => ({
    ...template, id: newId(), nameAndVariant: numbered ? `${base} ${same.length + i + 1}` : base,
  }))
  return [...next, ...added]
}

export function opposingForcePv(units: OpposingUnit[]): number {
  return units.reduce((sum, u) => sum + u.pvAtSkill4, 0)
}
