import { checkChassisRule } from '@/lib/unit-list/chassis'
import type { UnitListEntry } from '@/lib/unit-list/convert'
import type { Unit } from '@/lib/types'

function entry(id: string, chassis: string, model: string): UnitListEntry {
  return { id, chassis, model, type: 'BM', pv: 40, size: 3, tmm: 1, move: { '': 8 }, armor: 5, structure: 4, damage: ['3', '3', '1'], ov: 0, specials: [] }
}

const LIST = [entry('AS7D', 'Atlas', 'AS7-D'), entry('AS7K', 'Atlas', 'AS7-K'), entry('AS7S', 'Atlas', 'AS7-S'), entry('GRF1N', 'Griffin', 'GRF-1N')]

let next = 0
function unit(unitListId: string | undefined, nameAndVariant = unitListId ?? 'Homebrew', unitType: Unit['unitType'] = 'BattleMech'): Unit {
  return { id: `u${next++}`, nameAndVariant, unitType, pvAtSkill4: 40, size: 3, ene: false, pilotId: null, totalSpEarned: 0, ...(unitListId ? { unitListId } : {}) }
}

describe('the chassis check', () => {
  it('passes two different variants of one chassis', () => {
    expect(checkChassisRule([unit('AS7D'), unit('AS7K'), unit('GRF1N')], LIST)).toEqual({ problems: [], unchecked: [] })
  })

  it('flags a third Mech on one chassis', () => {
    expect(checkChassisRule([unit('AS7D'), unit('AS7K'), unit('AS7S')], LIST).problems).toEqual(["3 Atlas 'Mechs. No more than two may share a chassis."])
  })

  it('flags two of the same variant', () => {
    expect(checkChassisRule([unit('AS7D', 'Atlas AS7-D'), unit('AS7D', 'Atlas AS7-D')], LIST).problems)
      .toEqual(["Two Atlas AS7-D. Two 'Mechs on one chassis must be different variants."])
  })

  it('ignores units that are not Mechs, and lists Mechs it cannot place', () => {
    const result = checkChassisRule([unit('AS7D', 'Atlas', 'Combat Vehicle'), unit('AS7D', 'Atlas', 'Combat Vehicle'), unit('AS7D', 'Atlas', 'Combat Vehicle'), unit(undefined, 'Laser Boat')], LIST)
    expect(result).toEqual({ problems: [], unchecked: ['Laser Boat'] })
  })
})
