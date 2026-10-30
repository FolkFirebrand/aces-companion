import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import {
  selectDifficulty, selectExistingForceModifier, selectPvLimit, selectTotalIncome, selectWarchestBalance,
} from '@/store/selectors'
import { UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import type { DifficultyLevel, Sortie } from '@/lib/types'
import { logCompletedSortie } from './helpers'

function store() {
  return useCampaignStore.getState()
}

function sortieWith(fields: Partial<Sortie>): Sortie {
  let id = ''
  act(() => {
    id = store().addSortie()
    store().updateSortie(id, fields)
  })
  return store().campaign.sorties.find(s => s.id === id)!
}

function setLevel(difficultyLevel: DifficultyLevel) {
  act(() => store().updateCampaignMeta({ difficultyLevel }))
}

let pilotCount = 0
function hirePilotWithTotalSp(totalSpEarned: number) {
  act(() => store().addPilot({
    id: `p${++pilotCount}`, callsign: 'Pilot', pilotType: 'BattleMech', wounded: false, mvpCount: 0,
    totalSpEarned, spSpentOnSkill: 0, spSpentOnEdgeTokens: 0, spSpentOnEdgeAbilities: 0,
    edgeAbilitiesLearned: [], campaignHistory: [],
  }))
}

beforeEach(() => {
  store().resetStore()
})

describe('Difficulty Level', () => {
  it('defaults to Standard', () => {
    expect(store().campaign.difficultyLevel).toBe('standard')
    expect(selectDifficulty(store().campaign)).toEqual({ pvPercent: 0, spPercent: 100 })
  })

  it.each([
    ['rookie', 20, 120],
    ['standard', 0, 100],
    ['veteran', -10, 90],
    ['elite', -20, 80],
    ['legendary', -30, 70],
  ] as const)('%s sets Player Force PV %i%% and SP Earned %i%%', (level, pvPercent, spPercent) => {
    setLevel(level)

    expect(selectDifficulty(store().campaign)).toEqual({ pvPercent, spPercent })
  })

  it('takes the players\' own percentages on Custom', () => {
    act(() => store().updateCampaignMeta({ difficultyLevel: 'custom', customPvPercent: -40, customSpPercent: 60 }))

    expect(selectDifficulty(store().campaign)).toEqual({ pvPercent: -40, spPercent: 60 })
  })
})

describe('Existing-Force Modifier', () => {
  it.each([
    [[150, 150], 0],
    [[1500, 1500], 0],
    [[1500, 1501], -10],
    [[3000, 3000], -10],
    [[3000, 3001], -20],
    [[4500, 4500], -20],
    [[4500, 4501], -30],
    [[6000, 6000], -30],
    [[6000, 6001], -40],
  ])('combined Total SP Earned %j gives %i%%', (totals, modifier) => {
    totals.forEach(hirePilotWithTotalSp)

    expect(selectExistingForceModifier(store().campaign)).toBe(modifier)
  })
})

describe('PV Limit', () => {
  it('raises the PV Limit: 250 PV at Rookie with −10% → 275', () => {
    setLevel('rookie')
    ;[2000, 1500].forEach(hirePilotWithTotalSp)
    const sortie = sortieWith({ listedPv: 250 })

    expect(selectPvLimit(store().campaign, sortie)).toBe(275)
  })

  it('rounds down', () => {
    setLevel('veteran')
    const sortie = sortieWith({ listedPv: 245 })

    expect(selectPvLimit(store().campaign, sortie)).toBe(220)
  })

  it('is zero until the sortie\'s Listed PV is entered', () => {
    const sortie = sortieWith({})

    expect(selectPvLimit(store().campaign, sortie)).toBe(0)
  })
})

describe('Total Income', () => {
  it('applies the SP Earned %', () => {
    setLevel('rookie')
    const sortie = sortieWith({ primaryObjective: 1000, otherObjectives: 35 })

    expect(selectTotalIncome(store().campaign, sortie)).toBe(1242)
  })

  it('rounds down', () => {
    setLevel('veteran')
    const sortie = sortieWith({ primaryObjective: 1000, otherObjectives: 35 })

    expect(selectTotalIncome(store().campaign, sortie)).toBe(931)
  })

  it('feeds the Warchest', () => {
    setLevel('elite')
    logCompletedSortie({ primaryObjective: 1000 })

    expect(selectWarchestBalance(store().campaign)).toBe(400 + 800)
  })
})

describe('upgrading version 3 saves', () => {
  const v3 = (difficultyModifier: number) => ({
    campaign: {
      id: 'c1', level: 'Hard', difficultyModifier, pvLimit: 300, startingWarchest: 400,
      units: [], namedPilots: [], memorial: [], sorties: [{ id: 's1', sortieNumber: '01' }],
    },
  })

  it.each([
    [1.2, 'rookie'], [1, 'standard'], [0.9, 'veteran'], [0.8, 'elite'], [0.7, 'legendary'],
  ])('maps a ×%d multiplier to %s', (multiplier, level) => {
    const { campaign } = runUpgrades(v3(multiplier), 3, 4, UPGRADE_STEPS)

    expect(campaign.difficultyLevel).toBe(level)
  })

  it('keeps any other multiplier as Custom SP Earned %', () => {
    const { campaign } = runUpgrades(v3(1.5), 3, 4, UPGRADE_STEPS)

    expect(campaign).toMatchObject({ difficultyLevel: 'custom', customSpPercent: 150, customPvPercent: 0 })
  })

  it('drops the old free-text level and manual PV limit, and gives sorties a Listed PV', () => {
    const { campaign } = runUpgrades(v3(1), 3, 4, UPGRADE_STEPS)

    expect(campaign).not.toHaveProperty('level')
    expect(campaign).not.toHaveProperty('difficultyModifier')
    expect(campaign).not.toHaveProperty('pvLimit')
    expect(campaign.sorties).toEqual([{ id: 's1', sortieNumber: '01', listedPv: 0 }])
  })
})
