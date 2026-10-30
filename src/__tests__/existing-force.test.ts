import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectExistingForceModifier, selectSetupForceErrors, selectSetupPilotErrors, selectWarchestBalance } from '@/store/selectors'
import { existingForceStartingWarchest } from '@/lib/rules'
import type { Campaign, NamedPilot, Sortie, Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function draft() {
  return store().setupDraft!
}

function unit(id: string, pvAtSkill4: number): Unit {
  return { id, nameAndVariant: id, unitType: 'BattleMech', pvAtSkill4, size: 2, ene: false, pilotId: null, totalSpEarned: 0 }
}

// A full sortie as the store makes one, completed with the given fields.
function playedSortie(fields: Partial<Sortie>): Sortie {
  let id = ''
  act(() => { id = store().addSortie() })
  const sortie = store().campaign.sorties.find(x => x.id === id)!
  act(() => store().resetStore())
  return { ...sortie, status: 'completed', outcome: 'victory', ...fields }
}

function pilot(id: string, totalSpEarned: number, overrides: Partial<NamedPilot> = {}): NamedPilot {
  return {
    id, callsign: id, pilotType: 'BattleMech', wounded: false, mvpCount: 1, totalSpEarned,
    spSpentOnSkill: totalSpEarned - 150, spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 30, edgeAbilitiesLearned: [], campaignHistory: [],
    ...overrides,
  }
}

// A finished campaign: 278 PV of units, 230 SP left in the Warchest.
function finishedCampaign(pilots: NamedPilot[] = [pilot('ghost', 900), pilot('rook', 600)]): Campaign {
  return {
    id: 'old', name: 'First Contract', forceName: 'Iron Ravens', commandingOfficer: 'Vance',
    difficultyLevel: 'standard', customPvPercent: 0, customSpPercent: 100, startingWarchest: 230,
    units: [unit('a', 100), unit('b', 90), unit('c', 88)],
    namedPilots: pilots, memorial: [], sorties: [], createdAt: '', updatedAt: '',
  }
}

beforeEach(() => {
  store().resetStore()
})

describe('the Starting Warchest Balance for an Existing Force', () => {
  it('raises a Warchest below 400 SP to 400, then adds 40 SP per unspent PV', () => {
    expect(existingForceStartingWarchest(230, 395)).toBe(600)
    expect(existingForceStartingWarchest(900, 400)).toBe(900)
    expect(existingForceStartingWarchest(900, 450)).toBe(900)
  })

  it('carries over 278 PV and 230 SP, topped up to 395 PV, starts with 600 SP', () => {
    act(() => {
      store().startExistingForceSetup(finishedCampaign())
      store().updateSetup({ name: 'Second Contract' })
      store().addSetupUnit(unit('d', 60))
      store().addSetupUnit(unit('e', 57))
    })

    let started = false
    act(() => { started = store().finishSetup() })
    expect(started).toBe(true)
    expect(store().campaign.name).toBe('Second Contract')
    expect(store().campaign.startingWarchest).toBe(600)
    expect(selectWarchestBalance(store().campaign)).toBe(600)
    expect(store().campaign.units).toHaveLength(5)
    expect(store().campaign.sorties).toEqual([])
  })
})

describe('carrying the force over', () => {
  it('keeps the force and the latest Warchest, with a fresh name and log', () => {
    const old = finishedCampaign()
    const played = playedSortie({ primaryObjective: 300 })
    act(() => store().startExistingForceSetup({ ...old, sorties: [played] }))

    expect(draft().name).toBe('')
    expect(draft().forceName).toBe('Iron Ravens')
    expect(draft().units.map(u => u.id)).toEqual(['a', 'b', 'c'])
    expect(draft().existingForce).toEqual({ fromCampaign: 'First Contract', warchest: selectWarchestBalance({ ...old, sorties: [played] }), unitIds: ['a', 'b', 'c'] })
  })

  it('keeps each Named Pilot’s stats and Total SP Earned, recording SP beyond 150 as Carried-over SP', () => {
    act(() => store().startExistingForceSetup(finishedCampaign()))

    const ghost = draft().pilots.find(p => p.id === 'ghost')!
    expect(ghost).toMatchObject({ totalSpEarned: 900, carriedOverSp: 750, spSpentOnSkill: 750, spSpentOnEdgeTokens: 120, mvpCount: 1 })
    expect(ghost.campaignHistory).toEqual(['First Contract'])

    act(() => { store().finishSetup() })
    expect(store().campaign.namedPilots.find(p => p.id === 'ghost')).toMatchObject({ totalSpEarned: 900, carriedOverSp: 750 })
    expect(store().campaign.existingForceFrom).toBe('First Contract')
  })

  it('needs no further SP allocation for carried pilots, but new pilots still spend 150 SP', () => {
    act(() => {
      store().startExistingForceSetup(finishedCampaign())
      store().addSetupPilot(pilot('kestrel', 150, { spSpentOnSkill: 0, spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 0 }))
    })

    expect(selectSetupPilotErrors(draft())).toEqual(['kestrel has 30 SP left to allocate.'])
  })
})

describe('the force rules for an Existing Force', () => {
  it('skip the new-force minimum and chassis check, but stop added units going over 400 PV', () => {
    act(() => store().startExistingForceSetup(finishedCampaign()))
    expect(selectSetupForceErrors(draft())).toEqual([])

    act(() => store().addSetupUnit(unit('big', 130)))
    expect(selectSetupForceErrors(draft())).toEqual(['Your force is 8 PV over the 400 PV limit.'])
  })

  it('let a force already over 400 PV carry over as it is', () => {
    const old = { ...finishedCampaign(), units: [unit('a', 250), unit('b', 200)] }
    act(() => store().startExistingForceSetup(old))

    expect(selectSetupForceErrors(draft())).toEqual([])
  })
})

describe('the Existing-Force Modifier', () => {
  it('comes from the carried pilots’ combined Total SP Earned', () => {
    act(() => {
      store().startExistingForceSetup(finishedCampaign([pilot('ghost', 1800), pilot('rook', 1300)]))
      store().finishSetup()
    })

    expect(selectExistingForceModifier(store().campaign)).toBe(-10)
  })

  it('changes from the sortie where the pilots reach a new threshold', () => {
    const shares = playedSortie({ pilotShares: [{ pilotId: 'ghost', callsign: 'ghost', status: 'fielded', share: 100, mvp: false }] })
    const campaign = { ...finishedCampaign([pilot('ghost', 1500), pilot('rook', 1450)]), existingForceFrom: 'First Contract' }

    expect(selectExistingForceModifier(campaign)).toBe(0)
    expect(selectExistingForceModifier({ ...campaign, sorties: [shares] })).toBe(-10)
  })
})
