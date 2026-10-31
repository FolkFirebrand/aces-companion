import type { Unit } from '@/lib/types'
import type { UnitListEntry } from './convert'

export interface ChassisCheck {
  problems: string[]
  /** 'Mechs not on the unit list, whose chassis can't be told. */
  unchecked: string[]
}

/** Aces Rulebook: no more than two 'Mechs share a chassis, and those two are different variants. */
export function checkChassisRule(units: Unit[], list: UnitListEntry[]): ChassisCheck {
  const byId = new Map(list.map(e => [e.id, e]))
  const byChassis = new Map<string, Unit[]>()
  const unchecked: string[] = []
  for (const u of units) {
    if (u.unitType !== 'BattleMech') continue
    const entry = u.unitListId ? byId.get(u.unitListId) : undefined
    if (!entry) unchecked.push(u.nameAndVariant)
    else byChassis.set(entry.chassis, [...(byChassis.get(entry.chassis) ?? []), u])
  }
  const problems: string[] = []
  for (const [chassis, mechs] of byChassis) {
    if (mechs.length > 2) problems.push(`${mechs.length} ${chassis} 'Mechs. No more than two may share a chassis.`)
    else if (mechs.length === 2 && mechs[0].unitListId === mechs[1].unitListId) {
      problems.push(`Two ${mechs[0].nameAndVariant}. Two 'Mechs on one chassis must be different variants.`)
    }
  }
  return { problems, unchecked }
}
