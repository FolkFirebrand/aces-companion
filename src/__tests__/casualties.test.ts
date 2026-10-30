import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import {
  selectCompletionBlockers, selectCrewOutcome, selectPersonnelCost, selectRepairCost, selectTrulyDestroyed,
} from '@/store/selectors'
import { salvageTarget } from '@/lib/rules'
import { ALL_STEP_IDS } from '@/lib/steps'
import { UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import type { FieldedUnit, NamedPilot, Sortie, Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function sortie(id: string): Sortie {
  return store().campaign.sorties.find(s => s.id === id)!
}

function unit(id: string, overrides: Partial<Unit> = {}): Unit {
  return { id, nameAndVariant: id, unitType: 'BattleMech', pvAtSkill4: 30, size: 3, ene: false, pilotId: null, totalSpEarned: 0, ...overrides }
}

function pilot(id: string, overrides: Partial<NamedPilot> = {}): NamedPilot {
  return {
    id, callsign: id, pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: 150,
    spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0, edgeAbilitiesLearned: [], campaignHistory: [], ...overrides,
  }
}

let sortieId = ''

// The mockup's sortie: Stalker armor, Ironjaw structure, Hauler crippled, Brute destroyed and
// salvaged (Rook wounded), Spotter truly destroyed by an ammo critical (crew killed).
beforeEach(() => {
  store().resetStore()
  act(() => {
    store().addPilot(pilot('ghost'))
    store().addPilot(pilot('rook'))
    store().addUnit(unit('stalker', { pilotId: 'ghost' }))
    store().addUnit(unit('ironjaw'))
    store().addUnit(unit('hauler', { unitType: 'Combat Vehicle', size: 1, ene: true }))
    store().addUnit(unit('brute', { size: 4, pilotId: 'rook' }))
    store().addUnit(unit('spotter', { size: 1 }))
    sortieId = store().addSortie()
    for (const id of ['stalker', 'ironjaw', 'hauler', 'brute', 'spotter']) store().setFielded(sortieId, id, true)
  })
})

function damage(unitId: string, partial: Partial<FieldedUnit>) {
  act(() => store().updateFieldedUnit(sortieId, unitId, partial))
}

function fielded(unitId: string): FieldedUnit {
  return sortie(sortieId).fieldedUnits.find(f => f.unitId === unitId)!
}

function playTheMockup() {
  damage('stalker', { damage: 'armor' })
  damage('ironjaw', { damage: 'structure' })
  damage('hauler', { damage: 'crippled' })
  damage('brute', { damage: 'destroyed', salvageRoll: 7, crewMode: 'roll', crewRoll: 5 })
  damage('spotter', { damage: 'destroyed', autoTrulyDestroyed: 'ammo', crewMode: 'roll', crewRoll: 2 })
}

function complete() {
  act(() => {
    ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true))
    store().completeSortie(sortieId)
  })
}

describe('Salvage Checks', () => {
  it('need 4+ for BattleMechs, 6+ for vehicles, 8+ for battle armor and 10+ for infantry', () => {
    expect(['BattleMech', 'Combat Vehicle', 'Battle Armor', 'Conventional Infantry'].map(t => salvageTarget(t as Unit['unitType'])))
      .toEqual([4, 6, 8, 10])
  })

  it('save a destroyed unit that meets the target, and lose one that misses it', () => {
    damage('brute', { damage: 'destroyed', salvageRoll: 4 })
    damage('spotter', { damage: 'destroyed', salvageRoll: 3 })

    expect(selectTrulyDestroyed(fielded('brute'))).toBe(false)
    expect(selectTrulyDestroyed(fielded('spotter'))).toBe(true)
  })

  it('are skipped when a unit is truly destroyed automatically', () => {
    damage('brute', { damage: 'destroyed', autoTrulyDestroyed: 'emplacement', salvageRoll: 12 })

    expect(selectTrulyDestroyed(fielded('brute'))).toBe(true)
  })

  it('leave the result open until rolled', () => {
    damage('brute', { damage: 'destroyed' })

    expect(selectTrulyDestroyed(fielded('brute'))).toBeNull()
  })
})

describe('Crew Checks', () => {
  it.each([
    [2, 'killed'], [3, 'killed'], [4, 'wounded'], [6, 'wounded'], [7, 'unscathed'], [12, 'unscathed'],
  ] as const)('a roll of %i means %s', (crewRoll, outcome) => {
    damage('brute', { damage: 'destroyed', salvageRoll: 9, crewMode: 'roll', crewRoll })

    expect(selectCrewOutcome(fielded('brute'))).toBe(outcome)
  })

  it('wound the crew on a Crew Stunned critical and kill them on Crew Killed or Unit Destroyed, without rolling', () => {
    damage('brute', { damage: 'destroyed', salvageRoll: 9, crewMode: 'stunned' })
    expect(selectCrewOutcome(fielded('brute'))).toBe('wounded')

    damage('brute', { crewMode: 'killed' })
    expect(selectCrewOutcome(fielded('brute'))).toBe('killed')
  })

  it('only apply to destroyed units', () => {
    damage('stalker', { damage: 'crippled', crewMode: 'killed' })

    expect(selectCrewOutcome(fielded('stalker'))).toBe('unscathed')
  })
})

describe('repair and personnel costs', () => {
  it('reproduce the mockup: repairs 610 SP, personnel 200 SP', () => {
    playTheMockup()

    // armor 3×20 + structure 3×40 + vehicle ½×60 + salvaged 4×100; truly destroyed costs nothing
    expect(selectRepairCost(sortie(sortieId))).toBe(60 + 120 + 30 + 400)
    // Rook wounded (100) + Spotter's generic crew killed (100)
    expect(selectPersonnelCost(sortie(sortieId))).toBe(200)
  })

  it('count non-’Mech units at half Size without rounding', () => {
    damage('hauler', { damage: 'armor' })

    expect(selectRepairCost(sortie(sortieId))).toBe(10)
  })

  it('charge nothing for a Named Pilot killed in action (hiring a replacement is separate)', () => {
    damage('brute', { damage: 'destroyed', salvageRoll: 9, crewMode: 'killed' })

    expect(selectPersonnelCost(sortie(sortieId))).toBe(0)
  })
})

describe('completing the sortie', () => {
  it('moves truly destroyed units to the Memorial', () => {
    playTheMockup()
    complete()

    expect(store().campaign.units.map(u => u.id)).toEqual(['stalker', 'ironjaw', 'hauler', 'brute'])
    expect(store().campaign.memorial).toEqual([
      expect.objectContaining({ name: 'spotter', type: 'unit', reason: 'trulyDestroyed', sortieId }),
    ])
  })

  it('marks wounded Named Pilots, who stay on their salvaged unit', () => {
    playTheMockup()
    complete()

    expect(store().campaign.namedPilots.find(p => p.id === 'rook')?.wounded).toBe(true)
    expect(store().campaign.units.find(u => u.id === 'brute')?.pilotId).toBe('rook')
  })

  it('moves a Named Pilot killed in action to the Memorial and out of the force', () => {
    damage('brute', { damage: 'destroyed', salvageRoll: 9, crewMode: 'killed' })
    complete()

    expect(store().campaign.namedPilots.map(p => p.id)).toEqual(['ghost'])
    expect(store().campaign.units.find(u => u.id === 'brute')?.pilotId).toBeNull()
    expect(store().campaign.memorial).toEqual([
      expect.objectContaining({ name: 'rook', type: 'pilot', reason: 'killedInAction', sortieId }),
    ])
  })

  it('benches a surviving pilot whose unit was truly destroyed', () => {
    damage('brute', { damage: 'destroyed', salvageRoll: 2, crewMode: 'roll', crewRoll: 9 })
    complete()

    expect(store().campaign.units.some(u => u.id === 'brute')).toBe(false)
    expect(store().campaign.namedPilots.find(p => p.id === 'rook')).toMatchObject({ wounded: false })
  })

  it('heals Wounded pilots once the next sortie is completed', () => {
    playTheMockup()
    complete()
    act(() => { sortieId = store().addSortie() })
    complete()

    expect(store().campaign.namedPilots.find(p => p.id === 'rook')?.wounded).toBe(false)
  })

  it('is blocked until each destroyed unit has its salvage and crew results', () => {
    act(() => ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true)))
    damage('brute', { damage: 'destroyed' })

    expect(selectCompletionBlockers(sortie(sortieId))).toEqual([
      'Check for Casualties: salvage roll for brute',
      'Check for Casualties: crew roll for brute',
    ])
  })

  it('applies nothing for a Failed Sortie', () => {
    playTheMockup()
    act(() => store().updateSortie(sortieId, { outcome: 'failed' }))
    const before = store().campaign
    complete()

    expect(store().campaign.units).toEqual(before.units)
    expect(store().campaign.namedPilots).toEqual(before.namedPilots)
    expect(store().campaign.memorial).toEqual([])
  })
})

describe('reopening the sortie', () => {
  it('reverts the roster, pilots and Memorial exactly', () => {
    const units = store().campaign.units
    const pilots = store().campaign.namedPilots
    playTheMockup()
    damage('stalker', { damage: 'destroyed', salvageRoll: 8, crewMode: 'killed' })
    complete()

    act(() => store().reopenSortie(sortieId))

    expect(store().campaign.units).toEqual(units)
    expect(store().campaign.namedPilots).toEqual(pilots)
    expect(store().campaign.memorial).toEqual([])
  })

  it('makes healed pilots Wounded again', () => {
    playTheMockup()
    complete()
    act(() => { sortieId = store().addSortie() })
    complete()

    act(() => store().reopenSortie(sortieId))

    expect(store().campaign.namedPilots.find(p => p.id === 'rook')?.wounded).toBe(true)
  })
})

describe('the Memorial', () => {
  it('takes an entry by hand even when empty, and lets it be edited and removed', () => {
    let id = ''
    act(() => { id = store().addMemorialEntry({ name: 'Old Reliable', type: 'unit', note: 'an earlier campaign' }) })
    act(() => store().updateMemorialEntry(id, { name: 'Old Reliable II' }))

    expect(store().campaign.memorial).toEqual([
      { id, name: 'Old Reliable II', type: 'unit', reason: 'manual', note: 'an earlier campaign' },
    ])

    act(() => store().removeFromMemorial(id))
    expect(store().campaign.memorial).toEqual([])
  })
})

describe('upgrading version 7 saves', () => {
  it('keeps old typed-in repairs and crew counts, and gives Memorial entries a reason', () => {
    const v7 = {
      campaign: {
        id: 'c1', units: [], namedPilots: [],
        memorial: [{ id: 'm1', name: 'Lost', type: 'unit' }],
        sorties: [{
          id: 's1', repairs: [{ id: 'r', unitId: 'x', size: 2, tier: 'crippled' }], woundedOrKilledCrew: 1,
          fieldedUnits: [{ unitId: 'u1', nameAndVariant: 'A', unitType: 'BattleMech', pvAtSkill4: 30, size: 2, ene: false, pilotId: null }],
        }],
      },
    }

    const { campaign } = runUpgrades(v7, 7, 8, UPGRADE_STEPS)

    expect(campaign.memorial).toEqual([{ id: 'm1', name: 'Lost', type: 'unit', reason: 'manual' }])
    expect(campaign.sorties).toEqual([{
      id: 's1', legacyRepairs: [{ id: 'r', unitId: 'x', size: 2, tier: 'crippled' }], legacyWoundedOrKilledCrew: 1,
      fieldedUnits: [{
        unitId: 'u1', nameAndVariant: 'A', unitType: 'BattleMech', pvAtSkill4: 30, size: 2, ene: false, pilotId: null,
        damage: 'undamaged', autoTrulyDestroyed: null, salvageRoll: null, crewMode: 'roll', crewRoll: null,
      }],
    }])
  })
})
