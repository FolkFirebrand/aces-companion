import { act } from '@testing-library/react'
import { v4 as uuidv4 } from 'uuid'
import { useCampaignStore } from '@/store/campaign'
import { selectCampaignLog, selectWarchestBalance } from '@/store/selectors'
import { UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import type { FieldedUnit, Sortie } from '@/lib/types'
import { logCompletedSortie } from './helpers'

function store() {
  return useCampaignStore.getState()
}

function logSortie(fields: Partial<Sortie>, beforeComplete?: (id: string) => void): string {
  return logCompletedSortie(fields, beforeComplete)
}

function buy(sortieId: string, pvAtSkill4: number) {
  store().buyUnit(sortieId, {
    id: uuidv4(), nameAndVariant: 'Unit', unitType: 'BattleMech', pvAtSkill4, pilotId: null, size: 2, ene: false, totalSpEarned: 0,
  })
}

// After-Sortie Steps Example, Aces Rulebook p. 36–37: income 1,200 + 600 at Standard; expenses 940:
// recon 100; rearming 5 units × 20; two crews wounded × 100; repairs by Size — destroyed 2
// (a Size 1 'Mech and a Size 2 vehicle at half), crippled 3, structure 2, armor 4.
function fieldedUnit(id: string, overrides: Partial<FieldedUnit>): FieldedUnit {
  return {
    unitId: id, nameAndVariant: id, unitType: 'BattleMech', pvAtSkill4: 30, size: 1, ene: false, pilotId: null,
    damage: 'undamaged', autoTrulyDestroyed: null, salvageRoll: null, crewMode: 'roll', crewRoll: null, ...overrides,
  }
}

const RULEBOOK_EXAMPLE: Partial<Sortie> = {
  primaryObjective: 1200,
  otherObjectives: 600,
  reconnaissanceCost: 100,
  waypointsSP: 0, waypointsGainedSP: 0,
  legacyNewReplacementPilots: 0, hires: [],
  fieldedUnits: [
    fieldedUnit('mech', { size: 1, damage: 'destroyed', salvageRoll: 9, crewRoll: 5 }),
    fieldedUnit('vehicle', { unitType: 'Combat Vehicle', size: 2, damage: 'destroyed', salvageRoll: 8, crewRoll: 4 }),
    fieldedUnit('crippled', { size: 3, damage: 'crippled' }),
    fieldedUnit('structure', { size: 2, damage: 'structure' }),
    fieldedUnit('armor', { size: 4, damage: 'armor' }),
  ],
  legacyNamedPilotSp: 280,
}

beforeEach(() => {
  store().resetStore()
})

describe('Warchest', () => {
  it('starts at the Starting Warchest Balance of 400 SP', () => {
    expect(store().campaign.startingWarchest).toBe(400)
    expect(selectWarchestBalance(store().campaign)).toBe(400)
  })

  it('reproduces the rulebook example: 400 + 860 − 280 − 0 = 980', () => {
    logSortie(RULEBOOK_EXAMPLE)

    const [row] = selectCampaignLog(store().campaign)

    expect(row.earnings).toBe(860)
    expect(row.namedPilotSp).toBe(280)
    expect(row.purchases).toBe(0)
    expect(row.warchest).toBe(980)
    expect(selectWarchestBalance(store().campaign)).toBe(980)
  })

  it('subtracts Purchases', () => {
    logSortie({ primaryObjective: 500 }, id => {
      buy(id, 5)
      buy(id, 3)
    })

    const [row] = selectCampaignLog(store().campaign)

    expect(row.purchases).toBe(320)
    expect(row.warchest).toBe(400 + 500 - 320)
  })

  it('carries the balance from row to row', () => {
    act(() => store().updateCampaignMeta({ startingWarchest: 600 }))
    logSortie({ primaryObjective: 300, legacyNamedPilotSp: 100 })
    logSortie({ primaryObjective: 200, legacyNamedPilotSp: 50 })

    const rows = selectCampaignLog(store().campaign)

    expect(rows.map(r => r.warchest)).toEqual([800, 950])
  })

  it('can go negative when a sortie loses money', () => {
    logSortie({ primaryObjective: 0, reconnaissanceCost: 500 })

    expect(selectWarchestBalance(store().campaign)).toBe(-100)
  })
})

describe('Failed Sorties', () => {
  it('stay in the log but change nothing', () => {
    logSortie({ primaryObjective: 300, legacyNamedPilotSp: 100 })
    logSortie({ ...RULEBOOK_EXAMPLE, outcome: 'failed' }, id => buy(id, 10))

    const rows = selectCampaignLog(store().campaign)

    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ counts: false, earnings: 0, namedPilotSp: 0, purchases: 0, warchest: 600 })
    expect(selectWarchestBalance(store().campaign)).toBe(600)
  })

  it('are recorded as Victory by default', () => {
    logSortie({})

    expect(store().campaign.sorties[0].outcome).toBe('victory')
  })
})

describe('Sortie Number and play order', () => {
  it('suggests the next Sortie Number for a new sortie', () => {
    logSortie({})
    logSortie({})

    expect(store().campaign.sorties.map(s => s.sortieNumber)).toEqual(['01', '02'])
  })

  it('lets a replayed sortie share its Sortie Number while play order stays distinct', () => {
    logSortie({ sortieNumber: '03', outcome: 'failed' })
    logSortie({ sortieNumber: '03' })

    const rows = selectCampaignLog(store().campaign)

    expect(rows.map(r => r.sortie.sortieNumber)).toEqual(['03', '03'])
    expect(rows.map(r => r.playOrder)).toEqual([1, 2])
  })
})

describe('upgrading version 2 saves', () => {
  // Version 2's "Win?" box defaulted to unticked and never affected the money, so every
  // old sortie becomes a Victory: mapping unticked to Failed would wipe real Earnings.
  it('turns numbered sorties into Sortie Numbers, marks them Victory, and adds the starting balance', () => {
    const v2 = {
      campaign: {
        id: 'c1', name: 'Ravens', units: [], namedPilots: [], memorial: [],
        sorties: [
          { id: 's1', number: 3, won: false, name: 'Cold Iron' },
          { id: 's2', number: 12, won: true, name: 'Cold Iron' },
        ],
      },
    }

    const upgraded = runUpgrades(v2, 2, 3, UPGRADE_STEPS)
    const campaign = upgraded.campaign as { startingWarchest: number; sorties: Record<string, unknown>[] }

    expect(campaign.startingWarchest).toBe(400)
    expect(campaign.sorties).toEqual([
      { id: 's1', sortieNumber: '03', outcome: 'victory', name: 'Cold Iron' },
      { id: 's2', sortieNumber: '12', outcome: 'victory', name: 'Cold Iron' },
    ])
  })
})
