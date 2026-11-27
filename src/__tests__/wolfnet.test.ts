import { checkDeployment, checkForce, forcePv, marginOfVictory, pvAtSkill, sideStanding, unitFromListEntry } from '@/lib/wolfnet/rules'
import { newMatchCode, normalizeMatchCode } from '@/lib/wolfnet/codes'
import { rollScenario, standUpFightPoints } from '@/lib/wolfnet/scenarios'
import { publicSide } from '@/lib/wolfnet/sync'
import { useWolfnetStore } from '@/store/wolfnet'
import type { UnitListEntry, UnitListFaction } from '@/lib/unit-list/convert'
import type { WnForce, WnSide, WnUnit } from '@/lib/wolfnet/types'

function entry(over: Partial<UnitListEntry> = {}): UnitListEntry {
  return {
    id: 'Atlas AS7-D', chassis: 'Atlas', model: 'AS7-D', type: 'BM', pv: 30, size: 4, tmm: 1, move: { '': 6 },
    armor: 10, structure: 8, damage: ['5', '5', '2'], ov: 0, specials: [], ...over,
  }
}

let n = 0
function unit(over: Partial<UnitListEntry> = {}, skill = 4): WnUnit {
  return { ...unitFromListEntry(entry(over), `u${++n}`), skill }
}

function force(units: WnUnit[], over: Partial<WnForce> = {}): WnForce {
  return { id: 'f', name: 'Test', era: 5, faction: 'Clan Wolf', generalList: null, units, artillery: [], deployments: [], createdAt: '', updatedAt: '', ...over }
}

describe('PV at Skill', () => {
  it('adds 20% of the Skill 4 PV per level better, rounded, at least 1', () => {
    expect(pvAtSkill(43, 3)).toBe(52)
    expect(pvAtSkill(5, 2)).toBe(7)
    expect(pvAtSkill(6, 3)).toBe(7)
  })
  it('takes 10% off per level worse, at least 1', () => {
    expect(pvAtSkill(20, 6)).toBe(16)
    expect(pvAtSkill(10, 5)).toBe(9)
    expect(pvAtSkill(30, 4)).toBe(30)
  })
})

describe('Force construction', () => {
  it('passes a small legal force', () => {
    expect(checkForce(force([unit(), unit({ id: 'Atlas AS7-K', model: 'AS7-K' })])).problems).toEqual([])
  })

  it('counts artillery toward PV but not units', () => {
    const f = force([unit({ pv: 340 })], { artillery: [{ id: 'a', kind: 'sniper' }, { id: 'b', kind: 'thumper' }] })
    expect(forcePv(f.units, f.artillery)).toBe(353)
    expect(checkForce(f).problems).toContainEqual(expect.stringContaining('350 PV'))
  })

  it('limits units sharing a chassis and repeated variants', () => {
    expect(checkForce(force([unit(), unit(), unit()])).problems).toContainEqual(expect.stringContaining('3 Atlas'))
    expect(checkForce(force([unit(), unit()])).problems).toContainEqual(expect.stringContaining('different variants'))
    const infantry = { type: 'CI' as const, chassis: 'Foot', id: 'Foot', pv: 7 }
    expect(checkForce(force([unit(infantry), unit(infantry)])).problems).toEqual([])
    const apc = { type: 'CV' as const, chassis: 'APC', id: 'APC', pv: 7, specials: ['IT4'] }
    expect(checkForce(force([unit(apc), unit(apc)])).problems).toEqual([])
  })

  it('checks Skill extremes, minimum PV, JMPS and banned tech', () => {
    const problems = checkForce(force([
      unit({ id: 'a', chassis: 'A' }, 2), unit({ id: 'b', chassis: 'B' }, 6), unit({ id: 'c', chassis: 'C' }, 2),
      unit({ id: 'd', chassis: 'D', pv: 6 }), unit({ id: 'e', chassis: 'E', specials: ['JMPS2'] }), unit({ id: 'f', chassis: 'F', specials: ['JMPS1'] }),
      unit({ id: 'g', chassis: 'G', rules: 'Experimental' }), unit({ id: 'h', chassis: 'H', specials: ['DRO'] }),
    ])).problems.join('\n')
    expect(problems).toMatch(/3 units at Skill 2 or 6/)
    expect(problems).toMatch(/6 PV at Skill 4/)
    expect(problems).toMatch(/JMPS is 3/)
    expect(problems).toMatch(/Experimental/)
    expect(problems).toMatch(/DRO/)
  })

  it('checks faction, era, Unique and Extinct from the unit list', () => {
    const factions: UnitListFaction[] = [
      { name: 'Clan Wolf', group: 'IS Clan' }, { name: 'IS Clan General', group: 'IS Clan' },
      { name: 'Unique', group: 'Other' }, { name: 'Extinct', group: 'Other' },
    ]
    const era = 1 << 5
    const wolf = entry({ id: 'W', chassis: 'W', factions: [[0, era]] })
    const general = entry({ id: 'G', chassis: 'G', factions: [[1, era]] })
    const elsewhere = entry({ id: 'X', chassis: 'X', factions: [[0, 1 << 6]] })
    const unique1 = entry({ id: 'U1', chassis: 'U1', factions: [[0, era], [2, era]] })
    const unique2 = entry({ id: 'U2', chassis: 'U2', factions: [[0, era], [2, era]] })
    const extinct = entry({ id: 'E', chassis: 'E', factions: [[0, era], [3, era]] })
    const all = [wolf, general, elsewhere, unique1, unique2, extinct]
    const list = { entries: new Map(all.map(e => [e.id, e])), factions }
    const units = all.map(e => unitFromListEntry(e, e.id))

    const withGeneral = checkForce(force(units, { generalList: 'IS Clan General' }), list).problems.join('\n')
    expect(withGeneral).not.toMatch(/^[WG] .* isn't/m)
    expect(withGeneral).toMatch(/^X .* isn't available/m)
    expect(withGeneral).toMatch(/2 Unique units/)
    expect(withGeneral).toMatch(/^E .* is extinct/m)
    expect(checkForce(force(units), list).problems.join('\n')).toMatch(/^G .* isn't available/m)
  })
})

describe('Deployment', () => {
  it('keeps to 250 PV and 10 units, and ProtoMechs as a full Point', () => {
    const protos = Array.from({ length: 5 }, (_, i) => unit({ type: 'PM', id: `P${i}`, chassis: 'Proto', pv: 10 }))
    const big = unit({ id: 'B', chassis: 'B', pv: 246 })
    const f = force([big, ...protos], { artillery: [{ id: 'art', kind: 'thumper' }] })
    expect(checkDeployment(f, { unitIds: [big.id], artilleryIds: ['art'] }).problems).toContainEqual(expect.stringContaining('250 PV'))
    expect(checkDeployment(f, { unitIds: protos.slice(0, 3).map(p => p.id), artilleryIds: [] }).problems).toContainEqual(expect.stringContaining('full Point'))
    expect(checkDeployment(f, { unitIds: protos.map(p => p.id), artilleryIds: ['art'] }).problems).toEqual([])
  })
})

describe('Margin of Victory', () => {
  const units = [{ ...unit({ pv: 40 }), pv: 40 }, { ...unit({ id: 'b', chassis: 'b', pv: 21, structure: 4 }), pv: 21 }]
  it('is 250 less the PV left, crippled units counting half rounded up', () => {
    const side = { units, battle: { round: 2, units: { [units[1].id]: { committed: { ...emptyMarks(), armor: 10, structure: 2 }, notes: '' } } } }
    expect(sideStanding(side).remainingPv).toBe(51)
    expect(marginOfVictory(side)).toBe(199)
  })
  it('counts destroyed units as gone', () => {
    const side = { units, battle: { round: 2, units: { [units[0].id]: { committed: { ...emptyMarks(), destroyed: true }, notes: '' } } } }
    expect(sideStanding(side)).toEqual({ remainingPv: 21, destroyedPv: 40, allDestroyed: false })
  })
})

function emptyMarks() {
  return { armor: 0, structure: 0, destroyed: false, heat: 0, engine: 0, fireControl: 0, mp: 0, weapons: 0, ammoHit: false, motive: [], immobilized: false, edgeSpent: 0, specialsUsed: {} }
}

describe('Scenarios', () => {
  it('leaves beta scenarios out of the roll unless included', () => {
    expect(rollScenario(false, () => 0.999)).toBe(8)
    expect(rollScenario(true, () => 0.999)).toBe(10)
  })
  it('scores Stand Up Fight by PV destroyed', () => {
    expect([0, 65, 130, 195].map(pv => standUpFightPoints(pv, false))).toEqual([0, 1, 2, 3])
    expect(standUpFightPoints(10, true)).toBe(4)
  })
})

describe('Match codes', () => {
  it('makes six readable characters and accepts typed-in variations', () => {
    const code = newMatchCode()
    expect(code).toMatch(/^[A-Z2-9]{6}$/)
    expect(normalizeMatchCode(` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `)).toBe(code)
    expect(normalizeMatchCode('ABC1O0')).toBeNull()
  })
})

describe('Match sync', () => {
  function side(playerId: string, updatedAt: number): WnSide {
    return { playerId, playerName: '', forceName: '', faction: null, era: null, units: [], artillery: [], battle: { round: 1, units: {} }, vp: 1, commandUnitIds: [], updatedAt }
  }

  beforeEach(() => {
    const store = useWolfnetStore.getState()
    const forceId = store.createForce('Mine')
    store.startMatch({ code: 'ABCDEF', role: 'guest', forceId, unitIds: [], artilleryIds: [], scenario: 3 })
  })

  it("takes the host's side and scenario, ignoring a third device and older news", () => {
    const { receive } = useWolfnetStore.getState()
    receive({ kind: 'side', from: 'host', role: 'host', scenario: 5, side: side('host', 10) })
    expect(useWolfnetStore.getState().match).toMatchObject({ scenario: 5, opponent: { playerId: 'host' } })
    receive({ kind: 'side', from: 'other', role: 'guest', scenario: null, side: side('other', 20) })
    receive({ kind: 'side', from: 'host', role: 'host', scenario: 5, side: { ...side('host', 5), vp: 3 } })
    expect(useWolfnetStore.getState().match?.opponent).toMatchObject({ playerId: 'host', vp: 1 })
  })

  it("doesn't take its own messages, and never sends pending marks", () => {
    const { receive, playerId, markBattle } = useWolfnetStore.getState()
    receive({ kind: 'side', from: playerId, role: 'host', scenario: 1, side: side(playerId, 99) })
    expect(useWolfnetStore.getState().match?.opponent).toBeNull()
    markBattle('x', { armor: 2 })
    const sent = publicSide(useWolfnetStore.getState().match!.me)
    expect(sent.battle.units.x).toEqual({ committed: expect.objectContaining({ armor: 0 }), notes: '', destroyedRound: undefined })
  })
})
