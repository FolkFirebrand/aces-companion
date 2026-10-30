import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectPilotSpBreakdown } from '@/store/selectors'
import { SKILL_THRESHOLDS, EDGE_TOKEN_THRESHOLDS, trackProgress, trackStepDown, trackStepUp } from '@/lib/thresholds'
import type { NamedPilot, Sortie } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function pilot(overrides: Partial<NamedPilot> = {}): NamedPilot {
  return {
    id: 'ghost', callsign: 'Ghost', pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: 150,
    spSpentOnSkill: 0, spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 30, edgeAbilitiesLearned: [], campaignHistory: [], ...overrides,
  }
}

// A completed sortie as the store makes one.
function played(fields: Partial<Sortie>): Sortie {
  let id = ''
  act(() => { id = store().addSortie() })
  const sortie = store().campaign.sorties.find(s => s.id === id)!
  act(() => store().resetStore())
  return { ...sortie, status: 'completed', outcome: 'victory', ...fields }
}

beforeEach(() => {
  store().resetStore()
})

describe('a Named Pilot’s Total SP Earned, broken down', () => {
  it('splits starting SP, Carried-over SP, sortie shares and MVP bonuses', () => {
    const stored = pilot({ totalSpEarned: 900, carriedOverSp: 750, mvpCount: 2 })
    const sorties = [
      played({ id: 's1', pilotShares: [{ pilotId: 'ghost', callsign: 'Ghost', status: 'fielded', share: 100, mvp: true }] }),
      played({ id: 's2', pilotShares: [{ pilotId: 'ghost', callsign: 'Ghost', status: 'wounded', share: 80, mvp: false }] }),
      played({ id: 's3', pilotShares: [{ pilotId: 'ghost', callsign: 'Ghost', status: 'satOut', share: 0, mvp: false }] }),
    ]
    const campaign = { ...store().campaign, namedPilots: [stored], sorties }

    expect(selectPilotSpBreakdown(campaign, stored)).toEqual({
      start: 150, carriedOver: 750, sorties: 180, mvp: 20, total: 1100, sortiesPlayed: 2, mvpCount: 3,
    })
  })

  it('ignores Failed Sorties', () => {
    const stored = pilot()
    const sorties = [played({ outcome: 'failed', pilotShares: [{ pilotId: 'ghost', callsign: 'Ghost', status: 'fielded', share: 100, mvp: false }] })]

    expect(selectPilotSpBreakdown({ ...store().campaign, namedPilots: [stored], sorties }, stored))
      .toMatchObject({ sorties: 0, total: 150, sortiesPlayed: 0 })
  })
})

describe('progress along an improvement track', () => {
  it('gives the current value and how far it is to the next threshold', () => {
    expect(trackProgress(400, SKILL_THRESHOLDS)).toEqual({ value: 3, next: { value: 2, at: 900 }, toGo: 500, fraction: 400 / 900 })
    expect(trackProgress(120, EDGE_TOKEN_THRESHOLDS)).toEqual({ value: 3, next: { value: 4, at: 200 }, toGo: 80, fraction: 120 / 200 })
  })

  it('has no next threshold at the top of the track', () => {
    expect(trackProgress(3400, SKILL_THRESHOLDS)).toEqual({ value: 0, next: null, toGo: 0, fraction: 1 })
  })
})

describe('stepping along an improvement track', () => {
  it('"+" moves to the next level, or puts in what SP is left when that is not enough', () => {
    expect(trackStepUp(0, 150, EDGE_TOKEN_THRESHOLDS)).toBe(60)
    expect(trackStepUp(60, 90, EDGE_TOKEN_THRESHOLDS)).toBe(60)
    expect(trackStepUp(0, 30, SKILL_THRESHOLDS)).toBe(30)
    expect(trackStepUp(30, 0, SKILL_THRESHOLDS)).toBe(0)
    expect(trackStepUp(3400, 500, SKILL_THRESHOLDS)).toBe(0)
  })

  it('"−" steps back to the last level reached, then the one before', () => {
    expect(trackStepDown(150, SKILL_THRESHOLDS)).toBe(150)
    expect(trackStepDown(150, EDGE_TOKEN_THRESHOLDS)).toBe(30)
    expect(trackStepDown(120, EDGE_TOKEN_THRESHOLDS)).toBe(60)
    expect(trackStepDown(60, EDGE_TOKEN_THRESHOLDS)).toBe(60)
    expect(trackStepDown(0, EDGE_TOKEN_THRESHOLDS)).toBe(0)
  })
})
