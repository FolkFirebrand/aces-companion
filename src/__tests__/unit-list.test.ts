import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { convertCatalog, omniConfigurations, searchUnitList, unitFromEntry, unitListName, unitListRoles } from '@/lib/unit-list/convert'
import { ALL_STEP_IDS } from '@/lib/steps'
import type { CatalogUnit } from '@/lib/unit-list/convert'
import { unitIconUrl } from '@/lib/unit-list/icons'
import { UNIT_LIST } from '@/lib/unit-list/manifest'

// Small samples in the format of MegaMek's generated catalog (as published by MekBay).
function catalogUnit(name: string, chassis: string, model: string, as: Partial<CatalogUnit['as']>, extra: Partial<CatalogUnit> = {}): CatalogUnit {
  return {
    name, chassis, model, type: 'Mek', role: 'Juggernaut', tons: 100, omni: 0, mul1id: 140,
    as: { TP: 'BM', PV: 52, SZ: 4, TMM: 1, MVm: { '': 6 }, Arm: 10, Str: 8, OV: 0, dmg: { dmgS: '5', dmgM: '5', dmgL: '2' }, specials: ['IF1', 'REAR1/1/-'], ...as },
    ...extra,
  }
}

const ATLAS = catalogUnit('BMAtlas_AS7D', 'Atlas', 'AS7-D', {}, { icon: 'meks/Atlas.png' })
const GOTH_A = catalogUnit('Goth_A', 'Goth', 'A', { PV: 40, SZ: 2, specials: ['ENE', 'OMNI'] }, { omni: 1, role: 'Striker' })
const GOTH_B = catalogUnit('Goth_B', 'Goth', 'B', { PV: 43, SZ: 2, specials: ['OMNI'] }, { omni: 1, role: 'Striker' })
const BANSHEE_VEHICLE = catalogUnit('Demolisher_Tank', 'Demolisher Heavy Tank', '', { TP: 'CV', PV: 34, SZ: 3, MVm: { t: 6 }, dmg: { dmgS: '6', dmgM: '6', dmgL: '0' } }, { type: 'Tank', role: 'None' })
const ELEMENTAL = catalogUnit('BA_Elemental', 'Elemental Battle Armor', '[Laser](Sqd5)', { TP: 'BA', PV: 33, SZ: 1, TMM: 2, MVm: { '': 2, j: 6 }, Arm: 2, Str: 2, dmg: { dmgS: '2', dmgM: '1', dmgL: '0*' } }, { type: 'Infantry' })
const RIFLES = catalogUnit('CI_Foot', 'Foot Platoon', '(Rifle)', { TP: 'CI', PV: 9, SZ: 1, MVm: { f: 2 }, Arm: 2, Str: 1, dmg: { dmgS: '1', dmgM: '0*', dmgL: '0' } }, { type: 'Infantry' })
const EMPLACEMENT = catalogUnit('Bunker', 'Missile Emplacement', '', { TP: 'CV', Str: -1 }, { type: 'Building Entity' })
const FIGHTER = catalogUnit('AF_Shilone', 'Shilone', 'SL-17', { TP: 'AF' }, { type: 'Aero' })
const INDUSTRIAL = catalogUnit('IM_Crane', 'Crane', 'Mod', { TP: 'IM' })

const LIST = convertCatalog([GOTH_B, ATLAS, FIGHTER, ELEMENTAL, EMPLACEMENT, GOTH_A, INDUSTRIAL, RIFLES, BANSHEE_VEHICLE])

describe('converting the catalog into the unit list', () => {
  it('keeps only BattleMechs, combat vehicles, battle armor and conventional infantry, sorted by name', () => {
    expect(LIST.map(e => e.id)).toEqual(['BMAtlas_AS7D', 'Demolisher_Tank', 'BA_Elemental', 'CI_Foot', 'Goth_A', 'Goth_B'])
  })

  it('keeps each unit’s Alpha Strike stats, role, picture and OMNI flag', () => {
    expect(LIST.find(e => e.id === 'BMAtlas_AS7D')).toEqual({
      id: 'BMAtlas_AS7D', chassis: 'Atlas', model: 'AS7-D', type: 'BM', pv: 52, size: 4, tmm: 1, move: { '': 6 },
      armor: 10, structure: 8, damage: ['5', '5', '2'], ov: 0, specials: ['IF1', 'REAR1/1/-'],
      role: 'Juggernaut', tons: 100, icon: 'meks/Atlas.png', mulId: 140,
    })
    expect(LIST.find(e => e.id === 'Goth_A')).toMatchObject({ omni: true, role: 'Striker' })
    expect(LIST.find(e => e.id === 'Demolisher_Tank')).not.toHaveProperty('role')
    expect(LIST.find(e => e.id === 'BMAtlas_AS7D')).not.toHaveProperty('omni')
  })
})

describe('unit icons (ADR 0006)', () => {
  it('drops icons that mm-data does not have, so the placeholder shows', () => {
    const lam = catalogUnit('LAM', 'Phoenix Hawk LAM', 'PHX-HK1', {}, { icon: 'defaults/default_lam_mek.png' })

    const [atlas, phoenix] = convertCatalog([ATLAS, lam], new Set(['meks/Atlas.png']))

    expect(atlas.icon).toBe('meks/Atlas.png')
    expect(phoenix).not.toHaveProperty('icon')
  })

  it('load from mm-data on GitHub, pinned to the commit the unit list was built with', () => {
    expect(unitIconUrl('battle armor/Elemental_5-CO.png')).toBe(
      `https://raw.githubusercontent.com/MegaMek/mm-data/${UNIT_LIST.iconsCommit}/data/images/units/battle%20armor/Elemental_5-CO.png`,
    )
  })

  it('come with a picked unit', () => {
    expect(unitFromEntry(LIST[0]).iconPath).toBe('meks/Atlas.png')
  })
})

describe('searching the unit list', () => {
  it('matches every word of the search against the unit’s name', () => {
    expect(searchUnitList(LIST, { text: 'goth b' }).map(e => e.id)).toEqual(['Goth_B'])
    expect(searchUnitList(LIST, { text: 'AS7' }).map(e => e.id)).toEqual(['BMAtlas_AS7D'])
  })

  it('filters by type', () => {
    expect(searchUnitList(LIST, { types: ['BA', 'CI'] }).map(e => e.id)).toEqual(['BA_Elemental', 'CI_Foot'])
  })

  it('stops at the limit', () => {
    expect(searchUnitList(LIST, { limit: 2 })).toHaveLength(2)
  })
})

describe('a unit picked from the list', () => {
  it('fills in the Unit: name, type, PV, Size, ENE and the Alpha Strike stats, with "0*" damage as 0', () => {
    const elemental = LIST.find(e => e.id === 'BA_Elemental')!

    expect(unitFromEntry(elemental)).toMatchObject({
      nameAndVariant: 'Elemental Battle Armor [Laser](Sqd5)', unitType: 'Battle Armor', pvAtSkill4: 33, size: 1, ene: false,
      unitListId: 'BA_Elemental', tmm: 2, move: [{ move: 2, type: '' }, { move: 6, type: 'j' }], armor: 2, structure: 2,
      damage: { short: 2, medium: 1, long: 0, extreme: 0 },
    })
    expect(unitFromEntry(LIST.find(e => e.id === 'Goth_A')!).ene).toBe(true)
  })

  it('joins the Player Force with its stats and its link to the unit list', () => {
    useCampaignStore.getState().resetStore()
    act(() => useCampaignStore.getState().addUnit({ id: 'u1', ...unitFromEntry(LIST[0]) }))

    expect(useCampaignStore.getState().campaign.units[0]).toMatchObject({ id: 'u1', unitListId: 'BMAtlas_AS7D', pvAtSkill4: 52, size: 4, armor: 10 })
  })
})

describe('Campaign Files from v1', () => {
  it('load into v2 unchanged (schema 10 → 11)', () => {
    const store = useCampaignStore.getState
    store().resetStore()
    act(() => {
      store().updateCampaignMeta({ name: 'Iron Ravens' })
      store().addUnit({ id: 'u1', nameAndVariant: 'Hand-entered Wolverine', unitType: 'BattleMech', pvAtSkill4: 40, size: 2, ene: false, pilotId: null, totalSpEarned: 0 })
    })
    const v1File = { ...JSON.parse(store().exportCampaignFile().contents), schemaVersion: 10 }
    store().resetStore()

    const result = store().readCampaignFile(JSON.stringify(v1File))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.campaign.name).toBe('Iron Ravens')
      expect(result.file.campaign.units[0]).toMatchObject({ nameAndVariant: 'Hand-entered Wolverine', pvAtSkill4: 40 })
      expect(result.file.campaign.units[0].unitListId).toBeUndefined()
    }
  })
})

describe('OMNI configurations from the unit list', () => {
  const GOTH_PRIME = catalogUnit('Goth_Prime', 'Goth', 'Prime', { PV: 38, SZ: 2, specials: ['OMNI', 'ENE'] }, { omni: 1, role: 'Striker', icon: 'meks/Goth.png' })
  const OMNI_LIST = convertCatalog([GOTH_B, ATLAS, GOTH_A, GOTH_PRIME])

  it('lists every configuration sharing the OMNI chassis, and none for other units', () => {
    const gothA = OMNI_LIST.find(e => e.id === 'Goth_A')!

    expect(omniConfigurations(OMNI_LIST, gothA).map(e => e.id)).toEqual(['Goth_A', 'Goth_B', 'Goth_Prime'])
    expect(omniConfigurations(OMNI_LIST, OMNI_LIST.find(e => e.id === 'BMAtlas_AS7D')!)).toEqual([])
  })

  it('reconfigure a linked unit: priced by the book, and the unit takes the new configuration’s stats on completion, keeping its pilot and photo', () => {
    const store = useCampaignStore.getState
    store().resetStore()
    const gothA = OMNI_LIST.find(e => e.id === 'Goth_A')!
    const gothB = OMNI_LIST.find(e => e.id === 'Goth_B')!
    let sortieId = ''
    act(() => {
      store().addPilot({ id: 'p1', callsign: 'Ghost', pilotType: 'BattleMech', wounded: false, mvpCount: 0, totalSpEarned: 150, spSpentOnSkill: 0, spSpentOnEdgeTokens: 120, spSpentOnEdgeAbilities: 30, edgeAbilitiesLearned: [], campaignHistory: [] })
      store().addUnit({ id: 'g1', ...unitFromEntry(gothA), pilotId: 'p1', photoUrl: 'data:image/png;base64,x' })
      sortieId = store().addSortie()
      store().reconfigureOmni(sortieId, 'g1', unitListName(gothB), gothB.pv, gothB)
    })

    expect(store().campaign.sorties[0].purchases[0]).toMatchObject({ kind: 'omni', toName: 'Goth B', toPv: 43, spCost: 120 })

    act(() => {
      ALL_STEP_IDS.forEach(step => store().setStepDone(sortieId, step, true))
      store().completeSortie(sortieId)
    })
    expect(store().campaign.units[0]).toMatchObject({
      id: 'g1', nameAndVariant: 'Goth B', pvAtSkill4: 43, unitListId: 'Goth_B', ene: false, abilities: ['OMNI'],
      pilotId: 'p1', photoUrl: 'data:image/png;base64,x',
    })

    act(() => store().reopenSortie(sortieId))
    expect(store().campaign.units[0]).toMatchObject({ nameAndVariant: 'Goth A', pvAtSkill4: 40, unitListId: 'Goth_A', ene: true })
  })
})

describe('unit list filters (#37)', () => {
  it('filter by PV range, Size, role, ground move and medium-range damage', () => {
    expect(searchUnitList(LIST, { pvMin: 30, pvMax: 45 }).map(e => e.id)).toEqual(['Demolisher_Tank', 'BA_Elemental', 'Goth_A', 'Goth_B'])
    expect(searchUnitList(LIST, { sizes: [1] }).map(e => e.id)).toEqual(['BA_Elemental', 'CI_Foot'])
    expect(searchUnitList(LIST, { role: 'Striker' }).map(e => e.id)).toEqual(['Goth_A', 'Goth_B'])
    expect(searchUnitList(LIST, { minMove: 6 }).map(e => e.id)).toEqual(['BMAtlas_AS7D', 'Demolisher_Tank', 'Goth_A', 'Goth_B'])
    expect(searchUnitList(LIST, { minMediumDamage: 5 }).map(e => e.id)).toEqual(['BMAtlas_AS7D', 'Demolisher_Tank', 'Goth_A', 'Goth_B'])
  })

  it('combine with the name search and type', () => {
    expect(searchUnitList(LIST, { text: 'goth', pvMax: 41, types: ['BM'] }).map(e => e.id)).toEqual(['Goth_A'])
  })

  it('list the roles for the role filter', () => {
    expect(unitListRoles(LIST)).toEqual(['Juggernaut', 'Striker'])
  })
})

describe('linking a custom unit to the unit list (#37)', () => {
  const store = useCampaignStore.getState
  const custom = { id: 'u1', nameAndVariant: 'My Atlas', unitType: 'BattleMech' as const, pvAtSkill4: 50, size: 4, ene: false, pilotId: 'p1', totalSpEarned: 30, photoUrl: 'data:x' }

  beforeEach(() => {
    store().resetStore()
    act(() => store().addUnit(custom))
  })

  it('adds the list’s stats and icon, keeping its name, pilot, photo, history and id; PV from the list', () => {
    act(() => store().linkUnit('u1', LIST.find(e => e.id === 'BMAtlas_AS7D')!, false))

    expect(store().campaign.units[0]).toMatchObject({
      id: 'u1', nameAndVariant: 'My Atlas', pilotId: 'p1', totalSpEarned: 30, photoUrl: 'data:x',
      unitListId: 'BMAtlas_AS7D', iconPath: 'meks/Atlas.png', pvAtSkill4: 52, size: 4, armor: 10, structure: 8, damageText: ['5', '5', '2'],
    })
  })

  it('can keep the player’s PV', () => {
    act(() => store().linkUnit('u1', LIST.find(e => e.id === 'BMAtlas_AS7D')!, true))

    expect(store().campaign.units[0]).toMatchObject({ pvAtSkill4: 50, unitListId: 'BMAtlas_AS7D' })
  })
})
