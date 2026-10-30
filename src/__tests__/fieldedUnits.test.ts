import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import {
  selectFieldedPv, selectParticipatingPilotIds, selectRearmingUnits, selectTotalExpenses,
} from '@/store/selectors'
import { UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import { parseUnitBuilderJson } from '@/lib/importUnitBuilder'
import type { NamedPilot, Sortie, Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function sortie(id: string): Sortie {
  return store().campaign.sorties.find(s => s.id === id)!
}

function unit(id: string, overrides: Partial<Unit> = {}): Unit {
  return { id, nameAndVariant: `Unit ${id}`, unitType: 'BattleMech', pvAtSkill4: 30, size: 2, ene: false, pilotId: null, totalSpEarned: 0, ...overrides }
}

function pilot(id: string, overrides: Partial<NamedPilot> = {}): NamedPilot {
  return {
    id, callsign: id, pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: 150,
    spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0, edgeAbilitiesLearned: [], campaignHistory: [], ...overrides,
  }
}

let sortieId = ''

beforeEach(() => {
  store().resetStore()
  act(() => {
    store().addPilot(pilot('ghost'))
    store().addPilot(pilot('rook'))
    store().addPilot(pilot('vesper', { wounded: true }))
    store().addUnit(unit('stalker', { pvAtSkill4: 40, pilotId: 'ghost' }))
    store().addUnit(unit('talon', { pvAtSkill4: 44, pilotId: 'rook' }))
    store().addUnit(unit('hauler', { pvAtSkill4: 18, unitType: 'Combat Vehicle', size: 1, ene: true }))
    store().addUnit(unit('brute', { pvAtSkill4: 52, pilotId: 'vesper' }))
    sortieId = store().addSortie()
  })
})

function field(unitId: string, fielded = true) {
  act(() => store().setFielded(sortieId, unitId, fielded))
}

function pilotOn(unitId: string): string | null | undefined {
  return sortie(sortieId).fieldedUnits.find(f => f.unitId === unitId)?.pilotId
}

describe('fielding units', () => {
  it('adds up the Fielded Units\' PV', () => {
    field('stalker')
    field('hauler')

    expect(selectFieldedPv(sortie(sortieId))).toBe(58)
  })

  it('lets the player go over the PV Limit (the screen warns, it doesn\'t block)', () => {
    act(() => store().updateSortie(sortieId, { listedPv: 50 }))
    field('stalker')
    field('talon')

    expect(selectFieldedPv(sortie(sortieId))).toBe(84)
  })

  it('uses an OMNI unit\'s new PV once it is reconfigured for this sortie', () => {
    field('stalker')
    act(() => store().reconfigureOmni(sortieId, 'stalker', 'Stalker B', 26))

    expect(selectFieldedPv(sortie(sortieId))).toBe(26)
  })

  it('removes a unit when it is unticked', () => {
    field('stalker')
    field('stalker', false)

    expect(sortie(sortieId).fieldedUnits).toEqual([])
  })
})

describe('pilots', () => {
  it('start on the unit the roster gives them', () => {
    field('stalker')

    expect(pilotOn('stalker')).toBe('ghost')
  })

  it('move to another fielded unit in one pick, leaving their old one with a generic crew', () => {
    field('stalker')
    field('hauler')

    act(() => store().assignFieldedPilot(sortieId, 'hauler', 'ghost'))

    expect(pilotOn('hauler')).toBe('ghost')
    expect(pilotOn('stalker')).toBeNull()
  })

  it('can be moved off a roster unit that isn\'t fielded', () => {
    field('stalker')

    act(() => store().assignFieldedPilot(sortieId, 'stalker', 'rook'))

    expect(pilotOn('stalker')).toBe('rook')
  })

  it('cannot be fielded while Wounded', () => {
    field('brute')
    expect(pilotOn('brute')).toBeNull()

    act(() => store().assignFieldedPilot(sortieId, 'brute', 'vesper'))
    expect(pilotOn('brute')).toBeNull()
  })

  it('who are assigned to a Fielded Unit have Participated', () => {
    field('stalker')
    field('hauler')

    expect(selectParticipatingPilotIds(sortie(sortieId))).toEqual(['ghost'])
  })
})

describe('the Force Commander', () => {
  it('is one of the Named Pilots fielded', () => {
    field('stalker')

    act(() => store().setForceCommander(sortieId, 'rook'))
    expect(sortie(sortieId).forceCommanderPilotId).toBeNull()

    act(() => store().setForceCommander(sortieId, 'ghost'))
    expect(sortie(sortieId).forceCommanderPilotId).toBe('ghost')
  })

  it('is cleared when that pilot no longer takes part', () => {
    field('stalker')
    act(() => store().setForceCommander(sortieId, 'ghost'))

    field('stalker', false)

    expect(sortie(sortieId).forceCommanderPilotId).toBeNull()
  })
})

describe('rearming', () => {
  it('counts Fielded Units without ENE at 20 SP each', () => {
    field('stalker')
    field('talon')
    field('hauler')

    expect(selectRearmingUnits(sortie(sortieId))).toBe(2)
    expect(selectTotalExpenses(sortie(sortieId))).toBe(40)
  })

  it('stays fixed once the sortie is played, even if a unit later leaves the roster', () => {
    field('stalker')
    act(() => store().removeUnit('stalker'))

    expect(selectRearmingUnits(sortie(sortieId))).toBe(1)
  })
})

describe('units', () => {
  it('import battle armor as battle armor, and read ENE from the abilities', () => {
    const [ba, mech] = parseUnitBuilderJson({
      members: [
        { name: 'Elemental', type: 'BA', basePoints: 18, size: 1, abilities: ['CAR5', 'MEC'] },
        { name: 'Laser Boat', type: 'BM', basePoints: 30, size: 2, abilities: ['ENE', 'REAR1/1/-'] },
      ],
    })

    expect(ba).toMatchObject({ unitType: 'Battle Armor', ene: false, size: 1 })
    expect(mech).toMatchObject({ unitType: 'BattleMech', ene: true, size: 2 })
  })
})

describe('upgrading version 6 saves', () => {
  it('gives units an ENE flag and a Size, and keeps typed-in rearming counts on old sorties', () => {
    const v6 = {
      campaign: {
        id: 'c1', namedPilots: [], memorial: [],
        units: [
          { id: 'u1', nameAndVariant: 'A', inDropDeck: true, abilities: ['ENE'], size: 3 },
          { id: 'u2', nameAndVariant: 'B', inDropDeck: false },
        ],
        sorties: [{ id: 's1', unitsWithoutENE: 4 }],
      },
    }

    const { campaign } = runUpgrades(v6, 6, 7, UPGRADE_STEPS)

    expect(campaign.units).toEqual([
      { id: 'u1', nameAndVariant: 'A', abilities: ['ENE'], size: 3, ene: true },
      { id: 'u2', nameAndVariant: 'B', size: 1, ene: false },
    ])
    expect(campaign.sorties).toEqual([{ id: 's1', fieldedUnits: [], forceCommanderPilotId: null, legacyUnitsWithoutENE: 4 }])
  })
})
