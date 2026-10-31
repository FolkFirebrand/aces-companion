import type { Campaign } from './types'
import { DIFFICULTY_LEVELS } from './rules'
import { ALL_STEP_IDS } from './steps'

// Version 2 is the clean break (ADR 0001): anything saved before it is discarded or refused.
// To change the saved shape: bump this, add an UPGRADE_STEPS entry keyed by the version it
// upgrades FROM, and add a test with a real old-format fixture (see campaignFile.test.ts).
export const CAMPAIGN_SCHEMA_VERSION = 12

export type SavedData = { campaign: Record<string, unknown> } & Record<string, unknown>
export type UpgradeSteps = Record<number, (data: SavedData) => SavedData>

export const UPGRADE_STEPS: UpgradeSteps = {
  // v2 → v3 (#8): Sortie Numbers from the Campaign Book, Victory/Failed outcomes, Starting Warchest Balance.
  // v2's "Win?" box defaulted to unticked and never affected the money, so every old sortie becomes a Victory.
  2: data => ({
    ...data,
    campaign: {
      ...data.campaign,
      startingWarchest: 400,
      sorties: (data.campaign.sorties as Record<string, unknown>[]).map(old => {
        const sortie: Record<string, unknown> = { ...old, sortieNumber: String(old.number).padStart(2, '0'), outcome: 'victory' }
        delete sortie.number
        delete sortie.won
        return sortie
      }),
    },
  }),
  // v3 → v4 (#9): the free-typed income multiplier becomes a Difficulty Level; the free-text
  // level and manual PV limit go; each sortie gets a Listed PV.
  3: data => {
    const campaign: Record<string, unknown> = { ...data.campaign }
    const difficultyModifier = campaign.difficultyModifier
    delete campaign.level
    delete campaign.difficultyModifier
    delete campaign.pvLimit
    const spPercent = Math.round(Number(difficultyModifier ?? 1) * 100)
    const preset = Object.entries(DIFFICULTY_LEVELS).find(([, d]) => d.spPercent === spPercent)?.[0]
    return {
      ...data,
      campaign: {
        ...campaign,
        difficultyLevel: preset ?? 'custom',
        customPvPercent: 0,
        customSpPercent: spPercent,
        sorties: (campaign.sorties as Record<string, unknown>[]).map(sortie => ({ ...sortie, listedPv: 0 })),
      },
    }
  },
  // v4 → v5 (#10): sorties become drafts or completed. Everything already logged counted, so it is
  // completed; its purchases were never applied to the roster, so there is nothing to undo.
  4: data => ({
    ...data,
    campaign: {
      ...data.campaign,
      sorties: (data.campaign.sorties as Record<string, unknown>[]).map(sortie => ({
        ...sortie,
        status: 'completed',
        stepsDone: [...ALL_STEP_IDS],
        reconnaissanceNote: '',
        appliedEffects: null,
        purchases: ((sortie.purchases ?? []) as { id: string; unitName: string; pvAtSkill4: number; spCost: number }[]).map(p => ({
          id: p.id,
          kind: 'buy',
          spCost: p.spCost,
          unit: {
            id: `${p.id}-unit`, nameAndVariant: p.unitName, unitType: 'BattleMech', pvAtSkill4: p.pvAtSkill4,
            pilotId: null, inDropDeck: false, totalSpEarned: 0, size: 1, ene: false,
          },
        })),
      })),
    },
  }),
  // v5 → v6 (#15): notes for waypoint costs and for which sortie comes next.
  5: data => ({
    ...data,
    campaign: {
      ...data.campaign,
      sorties: (data.campaign.sorties as Record<string, unknown>[]).map(sortie => ({ ...sortie, waypointsNote: '', nextSortieNote: '' })),
    },
  }),
  // v6 → v7 (#11): Fielded Units replace the drop deck. Units get a required Size and an ENE flag
  // (read from their abilities); old sorties keep their typed-in rearming count.
  6: data => ({
    ...data,
    campaign: {
      ...data.campaign,
      units: (data.campaign.units as Record<string, unknown>[]).map(old => {
        const unit: Record<string, unknown> = { ...old }
        delete unit.inDropDeck
        const abilities = Array.isArray(old.abilities) ? (old.abilities as string[]) : []
        return { ...unit, size: typeof old.size === 'number' ? old.size : 1, ene: abilities.some(a => a.trim().toUpperCase() === 'ENE') }
      }),
      sorties: (data.campaign.sorties as Record<string, unknown>[]).map(old => {
        const sortie: Record<string, unknown> = { ...old }
        delete sortie.unitsWithoutENE
        return { ...sortie, fieldedUnits: [], forceCommanderPilotId: null, legacyUnitsWithoutENE: Number(old.unitsWithoutENE ?? 0) }
      }),
    },
  }),
  // v7 → v8 (#12): Damage States and Crew Checks on Fielded Units; typed-in repairs and crew counts
  // move to legacy fields; Memorial entries get a reason; completion effects cover pilots and Memorial.
  7: data => ({
    ...data,
    campaign: {
      ...data.campaign,
      memorial: (data.campaign.memorial as Record<string, unknown>[]).map(m => ({ ...m, reason: 'manual' })),
      sorties: (data.campaign.sorties as Record<string, unknown>[]).map(old => {
        const sortie: Record<string, unknown> = { ...old, legacyRepairs: old.repairs ?? [], legacyWoundedOrKilledCrew: Number(old.woundedOrKilledCrew ?? 0) }
        delete sortie.repairs
        delete sortie.woundedOrKilledCrew
        sortie.fieldedUnits = ((old.fieldedUnits ?? []) as Record<string, unknown>[]).map(f => ({
          ...f, damage: 'undamaged', autoTrulyDestroyed: null, salvageRoll: null, crewMode: 'roll', crewRoll: null,
        }))
        if (old.appliedEffects) {
          sortie.appliedEffects = { removedPilots: [], pilotsBefore: [], memorialAddedIds: [], ...(old.appliedEffects as object) }
        }
        return sortie
      }),
    },
  }),
  // v8 → v9 (#13): pilot shares, MVP and allocations per sortie; typed-in pilot SP becomes legacy.
  8: data => ({
    ...data,
    campaign: {
      ...data.campaign,
      sorties: (data.campaign.sorties as Record<string, unknown>[]).map(old => {
        const sortie: Record<string, unknown> = {
          ...old, legacyNamedPilotSp: Number(old.namedPilotSpEarned ?? 0),
          maxSpPerPilot: 0, mvpPilotId: null, pilotAllocations: [], pilotShares: [],
        }
        delete sortie.namedPilotSpEarned
        return sortie
      }),
    },
  }),
  // v9 → v10 (#14): hiring Named Pilots; typed-in replacement counts become legacy.
  9: data => ({
    ...data,
    campaign: {
      ...data.campaign,
      sorties: (data.campaign.sorties as Record<string, unknown>[]).map(old => {
        const sortie: Record<string, unknown> = { ...old, legacyNewReplacementPilots: Number(old.newReplacementPilots ?? 0), hires: [] }
        delete sortie.newReplacementPilots
        if (old.appliedEffects) sortie.appliedEffects = { addedPilotIds: [], ...(old.appliedEffects as object) }
        return sortie
      }),
    },
  }),
  // v10 → v11 (#36, v2): Units may link to the unit list. The link is optional, so v1 data is unchanged;
  // the bump marks files saved by v2, which v1 refuses as newer.
  10: data => data,
  // v11 → v12: waypoints can give SP as well as cost it.
  11: data => ({
    ...data,
    campaign: {
      ...data.campaign,
      sorties: (data.campaign.sorties as Record<string, unknown>[]).map(sortie => ({ ...sortie, waypointsGainedSP: 0 })),
    },
  }),
}

export function runUpgrades(data: SavedData, fromVersion: number, toVersion: number, steps: UpgradeSteps): SavedData {
  let current = data
  for (let version = fromVersion; version < toVersion; version++) {
    const step = steps[version]
    if (!step) throw new Error(`No upgrade step from version ${version}`)
    current = step(current)
  }
  return current
}

export interface SortiePoint {
  playOrder: number
  sortieNumber: string
}

export interface CampaignFile {
  schemaVersion: number
  exportedAt: string
  latestSortie: SortiePoint | null
  campaign: Campaign
}

export interface OlderThanBrowser {
  fileProgress: string
  browserProgress: string
}

export type ReadCampaignFileResult =
  | { ok: true; file: CampaignFile; olderThanBrowser: OlderThanBrowser | null }
  | { ok: false; error: string }

export function latestSortie(campaign: Campaign): SortiePoint | null {
  for (let i = campaign.sorties.length - 1; i >= 0; i--) {
    const sortie = campaign.sorties[i]
    if (sortie.status === 'completed') return { playOrder: i + 1, sortieNumber: sortie.sortieNumber }
  }
  return null
}

function progressLabel(point: SortiePoint | null): string {
  return point ? `after Sortie ${point.sortieNumber}` : 'at setup'
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function createCampaignFile(campaign: Campaign, now: Date): { fileName: string; contents: string } {
  const latest = latestSortie(campaign)
  const file: CampaignFile = {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    latestSortie: latest,
    campaign,
  }
  const name = slug(campaign.name) || slug(campaign.forceName) || 'campaign'
  const progress = latest ? `after-sortie-${latest.sortieNumber}` : 'setup'
  const date = now.toISOString().slice(0, 10)
  return { fileName: `${name}_${progress}_${date}.json`, contents: JSON.stringify(file, null, 2) }
}

const NOT_A_CAMPAIGN_FILE = 'This file is not a Campaign File.'
const FROM_OLDER_APP = "This Campaign File was saved by an older version of the app and can't be loaded."
const FROM_NEWER_APP = 'This Campaign File was saved by a newer version of the app. Reload the page to get the latest version, then try again.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function looksLikeCampaign(value: unknown): value is Campaign {
  return isRecord(value)
    && typeof value.id === 'string'
    && ['sorties', 'namedPilots', 'units', 'memorial'].every(key => Array.isArray(value[key]))
}

export function readCampaignFile(text: string, browserCampaign: Campaign): ReadCampaignFileResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not a Campaign File (it is not valid JSON).' }
  }
  if (!isRecord(parsed)) return { ok: false, error: NOT_A_CAMPAIGN_FILE }

  if (!('schemaVersion' in parsed)) {
    // The unversioned app's exports were the bare campaign, recognised by these fields.
    const fromOldApp = typeof parsed.id === 'string' && Array.isArray(parsed.sorties) && Array.isArray(parsed.namedPilots)
    return { ok: false, error: fromOldApp ? FROM_OLDER_APP : NOT_A_CAMPAIGN_FILE }
  }
  const version = parsed.schemaVersion
  if (typeof version !== 'number' || !isRecord(parsed.campaign)) return { ok: false, error: NOT_A_CAMPAIGN_FILE }
  if (version > CAMPAIGN_SCHEMA_VERSION) return { ok: false, error: FROM_NEWER_APP }

  let upgraded: SavedData
  try {
    upgraded = runUpgrades(parsed as SavedData, version, CAMPAIGN_SCHEMA_VERSION, UPGRADE_STEPS)
  } catch {
    return { ok: false, error: FROM_OLDER_APP }
  }
  if (!looksLikeCampaign(upgraded.campaign)) return { ok: false, error: NOT_A_CAMPAIGN_FILE }

  const file: CampaignFile = {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    exportedAt: typeof upgraded.exportedAt === 'string' ? upgraded.exportedAt : '',
    latestSortie: latestSortie(upgraded.campaign),
    campaign: upgraded.campaign,
  }
  return { ok: true, file, olderThanBrowser: compareWithBrowser(file, browserCampaign) }
}

function compareWithBrowser(file: CampaignFile, browserCampaign: Campaign): OlderThanBrowser | null {
  if (file.campaign.id !== browserCampaign.id) return null
  const browserLatest = latestSortie(browserCampaign)
  const filePlayed = file.latestSortie?.playOrder ?? 0
  const browserPlayed = browserLatest?.playOrder ?? 0
  if (filePlayed >= browserPlayed) return null
  return { fileProgress: progressLabel(file.latestSortie), browserProgress: progressLabel(browserLatest) }
}

export function hasCampaignData(campaign: Campaign): boolean {
  return [campaign.name, campaign.forceName, campaign.commandingOfficer].some(text => text.trim() !== '')
    || [campaign.units, campaign.namedPilots, campaign.sorties, campaign.memorial].some(list => list.length > 0)
}
