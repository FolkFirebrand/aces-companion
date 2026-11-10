import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectCanEditStartingForce } from '@/store/selectors'
import { setupStartingWarchest } from '@/lib/rules'
import type { Unit } from '@/lib/types'
import { logCompletedSortie } from './helpers'

function store() {
  return useCampaignStore.getState()
}

function unit(id: string, pvAtSkill4: number): Unit {
  return { id, nameAndVariant: id, unitType: 'BattleMech', pvAtSkill4, size: 2, ene: false, pilotId: null, totalSpEarned: 0 }
}

describe('Build the Force from the Roster', () => {
  beforeEach(() => {
    act(() => store().resetStore())
    act(() => store().addStartingUnit(unit('a', 300)))
  })

  it('moves the starting Warchest with the unspent PV', () => {
    expect(store().campaign.startingWarchest).toBe(setupStartingWarchest(300))
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

  it('converts no PV while the roster is empty', () => {
    act(() => store().removeStartingUnit('a'))
    expect(store().campaign.startingWarchest).toBe(400)
  })

  it('follows a unit whose PV is corrected on the Roster', () => {
    act(() => store().updateUnit('a', { pvAtSkill4: 250 }))
    expect(store().campaign.startingWarchest).toBe(setupStartingWarchest(250))
  })

  it('keeps a typed Starting Warchest as the base under the unspent-PV SP', () => {
    act(() => store().updateCampaignMeta({ startingWarchest: 5000 }))
    expect(store().campaign.startingWarchest).toBe(5000)
    act(() => store().addStartingUnit(unit('b', 50)))
    expect(store().campaign.startingWarchest).toBe(5000 - 50 * 40)
  })

  it('stays open while the first sortie is a draft, and drops a removed unit from it', () => {
    let sortieId = ''
    act(() => {
      sortieId = store().addSortie()
      store().setFielded(sortieId, 'a', true)
    })
    expect(selectCanEditStartingForce(store().campaign)).toBe(true)
    act(() => store().removeStartingUnit('a'))
    expect(store().campaign.units).toEqual([])
    expect(store().campaign.sorties[0].fieldedUnits).toEqual([])
  })

  it('is closed, with the Starting Warchest fixed, once the first sortie is completed', () => {
    logCompletedSortie()
    expect(selectCanEditStartingForce(store().campaign)).toBe(false)
    act(() => store().addStartingUnit(unit('b', 50)))
    expect(store().campaign.units.map(u => u.id)).toEqual(['a'])
    act(() => store().updateUnit('a', { pvAtSkill4: 250 }))
    expect(store().campaign.startingWarchest).toBe(setupStartingWarchest(300))
  })
})
