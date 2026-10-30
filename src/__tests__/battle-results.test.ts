import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectTrulyDestroyed } from '@/store/selectors'
import { ALL_STEP_IDS } from '@/lib/steps'
import { NO_MARKS, battleDamageState } from '@/lib/battle'
import { opposingTemplate } from '@/lib/opposing-force'
import type { Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

const ATLAS: Unit = {
  id: 'atlas', nameAndVariant: 'Atlas AS7-D', unitType: 'BattleMech', pvAtSkill4: 52, size: 4, ene: false, pilotId: null, totalSpEarned: 0,
  tmm: 1, move: [{ move: 6, type: '' }], armor: 10, structure: 8, damageText: ['5', '5', '2'], abilities: ['IF1'],
}
const MAD_CAT: Unit = { ...ATLAS, id: 'madcat', nameAndVariant: 'Mad Cat Prime', size: 3, armor: 8, structure: 4, abilities: ['CASE'] }

let sortieId = ''
beforeEach(() => {
  store().resetStore()
  act(() => {
    store().addUnit(ATLAS)
    store().addUnit(MAD_CAT)
    sortieId = store().addSortie()
    store().setFielded(sortieId, 'atlas', true)
    store().setFielded(sortieId, 'madcat', true)
  })
})

const sortie = () => store().campaign.sorties.find(s => s.id === sortieId)!
const fielded = (unitId: string) => sortie().fieldedUnits.find(f => f.unitId === unitId)!
function battle(unitId: string, marks: Partial<typeof NO_MARKS>) {
  act(() => {
    store().markBattle(sortieId, unitId, marks)
    store().applyBattle(sortieId, unitId)
  })
}

describe('the Damage State a battle leaves', () => {
  const state = (marks: Partial<typeof NO_MARKS>, unit: Unit = ATLAS) => battleDamageState({ ...NO_MARKS, ...marks }, unit)

  it('is undamaged, armor damage only, or structure damage or criticals', () => {
    expect(state({ heat: 3 })).toBe('undamaged')
    expect(state({ armor: 4 })).toBe('armor')
    expect(state({ armor: 10, structure: 1 })).toBe('structure')
    expect(state({ fireControl: 1 })).toBe('structure')
    expect(state({ ammoHit: true }, MAD_CAT)).toBe('structure')
  })

  it('is crippled or destroyed when the card says so', () => {
    expect(state({ armor: 10, structure: 4 })).toBe('crippled')
    expect(state({ armor: 10, structure: 8 })).toBe('destroyed')
    expect(state({ engine: 2 })).toBe('destroyed')
    expect(state({ ammoHit: true })).toBe('destroyed')
  })
})

describe('filling in After-Sortie step 3 from play mode', () => {
  it('sets each Fielded Unit’s Damage State from its applied marks, so repair costs follow', () => {
    battle('atlas', { armor: 3 })
    battle('madcat', { armor: 8, structure: 2 })

    act(() => store().syncBattleResults(sortieId))

    expect(fielded('atlas').damage).toBe('armor')
    expect(fielded('madcat').damage).toBe('crippled')
  })

  it('ignores pending marks and units with no battle record', () => {
    act(() => {
      store().markBattle(sortieId, 'atlas', { armor: 3 })
      store().syncBattleResults(sortieId)
    })

    expect(fielded('atlas').damage).toBe('undamaged')
    expect(fielded('madcat').damage).toBe('undamaged')
  })

  it('never overwrites a Damage State set by hand', () => {
    battle('atlas', { armor: 10, structure: 8 })
    act(() => {
      store().updateFieldedUnit(sortieId, 'atlas', { damage: 'structure', setByHand: true })
      store().syncBattleResults(sortieId)
    })

    expect(fielded('atlas').damage).toBe('structure')
  })

  it('queues a destroyed unit for its Salvage Check, and an ammo hit without CASE as automatic Truly Destroyed', () => {
    battle('madcat', { armor: 8, structure: 4 })
    battle('atlas', { ammoHit: true })
    act(() => store().syncBattleResults(sortieId))

    expect(fielded('madcat')).toMatchObject({ damage: 'destroyed', autoTrulyDestroyed: null })
    expect(selectTrulyDestroyed(fielded('madcat'))).toBeNull()
    expect(fielded('atlas')).toMatchObject({ damage: 'destroyed', autoTrulyDestroyed: 'ammo' })
    expect(selectTrulyDestroyed(fielded('atlas'))).toBe(true)
  })

  it('sends an automatically Truly Destroyed unit to the Memorial on completion', () => {
    battle('atlas', { ammoHit: true })
    act(() => {
      store().syncBattleResults(sortieId)
      store().updateSortie(sortieId, { primaryObjective: 300 })
      store().updateFieldedUnit(sortieId, 'atlas', { crewRoll: 9 })
      ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true))
      store().completeSortie(sortieId)
    })

    expect(sortie().status).toBe('completed')
    expect(store().campaign.units.map(u => u.id)).toEqual(['madcat'])
    expect(store().campaign.memorial.map(m => [m.name, m.reason])).toEqual([['Atlas AS7-D', 'trulyDestroyed']])
  })

  it('takes nothing from the Opposing Force, and nothing for a Failed Sortie', () => {
    act(() => store().addOpposingCopies(sortieId, opposingTemplate({ ...ATLAS, nameAndVariant: 'Enemy Atlas' }), 1))
    const enemyId = sortie().opposingForce![0].id
    battle(enemyId, { armor: 10, structure: 8 })
    battle('atlas', { armor: 2 })
    act(() => {
      store().updateSortie(sortieId, { outcome: 'failed' })
      store().syncBattleResults(sortieId)
    })
    expect(fielded('atlas').damage).toBe('undamaged')

    act(() => {
      store().updateSortie(sortieId, { outcome: 'victory' })
      store().syncBattleResults(sortieId)
    })
    expect(sortie().fieldedUnits.map(f => f.damage)).toEqual(['armor', 'undamaged'])
  })
})
