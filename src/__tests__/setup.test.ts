import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectSetupForceErrors, selectSetupPilotErrors, selectWarchestBalance } from '@/store/selectors'
import { setupStartingWarchest } from '@/lib/rules'
import type { NamedPilot, Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function draft() {
  return store().setupDraft!
}

function unit(id: string, pvAtSkill4: number, overrides: Partial<Unit> = {}): Unit {
  return { id, nameAndVariant: id, unitType: 'BattleMech', pvAtSkill4, size: 2, ene: false, pilotId: null, totalSpEarned: 0, ...overrides }
}

function pilot(id: string, overrides: Partial<NamedPilot> = {}): NamedPilot {
  return {
    id, callsign: id, pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: 150,
    spSpentOnSkill: 0, spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 30, edgeAbilitiesLearned: [], campaignHistory: [], ...overrides,
  }
}

// Ten units worth 395 PV, as in the mockup.
const FORCE = [96, 52, 44, 40, 35, 31, 29, 28, 22, 18].map((pv, i) => unit(`u${i}`, pv))

function buildValidDraft() {
  act(() => {
    store().startSetup()
    store().updateSetup({ name: 'Ashfall Contract', forceName: 'Iron Ravens', difficultyLevel: 'veteran', chassisConfirmed: true })
    FORCE.forEach(u => store().addSetupUnit(u))
    ;['ghost', 'rook', 'ash', 'kestrel'].forEach(id => store().addSetupPilot(pilot(id)))
  })
}

beforeEach(() => {
  store().resetStore()
})

describe('the Starting Warchest Balance', () => {
  it('is 400 SP plus 40 SP per unspent PV (395 PV → 600 SP)', () => {
    expect(setupStartingWarchest(395)).toBe(600)
    expect(setupStartingWarchest(400)).toBe(400)
  })
})

describe('the force rules', () => {
  it('pass for the mockup force', () => {
    buildValidDraft()

    expect(selectSetupForceErrors(draft())).toEqual([])
  })

  it('block more than 400 PV, fewer than 8 units, and an unconfirmed chassis check', () => {
    act(() => {
      store().startSetup()
      store().addSetupUnit(unit('big', 401))
    })

    expect(selectSetupForceErrors(draft())).toEqual([
      'Your force is 1 PV over the 400 PV limit.',
      'Your force needs at least 8 units (it has 1).',
      'Confirm the chassis rule.',
    ])
  })
})

describe('the Named Pilot rules', () => {
  it('need 2 to 6 pilots, each with a callsign and exactly 150 SP allocated', () => {
    act(() => {
      store().startSetup()
      store().addSetupPilot(pilot('ghost', { spSpentOnEdgeAbilities: 0 }))
    })

    expect(selectSetupPilotErrors(draft())).toEqual([
      'Create at least 2 Named Pilots.',
      'ghost has 30 SP left to allocate.',
    ])

    act(() => store().updateSetupPilot('ghost', { callsign: ' ' }))
    expect(selectSetupPilotErrors(draft())).toContain('Every Named Pilot needs a callsign.')
  })

  it('stop at six pilots', () => {
    act(() => {
      store().startSetup()
      for (let i = 0; i < 7; i++) store().addSetupPilot(pilot(`p${i}`))
    })

    expect(draft().pilots).toHaveLength(6)
  })
})

describe('the setup draft', () => {
  it('is kept when you leave, so Start New Campaign resumes it', () => {
    act(() => {
      store().startSetup()
      store().updateSetup({ name: 'Half done', step: 2 })
    })

    act(() => store().startSetup())

    expect(draft()).toMatchObject({ name: 'Half done', step: 2 })
  })

  it('is thrown away by Cancel', () => {
    act(() => {
      store().startSetup()
      store().cancelSetup()
    })

    expect(store().setupDraft).toBeNull()
  })
})

describe('starting the campaign', () => {
  it('replaces the browser campaign with the new one and clears the draft', () => {
    act(() => store().updateCampaignMeta({ name: 'Old campaign' }))
    buildValidDraft()

    let ok = false
    act(() => { ok = store().finishSetup() })

    const c = store().campaign
    expect(ok).toBe(true)
    expect(c).toMatchObject({ name: 'Ashfall Contract', forceName: 'Iron Ravens', difficultyLevel: 'veteran', startingWarchest: 600, sorties: [], memorial: [] })
    expect(c.units.map(u => u.pvAtSkill4)).toEqual(FORCE.map(u => u.pvAtSkill4))
    expect(c.namedPilots.map(p => p.callsign)).toEqual(['ghost', 'rook', 'ash', 'kestrel'])
    expect(selectWarchestBalance(c)).toBe(600)
    expect(store().setupDraft).toBeNull()
  })

  it('refuses while any rule is broken', () => {
    act(() => {
      store().startSetup()
      store().updateSetup({ name: 'Too small' })
    })

    let ok = true
    act(() => { ok = store().finishSetup() })

    expect(ok).toBe(false)
    expect(store().campaign.name).toBe('')
  })
})
