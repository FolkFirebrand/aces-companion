import {
  selectAvailableSP,
  selectSortieEarnings,
  selectWarchestBalance,
  selectNextSkillCost,
  selectTotalRosterPV,
  selectAssignedPilot,
  selectPilotAssignedUnit,
} from '@/store/selectors'
import type { NamedPilot, Sortie, Campaign, Unit } from '@/lib/types'

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'u1', nameAndVariant: '', unitType: 'BattleMech',
    pvAtSkill4: 10, pilotId: null, size: 2, ene: false, totalSpEarned: 0,
    ...overrides,
  }
}

const basePilot: NamedPilot = {
  id: '1', callsign: 'Ghost', pilotType: 'BattleMech', wounded: false,
  mvpCount: 0, totalSpEarned: 500,
  spSpentOnSkill: 200, spSpentOnEdgeTokens: 60, spSpentOnEdgeAbilities: 60,
  edgeAbilitiesLearned: [], campaignHistory: [],
}

const standardCampaign = { difficultyLevel: 'standard', namedPilots: [] } as unknown as Campaign

const baseSortie: Sortie = {
  id: 's1', sortieNumber: '01', name: 'Test Sortie', datePlayed: '2026-01-01', status: 'completed', stepsDone: [], outcome: 'victory', listedPv: 0,
  reconnaissanceNote: '', appliedEffects: null, waypointsNote: '', nextSortieNote: '',
  primaryObjective: 500, otherObjectives: 200,
  reconnaissanceCost: 50, waypointsSP: 30, waypointsGainedSP: 0,
  legacyUnitsWithoutENE: 2, fieldedUnits: [], forceCommanderPilotId: null, legacyWoundedOrKilledCrew: 1, legacyNewReplacementPilots: 0, hires: [],
  legacyRepairs: [{ id: 'r1', unitId: 'u1', size: 2, tier: 'crippled' }],
  legacyNamedPilotSp: 0, maxSpPerPilot: 0, mvpPilotId: null, pilotAllocations: [], pilotShares: [], purchases: [], keywordsGained: [],
}

describe('selectAvailableSP', () => {
  it('subtracts all three spend tracks from total', () => {
    // 500 - 200 - 60 - 60 = 180
    expect(selectAvailableSP(basePilot)).toBe(180)
  })

  it('returns 0 when fully spent', () => {
    const pilot = { ...basePilot, spSpentOnSkill: 400, spSpentOnEdgeTokens: 60, spSpentOnEdgeAbilities: 40 }
    expect(selectAvailableSP(pilot)).toBe(0)
  })
})

describe('selectSortieEarnings', () => {
  it('calculates income minus all expenses correctly', () => {
    // income = (500 + 200) * 1 = 700
    // rearming = 2 * 20 = 40
    // personnel = 1 * 100 = 100
    // repairs = 2 (size) * 60 (crippled) = 120
    // total expenses = 50 + 30 + 40 + 100 + 120 = 340
    // earnings = 700 - 340 = 360
    expect(selectSortieEarnings(standardCampaign, baseSortie)).toBe(360)
  })

  it('takes SP gained from waypoints off the Waypoints line', () => {
    // waypoints net = 30 paid - 50 gained = -20, so expenses = 340 - 50 = 290
    expect(selectSortieEarnings(standardCampaign, { ...baseSortie, waypointsGainedSP: 50 })).toBe(410)
  })

  it('applies the SP Earned % to income', () => {
    const simpleSortie = {
      ...baseSortie,
      primaryObjective: 100, otherObjectives: 0,
      reconnaissanceCost: 0, waypointsSP: 0, waypointsGainedSP: 0,
      legacyUnitsWithoutENE: 0, legacyWoundedOrKilledCrew: 0, legacyNewReplacementPilots: 0, hires: [],
      legacyRepairs: [],
    }
    const custom = { difficultyLevel: 'custom', customSpPercent: 150, customPvPercent: 0, namedPilots: [] } as unknown as Campaign
    expect(selectSortieEarnings(custom, simpleSortie)).toBe(150)
  })
})

describe('selectWarchestBalance', () => {
  it('adds every sortie\'s earnings to the Starting Warchest Balance', () => {
    const simpleSortie: Sortie = {
      ...baseSortie, id: 's2', primaryObjective: 200, otherObjectives: 0,
      legacyRepairs: [], reconnaissanceCost: 0, waypointsSP: 0, waypointsGainedSP: 0,
      legacyUnitsWithoutENE: 0, legacyWoundedOrKilledCrew: 0, legacyNewReplacementPilots: 0, hires: [],
    }
    const campaign = {
      ...standardCampaign,
      startingWarchest: 400,
      sorties: [baseSortie, simpleSortie],
    } as unknown as Campaign
    const s1Earnings = selectSortieEarnings(campaign, baseSortie)
    const s2Earnings = selectSortieEarnings(campaign, simpleSortie)
    expect(selectWarchestBalance(campaign)).toBe(400 + s1Earnings + s2Earnings)
  })
})

describe('selectNextSkillCost', () => {
  it('returns SP needed for next skill tier', () => {
    // pilot has 200 sp on skill (at skill 4), next threshold is 400 → cost = 200
    const pilot = { ...basePilot, spSpentOnSkill: 200 }
    expect(selectNextSkillCost(pilot)).toBe(200)
  })

  it('returns null when at max tier', () => {
    const pilot = { ...basePilot, spSpentOnSkill: 3400 }
    expect(selectNextSkillCost(pilot)).toBeNull()
  })
})

describe('selectTotalRosterPV', () => {
  it('sums pvAtSkill4 across all units', () => {
    const units = [makeUnit({ pvAtSkill4: 46 }), makeUnit({ id: 'u2', pvAtSkill4: 28 })]
    expect(selectTotalRosterPV(units)).toBe(74)
  })

  it('returns 0 for empty roster', () => {
    expect(selectTotalRosterPV([])).toBe(0)
  })
})

describe('selectAssignedPilot', () => {
  it('returns the pilot assigned to a unit', () => {
    const units = [makeUnit({ id: 'u1', pilotId: 'p1' })]
    const pilots = [{ ...basePilot, id: 'p1' }]
    expect(selectAssignedPilot(units, pilots, 'u1')).toBe(pilots[0])
  })

  it('returns undefined when unit has no pilot', () => {
    const units = [makeUnit({ id: 'u1', pilotId: null })]
    expect(selectAssignedPilot(units, [basePilot], 'u1')).toBeUndefined()
  })
})

describe('selectPilotAssignedUnit', () => {
  it('returns the unit a pilot is assigned to', () => {
    const units = [makeUnit({ id: 'u1', pilotId: 'p1' }), makeUnit({ id: 'u2', pilotId: null })]
    expect(selectPilotAssignedUnit(units, 'p1')).toBe(units[0])
  })

  it('returns undefined when pilot is unassigned', () => {
    const units = [makeUnit({ id: 'u1', pilotId: null })]
    expect(selectPilotAssignedUnit(units, 'p1')).toBeUndefined()
  })
})
