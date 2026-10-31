import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectCanEditStartingForce } from '@/store/selectors'
import { setupStartingWarchest } from '@/lib/rules'
import type { Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function unit(id: string, pvAtSkill4: number): Unit {
  return { id, nameAndVariant: id, unitType: 'BattleMech', pvAtSkill4, size: 2, ene: false, pilotId: null, totalSpEarned: 0 }
}

describe('Build the Force from the Roster', () => {
  beforeEach(() => {
    act(() => store().resetStore())
    act(() => store().updateCampaignMeta({ units: [unit('a', 300)], startingWarchest: setupStartingWarchest(300) }))
  })

  it('moves the starting Warchest with the unspent PV', () => {
    act(() => store().addStartingUnit(unit('b', 50)))
    expect(store().campaign.startingWarchest).toBe(setupStartingWarchest(350))
    act(() => store().removeStartingUnit('a'))
    expect(store().campaign.startingWarchest).toBe(setupStartingWarchest(50))
  })

  it('gives no SP back for PV over the limit', () => {
    act(() => store().addStartingUnit(unit('b', 150)))
    expect(store().campaign.startingWarchest).toBe(setupStartingWarchest(450))
    act(() => store().removeStartingUnit('b'))
    expect(store().campaign.startingWarchest).toBe(setupStartingWarchest(300))
  })

  it('is closed once a sortie is logged', () => {
    act(() => { store().addSortie() })
    expect(selectCanEditStartingForce(store().campaign)).toBe(false)
    act(() => store().addStartingUnit(unit('b', 50)))
    expect(store().campaign.units.map(u => u.id)).toEqual(['a'])
    expect(store().campaign.startingWarchest).toBe(setupStartingWarchest(300))
  })
})
