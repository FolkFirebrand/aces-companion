import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import type { Unit } from '@/lib/types'

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'u1', nameAndVariant: 'Atlas AS7-D', unitType: 'BattleMech',
    pvAtSkill4: 46, pilotId: null, size: 2, ene: false, totalSpEarned: 0,
    ...overrides,
  }
}

beforeEach(() => {
  useCampaignStore.getState().resetStore()
})

describe('assignPilot', () => {
  it('assigns a pilot to a unit', () => {
    act(() => {
      useCampaignStore.getState().addUnit(makeUnit({ id: 'u1' }))
      useCampaignStore.getState().assignPilot('u1', 'p1')
    })
    const unit = useCampaignStore.getState().campaign.units.find(u => u.id === 'u1')!
    expect(unit.pilotId).toBe('p1')
  })

  it('clears previous assignment when pilot moves to another unit', () => {
    act(() => {
      useCampaignStore.getState().addUnit(makeUnit({ id: 'u1', pilotId: 'p1' }))
      useCampaignStore.getState().addUnit(makeUnit({ id: 'u2' }))
      useCampaignStore.getState().assignPilot('u2', 'p1')
    })
    const units = useCampaignStore.getState().campaign.units
    expect(units.find(u => u.id === 'u1')!.pilotId).toBeNull()
    expect(units.find(u => u.id === 'u2')!.pilotId).toBe('p1')
  })

  it('unassigns a pilot with null', () => {
    act(() => {
      useCampaignStore.getState().addUnit(makeUnit({ id: 'u1', pilotId: 'p1' }))
      useCampaignStore.getState().assignPilot('u1', null)
    })
    const unit = useCampaignStore.getState().campaign.units.find(u => u.id === 'u1')!
    expect(unit.pilotId).toBeNull()
  })
})


describe('spendOnStat', () => {
  it('increases spSpentOnSkill by cost amount', () => {
    act(() => {
      useCampaignStore.getState().addPilot({
        id: 'p2', callsign: 'Hawk', pilotType: 'BattleMech', wounded: false,
        mvpCount: 0, totalSpEarned: 500,
        spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0,
        edgeAbilitiesLearned: [], campaignHistory: [],
      })
      useCampaignStore.getState().spendOnStat('p2', 'skill', 200)
    })
    const pilot = useCampaignStore.getState().campaign.namedPilots.find(p => p.id === 'p2')!
    expect(pilot.spSpentOnSkill).toBe(200)
    expect(pilot.totalSpEarned).toBe(500)
  })

  it('blocks spend when cost exceeds available SP', () => {
    act(() => {
      useCampaignStore.getState().addPilot({
        id: 'p3', callsign: 'Iron', pilotType: 'BattleMech', wounded: false,
        mvpCount: 0, totalSpEarned: 100,
        spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0,
        edgeAbilitiesLearned: [], campaignHistory: [],
      })
      useCampaignStore.getState().spendOnStat('p3', 'skill', 500)
    })
    const pilot = useCampaignStore.getState().campaign.namedPilots.find(p => p.id === 'p3')!
    expect(pilot.spSpentOnSkill).toBe(0)
  })
})
