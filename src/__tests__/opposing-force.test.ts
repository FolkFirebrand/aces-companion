import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { selectCampaignLog, selectWarchestBalance } from '@/store/selectors'
import { ALL_STEP_IDS } from '@/lib/steps'
import { addCopies, opposingForcePv, opposingTemplate } from '@/lib/opposing-force'
import { forceFileContents, importForce } from '@/lib/unit-list/import-force'
import { convertCatalog } from '@/lib/unit-list/convert'
import type { CatalogUnit } from '@/lib/unit-list/convert'
import type { OpposingUnit, Unit } from '@/lib/types'

function store() {
  return useCampaignStore.getState()
}

const HUNCHBACK: Omit<Unit, 'id'> = {
  nameAndVariant: 'Hunchback HBK-4G', unitType: 'BattleMech', pvAtSkill4: 39, size: 2, ene: false, pilotId: null, totalSpEarned: 0,
  armor: 6, structure: 5, tmm: 1, move: [{ move: 8, type: '' }],
}
const JENNER: Omit<Unit, 'id'> = { ...HUNCHBACK, nameAndVariant: 'Jenner JR7-D', pvAtSkill4: 23, size: 1 }

let ids = 0
const newId = () => `o${++ids}`
const names = (units: OpposingUnit[]) => units.map(u => u.nameAndVariant)

describe('numbering copies', () => {
  it('keeps a lone unit’s plain name, and numbers copies from 1 when a second joins', () => {
    const one = addCopies([], opposingTemplate(HUNCHBACK), 1, newId)
    expect(names(one)).toEqual(['Hunchback HBK-4G'])

    expect(names(addCopies(one, opposingTemplate(HUNCHBACK), 2, newId))).toEqual(['Hunchback HBK-4G 1', 'Hunchback HBK-4G 2', 'Hunchback HBK-4G 3'])
  })

  it('numbers each kind of unit separately, and leaves a renamed unit’s name alone', () => {
    let force = addCopies([], opposingTemplate(HUNCHBACK), 1, newId)
    force = force.map(u => ({ ...u, nameAndVariant: 'Big Hunch' }))
    force = addCopies(force, opposingTemplate(JENNER), 2, newId)
    force = addCopies(force, opposingTemplate(HUNCHBACK), 1, newId)

    expect(names(force)).toEqual(['Big Hunch', 'Jenner JR7-D 1', 'Jenner JR7-D 2', 'Hunchback HBK-4G 2'])
    expect(opposingForcePv(force)).toBe(39 + 23 + 23 + 39)
  })

  it('give enemy units Skill 4 unless set', () => {
    expect(opposingTemplate(HUNCHBACK).skill).toBe(4)
    expect(opposingTemplate(HUNCHBACK, 3).skill).toBe(3)
  })
})

describe('the Opposing Force in a sortie', () => {
  let sortieId = ''
  beforeEach(() => {
    store().resetStore()
    act(() => { sortieId = store().addSortie() })
  })
  const force = () => store().campaign.sorties.find(s => s.id === sortieId)!.opposingForce ?? []

  it('can be added to, renamed, given a Skill and trimmed while the sortie is a draft', () => {
    act(() => {
      store().addOpposingCopies(sortieId, opposingTemplate(HUNCHBACK), 2)
      store().addOpposingCopies(sortieId, opposingTemplate(JENNER), 1)
    })
    const [first, second] = force()
    act(() => {
      store().updateOpposingUnit(sortieId, first.id, { nameAndVariant: 'Hunchback (left flank)', skill: 3 })
      store().removeOpposingUnit(sortieId, second.id)
    })

    expect(force().map(u => [u.nameAndVariant, u.skill])).toEqual([['Hunchback (left flank)', 3], ['Jenner JR7-D', 4]])
  })

  it('never joins the Player Force or touches the Warchest and Campaign Log, and is kept on completion and reopen', () => {
    const warchest = selectWarchestBalance(store().campaign)
    act(() => {
      store().updateSortie(sortieId, { primaryObjective: 100 })
      store().addOpposingCopies(sortieId, opposingTemplate(HUNCHBACK), 3)
      ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true))
      store().completeSortie(sortieId)
    })

    expect(store().campaign.units).toEqual([])
    expect(selectCampaignLog(store().campaign)[0].earnings).toBe(100)
    expect(selectWarchestBalance(store().campaign)).toBe(warchest + 100)
    expect(force()).toHaveLength(3)

    act(() => store().addOpposingCopies(sortieId, opposingTemplate(JENNER), 1))
    expect(force()).toHaveLength(3)

    act(() => store().reopenSortie(sortieId))
    expect(force()).toHaveLength(3)
  })
})

describe('uploading a force', () => {
  const catalog = (name: string, chassis: string, model: string): CatalogUnit => ({
    name, chassis, model, type: 'Mek', role: 'Brawler', tons: 50, omni: 0, icon: 'meks/x.png',
    as: { TP: 'BM', PV: 39, SZ: 2, TMM: 1, MVm: { '': 8 }, Arm: 6, Str: 5, OV: 0, dmg: { dmgS: '4', dmgM: '4', dmgL: '0*' }, specials: ['AC2/2/-'] },
  })
  const LIST = convertCatalog([catalog('BMHunchback_HBK4G', 'Hunchback', 'HBK-4G'), catalog('BMJenner_JR7D', 'Jenner', 'JR7-D')])

  it('reads a MegaMek .mul, linking units to the unit list and taking Skill from gunnery', () => {
    const mul = `<?xml version="1.0" encoding="UTF-8"?>
<unit version="0.50">
  <entity chassis="Hunchback" model="HBK-4G" type="Biped"><pilot name="A" gunnery="3" piloting="4"/></entity>
  <entity chassis="Jenner" model="JR7-D" type="Biped"><pilot name="B" gunnery="4" piloting="5"/></entity>
  <entity chassis="Homebrew" model="HB-1" type="Biped"/>
</unit>`

    const { units, unmatched } = importForce(mul, LIST)

    expect(units.map(u => [u.nameAndVariant, u.unitListId, u.skill])).toEqual([
      ['Hunchback HBK-4G', 'BMHunchback_HBK4G', 3], ['Jenner JR7-D', 'BMJenner_JR7D', 4], ['Homebrew HB-1', undefined, undefined],
    ])
    expect(units[0]).toMatchObject({ pvAtSkill4: 39, armor: 6, structure: 5, damageText: ['4', '4', '0*'] })
    expect(unmatched).toEqual(['Homebrew HB-1'])
  })

  it('reads a Unit Builder file, linking units whose name is on the unit list', () => {
    const builder = JSON.stringify({ members: [
      { name: 'Jenner JR7-D', type: 'BM', basePoints: 23, size: 1 },
      { name: 'Laser Boat', type: 'BM', basePoints: 30, size: 2, abilities: ['ENE'] },
    ] })

    const { units, unmatched } = importForce(builder, LIST)

    expect(units.map(u => [u.nameAndVariant, u.unitListId])).toEqual([['Jenner JR7-D', 'BMJenner_JR7D'], ['Laser Boat', undefined]])
    expect(unmatched).toEqual(['Laser Boat'])
  })

  it('round-trips the app’s own force file', () => {
    const units = [{ ...HUNCHBACK, unitListId: 'BMHunchback_HBK4G', skill: 3 }, { ...JENNER }]

    expect(importForce(forceFileContents(units, 'opposing'), LIST)).toEqual({ units, unmatched: ['Jenner JR7-D'] })
  })

  it('explains when a file is not a force', () => {
    expect(() => importForce('{"hello": 1}', LIST)).toThrow(/not a force file/)
    expect(() => importForce('nonsense', LIST)).toThrow(/could not be read/)
  })
})
