import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectCampaignKeywords, selectNextSortieNote } from '@/store/selectors'
import { STEPS } from '@/lib/steps'
import { UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import { logCompletedSortie } from './helpers'

function store() {
  return useCampaignStore.getState()
}

beforeEach(() => {
  store().resetStore()
})

describe('the campaign Keyword list', () => {
  it('collects the Keywords gained by every completed sortie, once each', () => {
    logCompletedSortie({ keywordsGained: ['Salvage Rights', 'Hired Guns'] })
    logCompletedSortie({ keywordsGained: ['salvage rights', 'Night Raid'] })

    expect(selectCampaignKeywords(store().campaign)).toEqual(['Salvage Rights', 'Hired Guns', 'Night Raid'])
  })

  it('leaves out a draft\'s Keywords until it is completed', () => {
    let id = ''
    act(() => {
      id = store().addSortie()
      store().updateSortie(id, { keywordsGained: ['Hired Guns'] })
    })

    expect(selectCampaignKeywords(store().campaign)).toEqual([])
  })

  it('leaves out a Failed Sortie\'s Keywords', () => {
    logCompletedSortie({ outcome: 'failed', keywordsGained: ['Hired Guns'] })

    expect(selectCampaignKeywords(store().campaign)).toEqual([])
  })

  it('drops a Keyword when the only sortie that gained it is reopened', () => {
    logCompletedSortie({ keywordsGained: ['Hired Guns'] })
    const second = logCompletedSortie({ keywordsGained: ['Night Raid'] })

    act(() => store().reopenSortie(second))

    expect(selectCampaignKeywords(store().campaign)).toEqual(['Hired Guns'])
  })

  it('keeps a Keyword another completed sortie also gained', () => {
    logCompletedSortie({ keywordsGained: ['Hired Guns'] })
    const second = logCompletedSortie({ keywordsGained: ['Hired Guns'] })

    act(() => store().reopenSortie(second))

    expect(selectCampaignKeywords(store().campaign)).toEqual(['Hired Guns'])
  })
})

describe('the next-sortie note', () => {
  it('comes from the latest completed sortie', () => {
    logCompletedSortie({ nextSortieNote: 'Sortie 03' })
    logCompletedSortie({ nextSortieNote: 'Sortie 05, per the outcome' })

    expect(selectNextSortieNote(store().campaign)).toBe('Sortie 05, per the outcome')
  })

  it('ignores a draft\'s note and an empty note', () => {
    logCompletedSortie({ nextSortieNote: '' })
    act(() => {
      const id = store().addSortie()
      store().updateSortie(id, { nextSortieNote: 'Not yet' })
    })

    expect(selectNextSortieNote(store().campaign)).toBeNull()
  })
})

describe('the steps that record them', () => {
  it('make Read Sortie Outcome and Next Steps data steps, not tick-offs', () => {
    const dataSteps = STEPS.filter(s => !s.tickOff).map(s => s.name)

    expect(dataSteps).toEqual(expect.arrayContaining(['Read Sortie Outcome', 'Next Steps', 'Trigger Game-End Waypoints']))
  })
})

describe('upgrading version 5 saves', () => {
  it('gives every sortie empty waypoint and next-sortie notes', () => {
    const v5 = { campaign: { id: 'c1', units: [], namedPilots: [], memorial: [], sorties: [{ id: 's1' }] } }

    const { campaign } = runUpgrades(v5, 5, 6, UPGRADE_STEPS)

    expect(campaign.sorties).toEqual([{ id: 's1', waypointsNote: '', nextSortieNote: '' }])
  })
})
