import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectEffectivePilot, selectHireBlocker, selectPersonnelCost, selectPilotShares, selectSortieEarnings } from '@/store/selectors'
import { ALL_STEP_IDS } from '@/lib/steps'
import { UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import type { NamedPilot, Sortie, Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function sortie(id: string): Sortie {
  return store().campaign.sorties.find(s => s.id === id)!
}

function pilot(id: string): NamedPilot {
  return {
    id, callsign: id, pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: 150,
    spSpentOnSkill: 150, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0, edgeAbilitiesLearned: [], campaignHistory: [],
  }
}

function unit(id: string, pilotId: string | null): Unit {
  return { id, nameAndVariant: id, unitType: 'BattleMech', pvAtSkill4: 30, size: 2, ene: true, pilotId, totalSpEarned: 0 }
}

const RECRUIT = { callsign: 'Recruit', pilotType: 'BattleMech' as const, skill: 0, edgeTokens: 120, edgeAbilities: 30 }

let sortieId = ''

function setUp(pilotIds: string[]) {
  store().resetStore()
  act(() => {
    pilotIds.forEach(id => store().addPilot(pilot(id)))
    store().addUnit(unit('u1', pilotIds[0] ?? null))
    sortieId = store().addSortie()
    store().setFielded(sortieId, 'u1', true)
  })
}

function complete() {
  act(() => {
    ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true))
    store().completeSortie(sortieId)
  })
}

beforeEach(() => setUp(['ghost', 'rook']))

describe('hiring a Named Pilot', () => {
  it('costs 150 SP in the sortie\'s personnel expenses', () => {
    act(() => store().hirePilot(sortieId, RECRUIT))

    expect(selectPersonnelCost(sortie(sortieId))).toBe(150)
    expect(selectSortieEarnings(store().campaign, sortie(sortieId))).toBe(-150)
  })

  it('needs exactly 150 starting SP allocated', () => {
    act(() => store().hirePilot(sortieId, { ...RECRUIT, edgeAbilities: 0 }))

    expect(sortie(sortieId).hires).toEqual([])
  })

  it('joins the force when the sortie is completed, with their starting SP spent', () => {
    act(() => store().hirePilot(sortieId, RECRUIT))
    complete()

    const recruit = store().campaign.namedPilots.find(p => p.callsign === 'Recruit')!
    expect(selectEffectivePilot(store().campaign, recruit)).toMatchObject({
      totalSpEarned: 150, spSpentOnSkill: 0, spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 30, wounded: false,
    })
  })

  it('takes no share of the sortie they were hired after', () => {
    act(() => {
      store().hirePilot(sortieId, RECRUIT)
      store().updateSortie(sortieId, { primaryObjective: 1000, maxSpPerPilot: 80 })
    })

    expect(selectPilotShares(store().campaign, sortie(sortieId)).map(s => s.callsign)).toEqual(['ghost', 'rook'])
  })

  it('is undone when the sortie is reopened', () => {
    act(() => store().hirePilot(sortieId, RECRUIT))
    complete()

    act(() => store().reopenSortie(sortieId))

    expect(store().campaign.namedPilots.map(p => p.id)).toEqual(['ghost', 'rook'])
    expect(sortie(sortieId).hires).toHaveLength(1)
  })

  it('stops at six Named Pilots', () => {
    setUp(['a', 'b', 'c', 'd', 'e', 'f'])

    expect(selectHireBlocker(store().campaign, sortie(sortieId))).toBe('Your force already has six Named Pilots.')
    act(() => store().hirePilot(sortieId, RECRUIT))
    expect(sortie(sortieId).hires).toEqual([])
  })

  it('can replace a Named Pilot killed in the same sortie, even at six', () => {
    setUp(['a', 'b', 'c', 'd', 'e', 'f'])
    act(() => store().updateFieldedUnit(sortieId, 'u1', { damage: 'destroyed', salvageRoll: 9, crewMode: 'killed' }))

    expect(selectHireBlocker(store().campaign, sortie(sortieId))).toBeNull()
    act(() => store().hirePilot(sortieId, RECRUIT))
    complete()

    expect(store().campaign.namedPilots.map(p => p.callsign)).toEqual(['b', 'c', 'd', 'e', 'f', 'Recruit'])
  })
})

describe('dismissing a Named Pilot', () => {
  beforeEach(() => {
    act(() => store().deleteSortie(sortieId))
    act(() => store().addUnit(unit('u2', 'rook')))
  })

  it('removes them from the force, frees their unit and records them on the Memorial as dismissed', () => {
    act(() => store().dismissPilot('rook'))

    expect(store().campaign.namedPilots.map(p => p.id)).toEqual(['ghost'])
    expect(store().campaign.units.find(u => u.id === 'u2')?.pilotId).toBeNull()
    expect(store().campaign.memorial).toEqual([expect.objectContaining({ name: 'rook', type: 'pilot', reason: 'dismissed' })])
  })

  it('is blocked while the pilot is fielded in a draft sortie', () => {
    act(() => {
      sortieId = store().addSortie()
      store().setFielded(sortieId, 'u2', true)
    })

    act(() => store().dismissPilot('rook'))

    expect(store().campaign.namedPilots.map(p => p.id)).toEqual(['ghost', 'rook'])
  })
})

describe('upgrading version 9 saves', () => {
  it('keeps typed-in replacement pilot counts and adds hires', () => {
    const v9 = { campaign: { id: 'c1', units: [], namedPilots: [], memorial: [], sorties: [{ id: 's1', newReplacementPilots: 1 }] } }

    const { campaign } = runUpgrades(v9, 9, 10, UPGRADE_STEPS)

    expect(campaign.sorties).toEqual([{ id: 's1', legacyNewReplacementPilots: 1, hires: [] }])
  })
})
