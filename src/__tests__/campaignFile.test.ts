import { act } from '@testing-library/react'
import { useCampaignStore } from '@/store/campaign'
import { CAMPAIGN_SCHEMA_VERSION, UPGRADE_STEPS, runUpgrades } from '@/lib/campaign-file'
import type { UpgradeSteps } from '@/lib/campaign-file'
import { logCompletedSortie } from './helpers'

const NOW = new Date('2026-10-29T12:00:00Z')

function store() {
  return useCampaignStore.getState()
}

function logSorties(count: number) {
  for (let i = 0; i < count; i++) logCompletedSortie()
}

beforeEach(() => {
  store().resetStore()
  ;(window.localStorage.getItem as jest.Mock).mockReset()
})

describe('exporting a Campaign File', () => {
  it('names the file after the campaign, the latest sortie and the date', () => {
    act(() => store().updateCampaignMeta({ name: 'Iron Ravens: Cold Front' }))
    logSorties(2)

    const { fileName } = store().exportCampaignFile(NOW)

    expect(fileName).toBe('iron-ravens-cold-front_after-sortie-02_2026-10-29.json')
  })

  it('uses "setup" in the file name before any sortie is logged', () => {
    act(() => store().updateCampaignMeta({ name: 'Iron Ravens' }))

    const { fileName } = store().exportCampaignFile(NOW)

    expect(fileName).toBe('iron-ravens_setup_2026-10-29.json')
  })

  it('falls back to the force name, then "campaign", when the campaign is unnamed', () => {
    act(() => store().updateCampaignMeta({ forceName: 'Grey Lancers' }))
    expect(store().exportCampaignFile(NOW).fileName).toBe('grey-lancers_setup_2026-10-29.json')

    act(() => store().updateCampaignMeta({ forceName: '' }))
    expect(store().exportCampaignFile(NOW).fileName).toBe('campaign_setup_2026-10-29.json')
  })

  it('stamps the schema version, export time and latest sortie', () => {
    logSorties(3)

    const parsed = JSON.parse(store().exportCampaignFile(NOW).contents)

    expect(parsed.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION)
    expect(parsed.exportedAt).toBe('2026-10-29T12:00:00.000Z')
    expect(parsed.latestSortie).toEqual({ playOrder: 3, sortieNumber: '03' })
  })

  it('records no latest sortie before any sortie is logged', () => {
    const parsed = JSON.parse(store().exportCampaignFile(NOW).contents)

    expect(parsed.latestSortie).toBeNull()
  })
})

describe('loading a Campaign File', () => {
  it('round-trips a campaign through export and load', () => {
    act(() => store().updateCampaignMeta({ name: 'Iron Ravens', forceName: 'Ravens' }))
    logSorties(2)
    const before = store().campaign
    const { contents } = store().exportCampaignFile(NOW)

    act(() => store().resetStore())
    const result = store().readCampaignFile(contents)
    if (!result.ok) throw new Error(result.error)
    act(() => store().loadCampaignFile(result.file))

    const after = store().campaign
    expect(after.id).toBe(before.id)
    expect(after.name).toBe('Iron Ravens')
    expect(after.sorties).toEqual(before.sorties)
  })

  it('refuses text that is not JSON', () => {
    const result = store().readCampaignFile('not json {')

    expect(result).toEqual({ ok: false, error: 'This file is not a Campaign File (it is not valid JSON).' })
  })

  it('refuses JSON that is not a Campaign File', () => {
    const result = store().readCampaignFile(JSON.stringify({ hello: 'world' }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not a Campaign File/)
  })

  it('refuses a file saved by the earlier, unversioned app', () => {
    const oldFormat = { id: 'c1', sorties: [], namedPilots: [], units: [] }

    const result = store().readCampaignFile(JSON.stringify(oldFormat))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/older version of the app/)
  })

  it('refuses a file from a newer version of the app', () => {
    const { contents } = store().exportCampaignFile(NOW)
    const future = { ...JSON.parse(contents), schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1 }

    const result = store().readCampaignFile(JSON.stringify(future))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/newer version of the app/)
  })
})

describe('older-file warning', () => {
  it('warns when the file is behind the same campaign in the browser', () => {
    logSorties(1)
    const { contents } = store().exportCampaignFile(NOW)
    logSorties(2)

    const result = store().readCampaignFile(contents)

    expect(result.ok && result.olderThanBrowser).toEqual({
      fileProgress: 'after Sortie 01',
      browserProgress: 'after Sortie 03',
    })
  })

  it('does not warn when the file is level with the browser', () => {
    logSorties(2)
    const { contents } = store().exportCampaignFile(NOW)

    const result = store().readCampaignFile(contents)

    expect(result.ok && result.olderThanBrowser).toBeNull()
  })

  it('does not warn when the file holds a different campaign', () => {
    const { contents } = store().exportCampaignFile(NOW)
    act(() => store().resetStore())
    logSorties(4)

    const result = store().readCampaignFile(contents)

    expect(result.ok && result.olderThanBrowser).toBeNull()
  })

  it('describes a file with no sorties as "at setup"', () => {
    const { contents } = store().exportCampaignFile(NOW)
    logSorties(1)

    const result = store().readCampaignFile(contents)

    expect(result.ok && result.olderThanBrowser).toEqual({
      fileProgress: 'at setup',
      browserProgress: 'after Sortie 01',
    })
  })
})

describe('offering a backup before replacing the campaign', () => {
  it('has nothing to back up in a fresh campaign', () => {
    expect(store().hasCampaignData()).toBe(false)
  })

  it('has something to back up once anything is recorded', () => {
    act(() => store().updateCampaignMeta({ name: 'Iron Ravens' }))

    expect(store().hasCampaignData()).toBe(true)
  })
})

describe('saved browser data', () => {
  function persisted(state: unknown, version: number) {
    ;(window.localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify({ state, version }))
  }

  it('discards data saved in the old format and starts an empty campaign', async () => {
    act(() => store().updateCampaignMeta({ name: 'Unsaved' }))
    persisted({ campaign: { id: 'old', name: 'Legacy', sorties: [{ id: 's1' }], namedPilots: [], units: [], memorial: [] } }, 1)

    await useCampaignStore.persist.rehydrate()

    expect(store().campaign.id).not.toBe('old')
    expect(store().campaign.name).toBe('')
    expect(store().campaign.sorties).toEqual([])
  })

  it('keeps data saved in the current format', async () => {
    act(() => store().updateCampaignMeta({ name: 'Iron Ravens' }))
    const campaign = store().campaign
    act(() => store().resetStore())
    persisted({ campaign }, CAMPAIGN_SCHEMA_VERSION)

    await useCampaignStore.persist.rehydrate()

    expect(store().campaign.name).toBe('Iron Ravens')
  })
})

// Pattern for future schema changes: add a step keyed by the version it upgrades FROM,
// bump CAMPAIGN_SCHEMA_VERSION, and add a test like this one with a real old-format fixture.
describe('v11 → v12', () => {
  it('gives every sortie a zero waypoint gain', () => {
    const v11 = { campaign: { sorties: [{ id: 's1', waypointsSP: 30 }] } }

    expect(runUpgrades(v11, 11, 12, UPGRADE_STEPS).campaign.sorties).toEqual([{ id: 's1', waypointsSP: 30, waypointsGainedSP: 0 }])
  })
})

describe('upgrade steps', () => {
  const steps: UpgradeSteps = {
    2: data => ({ ...data, campaign: { ...data.campaign, addedInV3: true } }),
    3: data => ({ ...data, campaign: { ...data.campaign, addedInV4: 'yes' } }),
  }

  it('applies each step in order from the saved version to the target', () => {
    const upgraded = runUpgrades({ campaign: { name: 'x' } }, 2, 4, steps)

    expect(upgraded).toEqual({ campaign: { name: 'x', addedInV3: true, addedInV4: 'yes' } })
  })

  it('leaves current data untouched', () => {
    const data = { campaign: { name: 'x' } }

    expect(runUpgrades(data, 4, 4, steps)).toBe(data)
  })

  it('throws when a step is missing', () => {
    expect(() => runUpgrades({ campaign: {} }, 1, 4, steps)).toThrow(/No upgrade step from version 1/)
  })
})
