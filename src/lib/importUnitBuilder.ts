import { v4 as uuidv4 } from 'uuid'
import type { Unit, UnitType, UnitMoveEntry, UnitDamage } from './types'

interface UnitBuilderMember {
  name?: string
  type?: string
  basePoints?: number
  currentSkill?: number
  size?: number
  tonnage?: number
  role?: string
  imageURL?: string
  move?: UnitMoveEntry[]
  abilities?: string[]
  overheat?: number
  tmm?: number
  armor?: number
  structure?: number
  damage?: Partial<Record<'short' | 'medium' | 'long' | 'extreme', number>>
}

interface UnitBuilderJson {
  members?: unknown[]
  [key: string]: unknown
}

function mapUnitType(type: string): UnitType {
  if (type === 'BM') return 'BattleMech'
  if (type === 'CI') return 'Conventional Infantry'
  if (type === 'BA') return 'Battle Armor'
  return 'Combat Vehicle'
}

function computePvAtSkill4(basePoints: number, currentSkill: number): number {
  const delta = currentSkill - 4
  const step = Math.floor(basePoints * 0.05)
  return Math.max(1, basePoints - delta * step)
}

function mergeAbilities(abilities: string[]): string[] {
  const result: string[] = []
  let pending = ''
  for (const ability of abilities) {
    const combined = pending ? pending + ability : ability
    const opens = (combined.match(/\(/g) ?? []).length
    const closes = (combined.match(/\)/g) ?? []).length
    if (opens > closes) {
      pending = combined
    } else {
      result.push(combined)
      pending = ''
    }
  }
  if (pending) result.push(pending)
  return result
}

export function parseUnitBuilderJson(raw: unknown): Unit[] {
  const json = raw as UnitBuilderJson
  if (!json || !Array.isArray(json.members)) {
    throw new Error('Invalid unit builder file: expected a "members" array at the top level')
  }

  return json.members.map((item): Unit => {
    const m = item as UnitBuilderMember
    const basePoints = typeof m.basePoints === 'number' ? m.basePoints : 0
    const currentSkill = typeof m.currentSkill === 'number' ? m.currentSkill : 4
    const pvAtSkill4 = computePvAtSkill4(basePoints, currentSkill)

    const damage: UnitDamage | undefined = m.damage
      ? {
          short: m.damage.short ?? 0,
          medium: m.damage.medium ?? 0,
          long: m.damage.long ?? 0,
          extreme: m.damage.extreme ?? 0,
        }
      : undefined

    return {
      id: uuidv4(),
      nameAndVariant: m.name ?? '',
      unitType: mapUnitType(m.type ?? ''),
      pvAtSkill4,
      pilotId: null,
      totalSpEarned: 0,
      imageURL: m.imageURL || undefined,
      tonnage: typeof m.tonnage === 'number' ? m.tonnage : undefined,
      role: m.role || undefined,
      size: typeof m.size === 'number' ? m.size : 1,
      ene: Array.isArray(m.abilities) && m.abilities.some(a => a.trim().toUpperCase() === 'ENE'),
      currentSkill: typeof m.currentSkill === 'number' ? m.currentSkill : undefined,
      move: Array.isArray(m.move) ? m.move : undefined,
      abilities: Array.isArray(m.abilities) ? mergeAbilities(m.abilities) : undefined,
      overheat: typeof m.overheat === 'number' ? m.overheat : undefined,
      tmm: typeof m.tmm === 'number' ? m.tmm : undefined,
      armor: typeof m.armor === 'number' ? m.armor : undefined,
      structure: typeof m.structure === 'number' ? m.structure : undefined,
      damage,
    }
  })
}
