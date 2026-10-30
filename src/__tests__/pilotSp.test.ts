import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import {
  selectCompletionBlockers, selectEffectivePilot, selectImproveSkipReason, selectPilotEdgeAbilities,
  selectPilotShares, selectWarchestBalance,
} from '@/store/selectors'
import { ALL_STEP_IDS } from '@/lib/steps'
import { UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import type { NamedPilot, Sortie, StatTrack, Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function sortie(id: string): Sortie {
  return store().campaign.sorties.find(s => s.id === id)!
}

function pilot(id: string, overrides: Partial<NamedPilot> = {}): NamedPilot {
  return {
    id, callsign: id, pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: 150,
    spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0, edgeAbilitiesLearned: [], campaignHistory: [], ...overrides,
  }
}

function unit(id: string, pilotId: string | null): Unit {
  return { id, nameAndVariant: id, unitType: 'BattleMech', pvAtSkill4: 30, size: 2, ene: true, pilotId, totalSpEarned: 0 }
}

function effective(id: string): NamedPilot {
  return selectEffectivePilot(store().campaign, store().campaign.namedPilots.find(p => p.id === id)!)
}

let sortieId = ''

// Four Named Pilots; three are fielded and Jabal sits out.
function setUp(pilots: NamedPilot[] = [pilot('gus'), pilot('harlan'), pilot('randolph'), pilot('jabal')]) {
  store().resetStore()
  act(() => {
    pilots.forEach(p => store().addPilot(p))
    store().addUnit(unit('u1', 'gus'))
    store().addUnit(unit('u2', 'harlan'))
    store().addUnit(unit('u3', 'randolph'))
    store().addUnit(unit('u4', null))
    sortieId = store().addSortie()
    for (const id of ['u1', 'u2', 'u3']) store().setFielded(sortieId, id, true)
  })
}

function earn(primaryObjective: number, maxSpPerPilot: number) {
  act(() => store().updateSortie(sortieId, { primaryObjective, maxSpPerPilot }))
}

function allocate(pilotId: string, track: StatTrack, amount: number) {
  act(() => store().setPilotAllocation(sortieId, pilotId, track, amount))
}

function complete() {
  act(() => {
    ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true))
    store().completeSortie(sortieId)
  })
}

function shares(): Record<string, number> {
  return Object.fromEntries(selectPilotShares(store().campaign, sortie(sortieId)).map(s => [s.pilotId, s.share]))
}

beforeEach(() => setUp())

describe('sharing SP between Named Pilots', () => {
  it('reproduces the rulebook example: 80 each for the three fielded, 40 for the one who sat out', () => {
    // After-Sortie Steps Example, Aces Rulebook p. 37 (Gus was wounded this sortie and still gets a full share).
    act(() => store().updateFieldedUnit(sortieId, 'u1', { damage: 'destroyed', salvageRoll: 9, crewMode: 'roll', crewRoll: 5 }))
    earn(1000, 80)

    expect(shares()).toEqual({ gus: 80, harlan: 80, randolph: 80, jabal: 40 })
    expect(Object.values(shares()).reduce((sum, n) => sum + n, 0)).toBe(280)
  })

  it('splits short Earnings evenly, with half for pilots who sat out, rounded down', () => {
    earn(250, 100)

    // 250 can't cover 100 × 3 + 50; each fielded pilot gets 250 ÷ 3.5 = 71, the one who sat out 35.
    expect(shares()).toEqual({ gus: 71, harlan: 71, randolph: 71, jabal: 35 })
  })

  it('gives nothing to a Named Pilot killed in action', () => {
    act(() => store().updateFieldedUnit(sortieId, 'u1', { damage: 'destroyed', salvageRoll: 9, crewMode: 'killed' }))
    earn(1000, 80)

    expect(shares().gus).toBe(0)
  })

  it('gives nothing when Earnings are negative', () => {
    act(() => store().updateSortie(sortieId, { reconnaissanceCost: 100, maxSpPerPilot: 80 }))

    expect(selectImproveSkipReason(store().campaign, sortie(sortieId))).toBe('negativeEarnings')
    expect(Object.values(shares())).toEqual([0, 0, 0, 0])
  })

  it('skips the step when the Warchest would be zero or below', () => {
    act(() => store().updateCampaignMeta({ startingWarchest: -500 }))
    earn(300, 80)

    expect(selectImproveSkipReason(store().campaign, sortie(sortieId))).toBe('emptyWarchest')
    expect(Object.values(shares())).toEqual([0, 0, 0, 0])
  })

  it('takes the shares out of the Warchest, but not the MVP bonus', () => {
    earn(1000, 80)
    act(() => store().setMvp(sortieId, 'gus'))
    allocate('gus', 'skill', 100)
    allocate('harlan', 'skill', 80)
    allocate('randolph', 'skill', 80)
    allocate('jabal', 'skill', 40)
    complete()

    expect(selectWarchestBalance(store().campaign)).toBe(400 + 1000 - 280)
    expect(effective('gus').totalSpEarned).toBe(150 + 80 + 20)
    expect(effective('gus').mvpCount).toBe(1)
  })
})

describe('the MVP', () => {
  it('must be a Named Pilot who was fielded and survived', () => {
    act(() => store().updateFieldedUnit(sortieId, 'u1', { damage: 'destroyed', salvageRoll: 9, crewMode: 'killed' }))
    earn(1000, 80)

    act(() => store().setMvp(sortieId, 'jabal'))
    expect(sortie(sortieId).mvpPilotId).toBeNull()
    act(() => store().setMvp(sortieId, 'gus'))
    expect(sortie(sortieId).mvpPilotId).toBeNull()
    act(() => store().setMvp(sortieId, 'harlan'))
    expect(sortie(sortieId).mvpPilotId).toBe('harlan')
  })
})

describe('allocating new SP', () => {
  it('reproduces the rulebook example: 70 SP into Edge Abilities unlocks the first one', () => {
    // Improving Named Pilots Example, Aces Rulebook p. 35: 120 on Edge Tokens and 30 on Edge Abilities at creation.
    setUp([pilot('harlan', { spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 30 }), pilot('gus'), pilot('randolph'), pilot('jabal', { wounded: true })])
    act(() => store().assignFieldedPilot(sortieId, 'u1', 'harlan'))
    act(() => store().assignFieldedPilot(sortieId, 'u2', 'gus'))
    earn(410, 70)

    expect(shares()).toEqual({ harlan: 70, gus: 70, randolph: 70, jabal: 35 })

    allocate('harlan', 'edgeAbilities', 70)
    allocate('gus', 'skill', 70)
    allocate('randolph', 'skill', 70)
    allocate('jabal', 'skill', 35)
    act(() => store().setMvp(sortieId, 'gus'))
    allocate('gus', 'skill', 90)
    complete()

    expect(effective('harlan')).toMatchObject({ totalSpEarned: 220, spSpentOnEdgeAbilities: 100 })
    expect(selectPilotEdgeAbilities(effective('harlan'))).toBe(1)
    expect(selectWarchestBalance(store().campaign)).toBe(400 + 410 - 245)
  })

  it('blocks completion until every pilot has allocated exactly their new SP, and an MVP is chosen', () => {
    earn(1000, 80)
    allocate('gus', 'skill', 50)
    allocate('harlan', 'skill', 90)
    act(() => ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true)))

    expect(selectCompletionBlockers(sortie(sortieId), store().campaign)).toEqual([
      'Improving Named Pilots: choose an MVP',
      'Improving Named Pilots: allocate 30 more SP for gus',
      'Improving Named Pilots: allocate 10 SP less for harlan',
      'Improving Named Pilots: allocate 80 more SP for randolph',
      'Improving Named Pilots: allocate 40 more SP for jabal',
    ])
  })

  it('are undone when the sortie is reopened', () => {
    earn(1000, 80)
    act(() => store().setMvp(sortieId, 'gus'))
    allocate('gus', 'skill', 100)
    allocate('harlan', 'edgeTokens', 80)
    allocate('randolph', 'skill', 80)
    allocate('jabal', 'skill', 40)
    complete()

    act(() => store().reopenSortie(sortieId))

    expect(effective('gus')).toMatchObject({ totalSpEarned: 150, spSpentOnSkill: 0, mvpCount: 0 })
    expect(effective('harlan')).toMatchObject({ totalSpEarned: 150, spSpentOnEdgeTokens: 0 })
  })
})

describe('spending SP outside the step', () => {
  it('lets a new pilot spend their starting SP, then locks it after their first sortie', () => {
    act(() => store().spendOnStat('jabal', 'skill', 100))
    expect(effective('jabal').spSpentOnSkill).toBe(100)

    earn(1000, 80)
    act(() => store().setMvp(sortieId, 'gus'))
    allocate('gus', 'skill', 100)
    allocate('harlan', 'skill', 80)
    allocate('randolph', 'skill', 80)
    allocate('jabal', 'skill', 40)
    complete()

    act(() => store().spendOnStat('jabal', 'skill', 10))
    act(() => store().refundStat('jabal', 'skill', 100))
    expect(effective('jabal').spSpentOnSkill).toBe(140)
  })
})

describe('upgrading version 8 saves', () => {
  it('keeps typed-in pilot SP on old sorties and adds the improvement fields', () => {
    const v8 = { campaign: { id: 'c1', units: [], namedPilots: [], memorial: [], sorties: [{ id: 's1', namedPilotSpEarned: 280 }] } }

    const { campaign } = runUpgrades(v8, 8, 9, UPGRADE_STEPS)

    expect(campaign.sorties).toEqual([{
      id: 's1', legacyNamedPilotSp: 280, maxSpPerPilot: 0, mvpPilotId: null, pilotAllocations: [], pilotShares: [],
    }])
  })
})
