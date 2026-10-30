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

// Four Named Pilots; three are fielded and Wren sits out.
function setUp(pilots: NamedPilot[] = [pilot('flint'), pilot('sable'), pilot('talon'), pilot('wren')]) {
  store().resetStore()
  act(() => {
    pilots.forEach(p => store().addPilot(p))
    store().addUnit(unit('u1', 'flint'))
    store().addUnit(unit('u2', 'sable'))
    store().addUnit(unit('u3', 'talon'))
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
  it('gives 80 each for the three fielded, 40 for the one who sat out', () => {
    // A pilot wounded this sortie still gets a full share.
    act(() => store().updateFieldedUnit(sortieId, 'u1', { damage: 'destroyed', salvageRoll: 9, crewMode: 'roll', crewRoll: 5 }))
    earn(1000, 80)

    expect(shares()).toEqual({ flint: 80, sable: 80, talon: 80, wren: 40 })
    expect(Object.values(shares()).reduce((sum, n) => sum + n, 0)).toBe(280)
  })

  it('splits short Earnings evenly, with half for pilots who sat out, rounded down', () => {
    earn(250, 100)

    // 250 can't cover 100 × 3 + 50; each fielded pilot gets 250 ÷ 3.5 = 71, the one who sat out 35.
    expect(shares()).toEqual({ flint: 71, sable: 71, talon: 71, wren: 35 })
  })

  it('gives nothing to a Named Pilot killed in action', () => {
    act(() => store().updateFieldedUnit(sortieId, 'u1', { damage: 'destroyed', salvageRoll: 9, crewMode: 'killed' }))
    earn(1000, 80)

    expect(shares().flint).toBe(0)
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
    act(() => store().setMvp(sortieId, 'flint'))
    allocate('flint', 'skill', 100)
    allocate('sable', 'skill', 80)
    allocate('talon', 'skill', 80)
    allocate('wren', 'skill', 40)
    complete()

    expect(selectWarchestBalance(store().campaign)).toBe(400 + 1000 - 280)
    expect(effective('flint').totalSpEarned).toBe(150 + 80 + 20)
    expect(effective('flint').mvpCount).toBe(1)
  })
})

describe('the MVP', () => {
  it('must be a Named Pilot who was fielded and survived', () => {
    act(() => store().updateFieldedUnit(sortieId, 'u1', { damage: 'destroyed', salvageRoll: 9, crewMode: 'killed' }))
    earn(1000, 80)

    act(() => store().setMvp(sortieId, 'wren'))
    expect(sortie(sortieId).mvpPilotId).toBeNull()
    act(() => store().setMvp(sortieId, 'flint'))
    expect(sortie(sortieId).mvpPilotId).toBeNull()
    act(() => store().setMvp(sortieId, 'sable'))
    expect(sortie(sortieId).mvpPilotId).toBe('sable')
  })
})

describe('allocating new SP', () => {
  it('unlocks the first Edge Ability with 70 SP on that track', () => {
    // The pilot put 120 on Edge Tokens and 30 on Edge Abilities at creation.
    setUp([pilot('sable', { spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 30 }), pilot('flint'), pilot('talon'), pilot('wren', { wounded: true })])
    act(() => store().assignFieldedPilot(sortieId, 'u1', 'sable'))
    act(() => store().assignFieldedPilot(sortieId, 'u2', 'flint'))
    earn(410, 70)

    expect(shares()).toEqual({ sable: 70, flint: 70, talon: 70, wren: 35 })

    allocate('sable', 'edgeAbilities', 70)
    allocate('flint', 'skill', 70)
    allocate('talon', 'skill', 70)
    allocate('wren', 'skill', 35)
    act(() => store().setMvp(sortieId, 'flint'))
    allocate('flint', 'skill', 90)
    complete()

    expect(effective('sable')).toMatchObject({ totalSpEarned: 220, spSpentOnEdgeAbilities: 100 })
    expect(selectPilotEdgeAbilities(effective('sable'))).toBe(1)
    expect(selectWarchestBalance(store().campaign)).toBe(400 + 410 - 245)
  })

  it('blocks completion until every pilot has allocated exactly their new SP, and an MVP is chosen', () => {
    earn(1000, 80)
    allocate('flint', 'skill', 50)
    allocate('sable', 'skill', 90)
    act(() => ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true)))

    expect(selectCompletionBlockers(sortie(sortieId), store().campaign)).toEqual([
      'Improving Named Pilots: choose an MVP',
      'Improving Named Pilots: allocate 30 more SP for flint',
      'Improving Named Pilots: allocate 10 SP less for sable',
      'Improving Named Pilots: allocate 80 more SP for talon',
      'Improving Named Pilots: allocate 40 more SP for wren',
    ])
  })

  it('are undone when the sortie is reopened', () => {
    earn(1000, 80)
    act(() => store().setMvp(sortieId, 'flint'))
    allocate('flint', 'skill', 100)
    allocate('sable', 'edgeTokens', 80)
    allocate('talon', 'skill', 80)
    allocate('wren', 'skill', 40)
    complete()

    act(() => store().reopenSortie(sortieId))

    expect(effective('flint')).toMatchObject({ totalSpEarned: 150, spSpentOnSkill: 0, mvpCount: 0 })
    expect(effective('sable')).toMatchObject({ totalSpEarned: 150, spSpentOnEdgeTokens: 0 })
  })
})

describe('spending SP outside the step', () => {
  it('lets a new pilot spend their starting SP, then locks it after their first sortie', () => {
    act(() => store().spendOnStat('wren', 'skill', 100))
    expect(effective('wren').spSpentOnSkill).toBe(100)

    earn(1000, 80)
    act(() => store().setMvp(sortieId, 'flint'))
    allocate('flint', 'skill', 100)
    allocate('sable', 'skill', 80)
    allocate('talon', 'skill', 80)
    allocate('wren', 'skill', 40)
    complete()

    act(() => store().spendOnStat('wren', 'skill', 10))
    act(() => store().refundStat('wren', 'skill', 100))
    expect(effective('wren').spSpentOnSkill).toBe(140)
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
