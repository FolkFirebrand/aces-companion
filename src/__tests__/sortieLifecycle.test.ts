import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import {
  selectCampaignLog, selectCompletionBlockers, selectReopenBlocker, selectSortieSteps, selectWarchestBalance,
} from '@/store/selectors'
import { ALL_STEP_IDS, SETUP_STEP_IDS } from '@/lib/steps'
import { CAMPAIGN_SCHEMA_VERSION, UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import type { Sortie, Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

function sortie(id: string): Sortie {
  return store().campaign.sorties.find(s => s.id === id)!
}

function unit(id: string, overrides: Partial<Unit> = {}): Unit {
  return {
    id, nameAndVariant: `Unit ${id}`, unitType: 'BattleMech', pvAtSkill4: 30, pilotId: null,
    totalSpEarned: 0, size: 2, ene: false, ...overrides,
  }
}

function startSortie(fields: Partial<Sortie> = {}): string {
  let id = ''
  act(() => {
    id = store().addSortie()
    store().updateSortie(id, fields)
  })
  return id
}

function finishAllSteps(id: string, stepIds = ALL_STEP_IDS) {
  act(() => stepIds.forEach(step => store().setStepDone(id, step, true)))
}

function complete(id: string) {
  act(() => store().completeSortie(id))
}

beforeEach(() => {
  store().resetStore()
  act(() => {
    store().addUnit(unit('u1'))
    store().addUnit(unit('u2', { pvAtSkill4: 18, unitType: 'Combat Vehicle' }))
    store().addUnit(unit('u3', { pvAtSkill4: 40, size: 3 }))
  })
})

describe('the checklists', () => {
  it('list the book\'s Sortie Setup Steps and After-Sortie Steps in order', () => {
    const id = startSortie()

    const steps = selectSortieSteps(sortie(id))

    expect(steps.map(s => `${s.section} ${s.number} ${s.name}`)).toEqual([
      'setup 1 Record Campaign Log',
      'setup 2 Read Story and Briefing',
      'setup 3 Perform Reconnaissance',
      'setup 4 Set Up the Play Area',
      'setup 5 Player Force',
      'setup 6 Opposing Force',
      'setup 7 Special Rules, Orders and Tokens',
      'after 1 Trigger Game-End Waypoints',
      'after 2 Read Sortie Outcome',
      'after 3 Check for Casualties',
      'after 4 Calculate Income and Expenses',
      'after 5 Improving Named Pilots',
      'after 6 Purchase Additional Units',
      'after 7 Next Steps',
    ])
  })

  it('names the steps still to do before a sortie can be completed', () => {
    const id = startSortie()
    finishAllSteps(id, ALL_STEP_IDS.filter(s => s !== 'after-3' && s !== 'after-7'))

    expect(selectCompletionBlockers(sortie(id))).toEqual(['Check for Casualties', 'Next Steps'])
  })

  it('needs only the setup steps for a Failed Sortie, which skips the after-sortie steps', () => {
    const id = startSortie({ outcome: 'failed' })
    finishAllSteps(id, SETUP_STEP_IDS)

    expect(selectCompletionBlockers(sortie(id))).toEqual([])
  })
})

describe('drafts', () => {
  it('do not change the Warchest until completed', () => {
    const id = startSortie({ primaryObjective: 500 })

    expect(selectCampaignLog(store().campaign)[0]).toMatchObject({ status: 'draft', counts: false })
    expect(selectWarchestBalance(store().campaign)).toBe(400)

    finishAllSteps(id)
    complete(id)

    expect(selectWarchestBalance(store().campaign)).toBe(900)
  })

  it('cannot be completed while steps remain', () => {
    const id = startSortie({ primaryObjective: 500 })

    complete(id)

    expect(sortie(id).status).toBe('draft')
  })

  it('are continued rather than duplicated when logging a sortie', () => {
    const first = startSortie()
    let second = ''
    act(() => { second = store().addSortie() })

    expect(second).toBe(first)
    expect(store().campaign.sorties).toHaveLength(1)
  })
})

describe('completing a sortie', () => {
  it('adds bought units, removes sold units and applies OMNI changes to the Player Force', () => {
    const id = startSortie()
    act(() => {
      store().buyUnit(id, unit('new', { nameAndVariant: 'Warden WR-3', pvAtSkill4: 31 }))
      store().sellUnit(id, 'u2')
      store().reconfigureOmni(id, 'u1', 'Unit u1 Prime B', 26)
    })
    finishAllSteps(id)

    complete(id)

    const units = store().campaign.units
    expect(units.map(u => u.id)).toEqual(['u1', 'u3', 'new'])
    expect(units[0]).toMatchObject({ nameAndVariant: 'Unit u1 Prime B', pvAtSkill4: 26 })
    expect(sortie(id).status).toBe('completed')
  })

  it('prices purchases by the book: buy PV × 40, sell PV × 20, OMNI Size × 5 or PV difference × 40', () => {
    const id = startSortie()
    act(() => {
      store().buyUnit(id, unit('new', { pvAtSkill4: 31 }))
      store().sellUnit(id, 'u2')
      store().reconfigureOmni(id, 'u1', 'Cheaper variant', 26)
      store().reconfigureOmni(id, 'u3', 'Pricier variant', 43)
    })

    expect(sortie(id).purchases.map(p => p.spCost)).toEqual([1240, -360, 10, 120])
  })

  it('records net Purchases on the Campaign Log', () => {
    const id = startSortie({ primaryObjective: 2000 })
    act(() => {
      store().buyUnit(id, unit('new', { pvAtSkill4: 31 }))
      store().sellUnit(id, 'u2')
    })
    finishAllSteps(id)
    complete(id)

    const [row] = selectCampaignLog(store().campaign)
    expect(row.purchases).toBe(1240 - 360)
    expect(row.warchest).toBe(400 + 2000 - 880)
  })

  it('changes nothing for a Failed Sortie', () => {
    const id = startSortie({ outcome: 'failed' })
    act(() => store().buyUnit(id, unit('new')))
    finishAllSteps(id, SETUP_STEP_IDS)

    complete(id)

    expect(sortie(id).status).toBe('completed')
    expect(store().campaign.units.map(u => u.id)).toEqual(['u1', 'u2', 'u3'])
  })
})

describe('reopening a sortie', () => {
  it('reverts everything completing it applied', () => {
    const before = store().campaign.units
    const id = startSortie()
    act(() => {
      store().buyUnit(id, unit('new'))
      store().sellUnit(id, 'u2')
      store().reconfigureOmni(id, 'u3', 'Variant B', 44)
    })
    finishAllSteps(id)
    complete(id)

    act(() => store().reopenSortie(id))

    expect(store().campaign.units).toEqual(before)
    expect(sortie(id).status).toBe('draft')
  })

  it('is only allowed for the latest sortie', () => {
    const first = startSortie()
    finishAllSteps(first)
    complete(first)
    const second = startSortie()

    expect(selectReopenBlocker(store().campaign, first)).toBe('Only the latest sortie can be reopened.')
    act(() => store().reopenSortie(first))
    expect(sortie(first).status).toBe('completed')

    finishAllSteps(second)
    complete(second)
    expect(selectReopenBlocker(store().campaign, second)).toBeNull()
  })

  it('is not offered for a draft', () => {
    const id = startSortie()

    expect(selectReopenBlocker(store().campaign, id)).toBe('This sortie is not completed.')
  })
})

describe('upgrading version 4 saves', () => {
  it('treats every logged sortie as completed, with its old purchases as buys never applied', () => {
    const v4 = {
      campaign: {
        id: 'c1', units: [], namedPilots: [], memorial: [],
        sorties: [{ id: 's1', sortieNumber: '01', purchases: [{ id: 'p1', unitName: 'Old buy', pvAtSkill4: 10, spCost: 400 }] }],
      },
    }

    const { campaign } = runUpgrades(v4, 4, CAMPAIGN_SCHEMA_VERSION, UPGRADE_STEPS)
    const [s] = campaign.sorties as Record<string, unknown>[]

    expect(s).toMatchObject({ status: 'completed', reconnaissanceNote: '', appliedEffects: null })
    expect(s.stepsDone).toEqual(ALL_STEP_IDS)
    expect(s.purchases).toEqual([
      { id: 'p1', kind: 'buy', spCost: 400, unit: expect.objectContaining({ nameAndVariant: 'Old buy', pvAtSkill4: 10 }) },
    ])
  })
})
