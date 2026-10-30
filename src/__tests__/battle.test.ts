import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { ALL_STEP_IDS } from '@/lib/steps'
import {
  NO_MARKS, ammoHitEffect, battleDamageState, cardReadout, hasPending, motiveRollModifier, shownMarks, sideSummary, tapPip, trulyDestroyedCause,
  unitBattle, withMotiveCount, edgeTokensLeft, specialCounter, withSpecialUse,
} from '@/lib/battle'
import { opposingTemplate } from '@/lib/opposing-force'
import type { Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

// An Atlas AS7-D as picked from the unit list.
const ATLAS: Unit = {
  id: 'atlas', nameAndVariant: 'Atlas AS7-D', unitType: 'BattleMech', pvAtSkill4: 52, size: 4, ene: false, pilotId: null, totalSpEarned: 0,
  tmm: 1, move: [{ move: 6, type: '' }], armor: 10, structure: 8, damage: { short: 5, medium: 5, long: 2, extreme: 0 },
  damageText: ['5', '5', '2'], overheat: 0, abilities: ['IF1'],
}
const ELEMENTAL: Unit = {
  ...ATLAS, id: 'elemental', nameAndVariant: 'Elemental', unitType: 'Battle Armor', size: 1, tmm: 2,
  move: [{ move: 2, type: '' }, { move: 6, type: 'j' }], armor: 2, structure: 2, damageText: ['2', '1', '0*'],
}

let sortieId = ''
beforeEach(() => {
  store().resetStore()
  act(() => {
    store().addUnit(ATLAS)
    store().addUnit(ELEMENTAL)
    sortieId = store().addSortie()
    store().setFielded(sortieId, 'atlas', true)
    store().setFielded(sortieId, 'elemental', true)
  })
})

function record(unitId = 'atlas') {
  return unitBattle(store().campaign.sorties.find(s => s.id === sortieId)!.battle, unitId)
}
function battle() {
  return store().campaign.sorties.find(s => s.id === sortieId)!.battle
}

describe('tapping pips', () => {
  it('marks an unmarked pip with those before it, and unmarks a marked pip with those after it', () => {
    expect(tapPip(0, 2)).toBe(3)
    expect(tapPip(3, 2)).toBe(2)
    expect(tapPip(3, 0)).toBe(0)
    expect(tapPip(3, 5)).toBe(6)
  })
})

describe('pending changes', () => {
  it('stay pending until Apply, then become committed', () => {
    act(() => store().markBattle(sortieId, 'atlas', { armor: 3 }))
    expect(hasPending(record())).toBe(true)
    expect(record().committed.armor).toBe(0)
    expect(shownMarks(record()).armor).toBe(3)

    act(() => store().applyBattle(sortieId, 'atlas'))
    expect(hasPending(record())).toBe(false)
    expect(record().committed.armor).toBe(3)
  })

  it('are cleared when unmarked back to the committed marks, or discarded', () => {
    act(() => {
      store().markBattle(sortieId, 'atlas', { armor: 2 })
      store().markBattle(sortieId, 'atlas', { armor: 0 })
    })
    expect(hasPending(record())).toBe(false)

    act(() => {
      store().markBattle(sortieId, 'atlas', { armor: 4, structure: 1 })
      store().discardBattle(sortieId, 'atlas')
    })
    expect(record().committed).toEqual(NO_MARKS)
    expect(hasPending(record())).toBe(false)
  })

  it('End Round commits every unit and starts the next round', () => {
    act(() => {
      store().markBattle(sortieId, 'atlas', { armor: 2 })
      store().markBattle(sortieId, 'elemental', { armor: 1 })
      store().endRound(sortieId)
    })

    expect(battle()!.round).toBe(2)
    expect(record('atlas').committed.armor).toBe(2)
    expect(record('elemental').committed.armor).toBe(1)
    expect(hasPending(record('atlas'))).toBe(false)
  })
})

describe('destroyed units', () => {
  it('are destroyed when their structure is gone, noting the round', () => {
    act(() => {
      store().endRound(sortieId)
      store().markBattle(sortieId, 'elemental', { armor: 2, structure: 2 })
      store().applyBattle(sortieId, 'elemental')
    })

    expect(record('elemental').destroyedRound).toBe(2)
    expect(cardReadout(ELEMENTAL, record('elemental').committed, 4).destroyed).toBe(true)
  })

  it('can be marked destroyed by hand, and un-marked again', () => {
    act(() => {
      store().markBattle(sortieId, 'atlas', { destroyed: true })
      store().applyBattle(sortieId, 'atlas')
    })
    expect(record().destroyedRound).toBe(1)

    act(() => {
      store().markBattle(sortieId, 'atlas', { destroyed: false })
      store().applyBattle(sortieId, 'atlas')
    })
    expect(record().destroyedRound).toBeUndefined()
  })
})

describe('the battle record', () => {
  it('is kept through complete and reopen, and is read-only once completed', () => {
    act(() => {
      store().markBattle(sortieId, 'atlas', { armor: 5 })
      store().setBattleNotes(sortieId, 'atlas', 'Behind the spire')
      store().endRound(sortieId)
      ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true))
      store().completeSortie(sortieId)
      store().markBattle(sortieId, 'atlas', { armor: 8 })
    })
    expect(record().committed.armor).toBe(5)
    expect(record().notes).toBe('Behind the spire')

    act(() => store().reopenSortie(sortieId))
    expect(record().committed.armor).toBe(5)
    expect(battle()!.round).toBe(2)
  })
})

describe('the card readout', () => {
  it('shows move, Sprint (half again the ground move), TMM, damage and to-hit (Skill + range)', () => {
    expect(cardReadout(ATLAS, record().committed, 3)).toEqual({
      move: '6"', sprint: '9"', tmm: 1,
      damage: [{ range: 'S', text: '5', toHit: 3 }, { range: 'M', text: '5', toHit: 5 }, { range: 'L', text: '2', toHit: 7 }],
      armorLeft: 10, structureLeft: 8, destroyed: false, shutdown: false, crippled: false, missingStats: false,
      baseMove: '6"',
    })
  })

  it('keeps minimal damage as 0* and lists every movement mode', () => {
    const readout = cardReadout(ELEMENTAL, { ...NO_MARKS, armor: 1 }, 4)

    expect(readout.move).toBe('2"/6"j')
    expect(readout.damage.map(d => d.text)).toEqual(['2', '1', '0*'])
    expect(readout.armorLeft).toBe(1)
  })

  it('flags a custom unit with no armor or structure', () => {
    const custom: Unit = { id: 'c', nameAndVariant: 'Custom', unitType: 'BattleMech', pvAtSkill4: 30, size: 2, ene: false, pilotId: null, totalSpEarned: 0 }

    expect(cardReadout(custom, record().committed, 4).missingStats).toBe(true)
  })
})

describe('older units', () => {
  it('show ground move when a move entry has no movement type', () => {
    const older = { ...ATLAS, move: [{ move: 8 } as unknown as { move: number; type: string }] }

    expect(cardReadout(older, NO_MARKS, 4).move).toBe('8"')
  })
})

// An Atlas with jump jets and a Mad Cat at heat, for the 'Mech rules (#43).
const MAD_CAT: Unit = { ...ATLAS, id: 'madcat', nameAndVariant: 'Mad Cat Prime', tmm: 2, move: [{ move: 10, type: '' }], armor: 8, structure: 4, damageText: ['5', '5', '4'], abilities: ['CASE', 'IF2'] }
const JUMPER: Unit = { ...ATLAS, id: 'jumper', tmm: 2, move: [{ move: 10, type: '' }, { move: 8, type: 'j' }], abilities: [] }
const marks = (change: Partial<typeof NO_MARKS>) => ({ ...NO_MARKS, ...change })

describe("heat on a 'Mech", () => {
  it('costs 2" of ground move per level, −1 TMM from heat 2, and adds to to-hit', () => {
    expect(cardReadout(MAD_CAT, marks({ heat: 1 }), 3)).toMatchObject({ move: '8"', baseMove: '10"', tmm: 2, damage: [{ toHit: 4 }, { toHit: 6 }, { toHit: 8 }] })
    expect(cardReadout(MAD_CAT, marks({ heat: 2 }), 3)).toMatchObject({ move: '6"', tmm: 1, damage: [{ toHit: 5 }, { toHit: 7 }, { toHit: 9 }] })
  })

  it('leaves jump move alone', () => {
    expect(cardReadout(JUMPER, marks({ heat: 2 }), 4).move).toBe('6"/8"j')
  })

  it('shuts the unit down at S: no move, TMM −4', () => {
    expect(cardReadout(MAD_CAT, marks({ heat: 4 }), 4)).toMatchObject({ move: '0"', sprint: '0"', tmm: -4, shutdown: true, crippled: false })
  })

  it('does nothing to vehicles, battle armor or infantry', () => {
    expect(cardReadout(ELEMENTAL, marks({ heat: 3, fireControl: 2 }), 4).damage[0].toHit).toBe(4)
  })
})

describe("'Mech critical hits", () => {
  it('fire control: +2 to-hit each', () => {
    expect(cardReadout(MAD_CAT, marks({ fireControl: 2 }), 4).damage.map(d => d.toHit)).toEqual([8, 10, 12])
  })

  it('MP: halves move (at least 2" lost) and TMM (at least 1 lost) each, on every movement mode', () => {
    expect(cardReadout(JUMPER, marks({ mp: 1 }), 4)).toMatchObject({ move: '5"/4"j', tmm: 1 })
    expect(cardReadout(JUMPER, marks({ mp: 2 }), 4)).toMatchObject({ move: '2"/2"j', tmm: 0 })
    expect(cardReadout(ATLAS, marks({ mp: 3 }), 4).move).toBe('0"')
  })

  it('weapons: −1 damage each, through 0* to 0', () => {
    expect(cardReadout(MAD_CAT, marks({ weapons: 1 }), 4).damage.map(d => d.text)).toEqual(['4', '4', '3'])
    expect(cardReadout(ATLAS, marks({ weapons: 2 }), 4).damage.map(d => d.text)).toEqual(['3', '3', '0*'])
    expect(cardReadout(ATLAS, marks({ weapons: 3 }), 4).damage.map(d => d.text)).toEqual(['2', '2', '0'])
    expect(cardReadout(ELEMENTAL, marks({}), 4).damage[2].text).toBe('0*')
  })

  it('engine: the second hit destroys the unit', () => {
    expect(cardReadout(MAD_CAT, marks({ engine: 1 }), 4).destroyed).toBe(false)
    expect(cardReadout(MAD_CAT, marks({ engine: 2 }), 4).destroyed).toBe(true)
  })

  it('ammo: destroys a unit without CASE, CASEII or ENE as an automatic Truly Destroyed case', () => {
    expect(trulyDestroyedCause(marks({ ammoHit: true }), ATLAS)).toBe('ammo')
    expect(cardReadout(ATLAS, marks({ ammoHit: true }), 4).destroyed).toBe(true)
    expect(trulyDestroyedCause(marks({ ammoHit: true }), MAD_CAT)).toBeNull()
    expect(ammoHitEffect(MAD_CAT)).toBe('Has CASE: 1 extra damage')
    expect(ammoHitEffect({ ...ATLAS, abilities: ['ENE'] })).toBe('No effect (CASEII or ENE)')
    expect(ammoHitEffect(ATLAS)).toBe('No CASE: destroyed')
  })
})

describe('crippled (Alpha Strike Forced Withdrawal)', () => {
  it('when armor is gone and structure is at half or less', () => {
    expect(cardReadout(MAD_CAT, marks({ armor: 8, structure: 1 }), 4).crippled).toBe(false)
    expect(cardReadout(MAD_CAT, marks({ armor: 8, structure: 2 }), 4).crippled).toBe(true)
  })

  it('when every damage value is reduced to 0', () => {
    expect(cardReadout(MAD_CAT, marks({ weapons: 4 }), 4).crippled).toBe(false)
    expect(cardReadout({ ...MAD_CAT, damageText: ['2', '1', '1'] }, marks({ weapons: 4 }), 4).crippled).toBe(true)
  })

  it('when damage leaves it unable to move (but not when merely shut down)', () => {
    expect(cardReadout(ATLAS, marks({ mp: 3 }), 4).crippled).toBe(true)
    expect(cardReadout(ATLAS, marks({ heat: 4 }), 4).crippled).toBe(false)
  })
})

describe('older battle records', () => {
  it('saved before heat and crits read as having none', () => {
    const old = { round: 1, units: { atlas: { committed: { armor: 2, structure: 0, destroyed: false }, notes: '' } } }

    expect(unitBattle(old as never, 'atlas').committed).toEqual({ ...NO_MARKS, armor: 2 })
  })
})

describe('the Opposing Force in play mode (#42)', () => {
  const enemy = () => store().campaign.sorties.find(s => s.id === sortieId)!.opposingForce![0]

  beforeEach(() => {
    act(() => store().addOpposingCopies(sortieId, opposingTemplate({ ...ELEMENTAL, nameAndVariant: 'Elemental' }, 3), 1))
  })

  it('marks enemy cards like Fielded Units, and End Round commits both sides', () => {
    act(() => {
      store().markBattle(sortieId, enemy().id, { armor: 2, structure: 2 })
      store().markBattle(sortieId, 'atlas', { armor: 1 })
      store().endRound(sortieId)
    })

    expect(record(enemy().id).committed).toMatchObject({ armor: 2, structure: 2 })
    expect(record(enemy().id).destroyedRound).toBe(1)
    expect(record('atlas').committed.armor).toBe(1)
  })

  it('Discard all drops pending marks on both sides', () => {
    act(() => {
      store().markBattle(sortieId, enemy().id, { armor: 1 })
      store().markBattle(sortieId, 'atlas', { armor: 1 })
      store().discardAllBattle(sortieId)
    })

    expect(hasPending(record(enemy().id))).toBe(false)
    expect(hasPending(record('atlas'))).toBe(false)
  })

  it('summarises each side: active, crippled, destroyed and pending', () => {
    act(() => {
      store().markBattle(sortieId, 'elemental', { armor: 2, structure: 2 })
      store().markBattle(sortieId, 'atlas', { armor: 10, structure: 4 })
      store().applyBattle(sortieId, 'elemental')
      store().applyBattle(sortieId, 'atlas')
      store().markBattle(sortieId, 'atlas', { heat: 1 })
    })
    const cards = [ATLAS, ELEMENTAL].map(unit => ({ unit, record: record(unit.id), skill: 4 }))

    expect(sideSummary(cards)).toEqual({ active: 1, crippled: 1, destroyed: 1, pending: 1 })
  })

  it('never changes the Player Force or the books', () => {
    const before = { units: store().campaign.units, fielded: store().campaign.sorties[0].fieldedUnits }
    act(() => {
      store().markBattle(sortieId, enemy().id, { armor: 2, structure: 2 })
      store().endRound(sortieId)
    })

    expect(store().campaign.units).toEqual(before.units)
    expect(store().campaign.sorties[0].fieldedUnits).toEqual(before.fielded)
  })
})

// A tracked medium tank: 10"t, TMM 2, damage 2/2/0*, armor 4, structure 2 (#44).
const TANK: Unit = {
  ...ATLAS, id: 'tank', nameAndVariant: 'Vedette Medium Tank', unitType: 'Combat Vehicle', size: 2, tmm: 2,
  move: [{ move: 10, type: 't' }], armor: 4, structure: 2, damageText: ['2', '2', '0*'], abilities: [],
}

describe('vehicle critical hits and motive damage', () => {
  it('engine: halves move, TMM and damage (rounded down); the second hit destroys', () => {
    expect(cardReadout(TANK, marks({ engine: 1 }), 4)).toMatchObject({ move: '5"t', tmm: 1, destroyed: false })
    expect(cardReadout(TANK, marks({ engine: 1 }), 4).damage.map(d => d.text)).toEqual(['1', '1', '0*'])
    expect(cardReadout(TANK, marks({ engine: 2 }), 4).destroyed).toBe(true)
  })

  it('fire control and weapons work as for ’Mechs', () => {
    expect(cardReadout(TANK, marks({ fireControl: 1, weapons: 1 }), 4).damage).toEqual([
      { range: 'S', text: '1', toHit: 6 }, { range: 'M', text: '1', toHit: 8 }, { range: 'L', text: '0', toHit: 10 },
    ])
  })

  it('motive −2": −2" move and −1 TMM each', () => {
    expect(cardReadout(TANK, marks({ motive: ['minus2', 'minus2'] }), 4)).toMatchObject({ move: '6"t', baseMove: '10"t', tmm: 0 })
  })

  it('motive half: halves move (at least 2" lost) and TMM (at least 1 lost) each', () => {
    expect(cardReadout(TANK, marks({ motive: ['half'] }), 4)).toMatchObject({ move: '5"t', tmm: 1 })
    expect(cardReadout(TANK, marks({ motive: ['half', 'half'] }), 4)).toMatchObject({ move: '3"t', tmm: 0 })
  })

  it('applies motive hits in the order they happened', () => {
    expect(cardReadout(TANK, marks({ motive: ['minus2', 'half'] }), 4).move).toBe('4"t')
    expect(cardReadout(TANK, marks({ motive: ['half', 'minus2'] }), 4).move).toBe('3"t')
  })

  it('immobilized: no move, TMM −4, and crippled', () => {
    expect(cardReadout(TANK, marks({ immobilized: true }), 4)).toMatchObject({ move: '0"t', tmm: -4, crippled: true })
  })

  it('ignores heat and ’Mech-only tracks on vehicles, and ’Mechs ignore motive damage', () => {
    expect(cardReadout(TANK, marks({ heat: 2, mp: 2 }), 4)).toMatchObject({ move: '10"t', tmm: 2 })
    expect(cardReadout(ATLAS, marks({ motive: ['half'], immobilized: true }), 4)).toMatchObject({ move: '6"', tmm: 1 })
  })

  it('counts motive damage as structure damage or criticals for repairs', () => {
    expect(battleDamageState(marks({ motive: ['minus2'] }), TANK)).toBe('structure')
  })
})

describe('marking motive pips', () => {
  it('adds hits at the end and removes the latest of that kind, keeping the order', () => {
    expect(withMotiveCount(['half'], 'minus2', 2)).toEqual(['half', 'minus2', 'minus2'])
    expect(withMotiveCount(['minus2', 'half', 'minus2'], 'minus2', 1)).toEqual(['minus2', 'half'])
    expect(withMotiveCount(['minus2', 'half'], 'half', 0)).toEqual(['minus2'])
  })

  it('reads the motive roll modifier from the movement type', () => {
    expect(motiveRollModifier(TANK)).toBe('tracked +0')
    expect(motiveRollModifier({ move: [{ move: 12, type: 'h' }] })).toBe('hover +1')
    expect(motiveRollModifier({ move: [{ move: 14, type: 'v' }] })).toBe('VTOL +2')
  })

  it('treats pending motive hits like any other mark', () => {
    act(() => {
      store().addUnit(TANK)
      store().setFielded(sortieId, 'tank', true)
      store().markBattle(sortieId, 'tank', { motive: ['half'] })
    })
    expect(hasPending(record('tank'))).toBe(true)

    act(() => store().markBattle(sortieId, 'tank', { motive: [] }))
    expect(hasPending(record('tank'))).toBe(false)
  })
})

describe('Edge tokens in play (#45)', () => {
  beforeEach(() => {
    act(() => {
      store().addPilot({ id: 'ghost', callsign: 'Ghost', pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: 150, spSpentOnSkill: 0, spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 30, edgeAbilitiesLearned: [], campaignHistory: [] })
      store().assignFieldedPilot(sortieId, 'atlas', 'ghost')
    })
  })

  it('are spent like any other mark: pending, applied, and undone by unmarking', () => {
    act(() => store().markBattle(sortieId, 'atlas', { edgeSpent: 2 }))
    expect(hasPending(record())).toBe(true)

    act(() => store().applyBattle(sortieId, 'atlas'))
    expect(record().committed.edgeSpent).toBe(2)

    act(() => {
      store().markBattle(sortieId, 'atlas', { edgeSpent: 1 })
      store().applyBattle(sortieId, 'atlas')
    })
    expect(record().committed.edgeSpent).toBe(1)
  })

  it('leave the tokens left never below zero', () => {
    expect(edgeTokensLeft(3, 1)).toBe(2)
    expect(edgeTokensLeft(3, 5)).toBe(0)
  })

  it('are kept through complete and reopen, and leave the pilot’s SP and stats unchanged', () => {
    const pilotBefore = store().campaign.namedPilots[0]
    act(() => {
      store().markBattle(sortieId, 'atlas', { edgeSpent: 3 })
      store().endRound(sortieId)
      ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true))
      store().completeSortie(sortieId)
    })
    expect(store().campaign.sorties[0].status).toBe('completed')
    expect(record().committed.edgeSpent).toBe(3)

    act(() => store().reopenSortie(sortieId))
    expect(record().committed.edgeSpent).toBe(3)
    expect(store().campaign.namedPilots[0]).toMatchObject({
      totalSpEarned: pilotBefore.totalSpEarned, spSpentOnEdgeTokens: pilotBefore.spSpentOnEdgeTokens,
    })
  })

  it('do not count as damage', () => {
    expect(battleDamageState({ ...NO_MARKS, edgeSpent: 2 }, ATLAS)).toBe('undamaged')
  })
})

describe('specials during play (#55)', () => {
  it('recognises consumables with a count, and exhaustible specials', () => {
    expect(specialCounter('BOMB2')).toEqual({ kind: 'uses', max: 2 })
    expect(specialCounter('MDS12')).toEqual({ kind: 'uses', max: 12 })
    expect(specialCounter('FUEL4')).toEqual({ kind: 'uses', max: 4 })
    expect(specialCounter('TSEMP-O1')).toEqual({ kind: 'uses', max: 1 })
    expect(specialCounter('RHS')).toEqual({ kind: 'exhaust' })
    expect(specialCounter('ECS')).toEqual({ kind: 'exhaust' })
    expect(specialCounter('TSEMP1')).toBeNull()
    expect(specialCounter('IF2')).toBeNull()
  })

  it('count uses up and down, never below zero or past the limit', () => {
    let used = withSpecialUse({}, 'BOMB2', 1)
    used = withSpecialUse(used, 'BOMB2', 1)
    used = withSpecialUse(used, 'BOMB2', 1)
    expect(used).toEqual({ BOMB2: 2 })
    expect(withSpecialUse(withSpecialUse({}, 'RHS', 1), 'RHS', 1)).toEqual({ RHS: 1 })
    expect(withSpecialUse({ BOMB2: 1 }, 'BOMB2', -1)).toEqual({})
    expect(withSpecialUse({}, 'BOMB2', -1)).toEqual({})
    expect(withSpecialUse({}, 'IF2', 1)).toEqual({})
  })

  it('are pending like any other mark, kept through Apply, and don’t count as damage', () => {
    act(() => store().markBattle(sortieId, 'atlas', { specialsUsed: { BOMB2: 1 } }))
    expect(hasPending(record())).toBe(true)

    act(() => store().markBattle(sortieId, 'atlas', { specialsUsed: {} }))
    expect(hasPending(record())).toBe(false)

    act(() => {
      store().markBattle(sortieId, 'atlas', { specialsUsed: { BOMB2: 2 } })
      store().applyBattle(sortieId, 'atlas')
    })
    expect(record().committed.specialsUsed).toEqual({ BOMB2: 2 })
    expect(battleDamageState(record().committed, ATLAS)).toBe('undamaged')
  })
})
