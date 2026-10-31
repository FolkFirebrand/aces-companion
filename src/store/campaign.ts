import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type {
  Campaign, Unit, NamedPilot, MemorialEntry,
  Sortie, PurchaseEntry, StatTrack, FieldedUnit, HireRequest, SetupDraft, BattleMarks, SortieBattle, OpposingUnit
} from '@/lib/types'
import {
  selectAvailableSP, selectCompletionBlockers, selectEffectivePilot, selectMvpCandidates, selectPilotHasSortieSp,
  selectPilotShares, selectReopenBlocker, selectHireBlocker, selectDismissBlocker, MAX_NAMED_PILOTS,
  selectSetupForceErrors, selectSetupPilotErrors, selectTotalRosterPV, selectWarchestBalance, selectCanEditStartingForce,
} from './selectors'
import { configurationStats } from '@/lib/unit-list/convert'
import { battleDamageState, commitUnit, sortieBattle, trulyDestroyedCause, unitBattle, withPending } from '@/lib/battle'
import { addCopies } from '@/lib/opposing-force'
import type { OpposingTemplate } from '@/lib/opposing-force'
import type { UnitListEntry } from '@/lib/unit-list/convert'
import { FORCE_PV_LIMIT, NAMED_PILOT_STARTING_SP, SP_PER_UNSPENT_PV, existingForceStartingWarchest, omniReconfigurationCost, purchasePrice, salePrice, setupStartingWarchest } from '@/lib/rules'
import { applySortie, revertSortie } from '@/lib/sortie-effects'
import {
  CAMPAIGN_SCHEMA_VERSION, UPGRADE_STEPS, runUpgrades, createCampaignFile,
  readCampaignFile, hasCampaignData,
} from '@/lib/campaign-file'
import type { CampaignFile, ReadCampaignFileResult, SavedData } from '@/lib/campaign-file'

// Aces Rulebook: a new force starts with 400 SP (setup adds 40 SP per unspent PV).
const STARTING_WARCHEST = 400

function defaultCampaign(): Campaign {
  return {
    id: uuidv4(),
    name: '',
    forceName: '',
    commandingOfficer: '',
    difficultyLevel: 'standard',
    customPvPercent: 0,
    customSpPercent: 100,
    startingWarchest: STARTING_WARCHEST,
    units: [],
    namedPilots: [],
    memorial: [],
    sorties: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const trackField: Record<StatTrack, 'spSpentOnSkill' | 'spSpentOnEdgeTokens' | 'spSpentOnEdgeAbilities'> = {
  skill: 'spSpentOnSkill',
  edgeTokens: 'spSpentOnEdgeTokens',
  edgeAbilities: 'spSpentOnEdgeAbilities',
}

function touch(campaign: Campaign): Campaign {
  return { ...campaign, updatedAt: new Date().toISOString() }
}

function withDraftSortie(campaign: Campaign, sortieId: string, change: (sortie: Sortie) => Partial<Sortie>) {
  const sortie = campaign.sorties.find(s => s.id === sortieId)
  if (!sortie || sortie.status !== 'draft') return { campaign }
  return { campaign: touch({ ...campaign, sorties: campaign.sorties.map(s => (s.id === sortieId ? { ...s, ...change(s) } : s)) }) }
}

// Play mode changes a draft sortie's battle; the roster's units give each card its structure (ADR 0002).
function withBattle(campaign: Campaign, sortieId: string, change: (battle: SortieBattle, units: Record<string, Unit>) => SortieBattle) {
  const sortie = campaign.sorties.find(s => s.id === sortieId)
  if (!sortie || sortie.status !== 'draft') return { campaign }
  // Cards are Fielded Units (the roster's units) and the sortie's Opposing Force (#42).
  const units: Record<string, Unit> = Object.fromEntries([
    ...campaign.units.map(u => [u.id, u]),
    ...(sortie.opposingForce ?? []).map(u => [u.id, { ...u, pilotId: null, totalSpEarned: 0 }]),
  ])
  const battle = change(sortieBattle(sortie.battle), units)
  return { campaign: touch({ ...campaign, sorties: campaign.sorties.map(s => (s.id === sortieId ? { ...s, battle } : s)) }) }
}

// The Force Commander must be a Named Pilot fielded in the sortie.
function withValidCommander(sortie: Sortie): Sortie {
  const stillFielded = sortie.fieldedUnits.some(f => f.pilotId !== null && f.pilotId === sortie.forceCommanderPilotId)
  return stillFielded ? sortie : { ...sortie, forceCommanderPilotId: null }
}

// Setup's Starting Warchest is a base plus 40 SP per unspent PV, so a change to the starting force moves it by that much.
function withStartingForce(campaign: Campaign, units: Unit[]) {
  if (!selectCanEditStartingForce(campaign)) return { campaign }
  const bonus = (list: Unit[]) => Math.max(0, FORCE_PV_LIMIT - selectTotalRosterPV(list)) * SP_PER_UNSPENT_PV
  const startingWarchest = campaign.startingWarchest - bonus(campaign.units) + bonus(units)
  return { campaign: touch({ ...campaign, units, startingWarchest }) }
}

type SetCampaign = (fn: (s: { campaign: Campaign }) => { campaign: Campaign }) => void

function addPurchaseTo(set: SetCampaign, sortieId: string, purchase: PurchaseEntry) {
  set(s => ({
    campaign: touch({
      ...s.campaign,
      sorties: s.campaign.sorties.map(s2 =>
        s2.id === sortieId ? { ...s2, purchases: [...s2.purchases, purchase] } : s2
      ),
    }),
  }))
}

function emptySetup(): SetupDraft {
  return {
    step: 1, name: '', forceName: '', commandingOfficer: '', difficultyLevel: 'standard', customPvPercent: 0,
    customSpPercent: 100, units: [], pilots: [], chassisConfirmed: false,
  }
}

interface CampaignStore {
  campaign: Campaign
  /** A new campaign being set up; kept (and saved) until started or cancelled. */
  setupDraft: SetupDraft | null
  startSetup: () => void
  /** Starts a setup that carries over a finished campaign's force and Named Pilots. */
  startExistingForceSetup: (finished: Campaign) => void
  updateSetup: (partial: Partial<SetupDraft>) => void
  addSetupUnit: (unit: Unit) => void
  removeSetupUnit: (unitId: string) => void
  addSetupPilot: (pilot: NamedPilot) => void
  updateSetupPilot: (pilotId: string, partial: Partial<NamedPilot>) => void
  removeSetupPilot: (pilotId: string) => void
  cancelSetup: () => void
  /** Replaces the campaign in this browser with the new one; false if a setup rule is broken. */
  finishSetup: () => boolean
  updateCampaignMeta: (partial: Partial<Campaign>) => void
  addUnit: (unit: Unit) => void
  updateUnit: (id: string, partial: Partial<Unit>) => void
  removeUnit: (id: string) => void
  /** Build the Force from the Roster, before the first sortie: unspent PV still converts to SP. */
  addStartingUnit: (unit: Unit) => void
  removeStartingUnit: (id: string) => void
  assignPilot: (unitId: string, pilotId: string | null) => void
  addPilot: (pilot: NamedPilot) => void
  updatePilot: (id: string, partial: Partial<NamedPilot>) => void
  spendOnStat: (pilotId: string, track: StatTrack, cost: number) => void
  refundStat: (pilotId: string, track: StatTrack, cost: number) => void
  addToMemorial: (entry: MemorialEntry) => void
  addMemorialEntry: (entry: Pick<MemorialEntry, 'name' | 'type' | 'note'>) => string
  updateMemorialEntry: (id: string, partial: Partial<Pick<MemorialEntry, 'name' | 'type' | 'note'>>) => void
  updateFieldedUnit: (sortieId: string, unitId: string, partial: Partial<FieldedUnit>) => void
  /** Play mode (#41): change a Fielded Unit's pending marks; Apply or End Round commits them. */
  markBattle: (sortieId: string, unitId: string, change: Partial<BattleMarks>) => void
  applyBattle: (sortieId: string, unitId: string) => void
  discardBattle: (sortieId: string, unitId: string) => void
  /** Commits every unit's pending marks and starts the next round. */
  endRound: (sortieId: string) => void
  /** Drops every unit's pending marks, on both sides. */
  discardAllBattle: (sortieId: string) => void
  /** After-Sortie step 3 (#46): fills in Fielded Units' Damage States from play mode, except those set by hand. */
  syncBattleResults: (sortieId: string) => void
  setBattleNotes: (sortieId: string, unitId: string, notes: string) => void
  /** Links a custom unit to a unit-list entry (#37): its stats and icon, keeping its name, pilot, photo and history. */
  linkUnit: (unitId: string, entry: UnitListEntry, keepPv: boolean) => void
  /** Sortie Setup step 6 (#40): add copies of an enemy unit, numbered when there is more than one. */
  addOpposingCopies: (sortieId: string, template: OpposingTemplate, count: number) => void
  updateOpposingUnit: (sortieId: string, unitId: string, partial: Partial<Pick<OpposingUnit, 'nameAndVariant' | 'skill'>>) => void
  removeOpposingUnit: (sortieId: string, unitId: string) => void
  removeFromMemorial: (id: string) => void
  addSortie: () => string
  updateSortie: (id: string, partial: Partial<Sortie>) => void
  deleteSortie: (id: string) => void
  setStepDone: (sortieId: string, stepId: string, done: boolean) => void
  buyUnit: (sortieId: string, unit: Unit) => void
  sellUnit: (sortieId: string, unitId: string) => void
  /** `toEntry`, a configuration from the unit list, also brings that configuration's stats on completion. */
  reconfigureOmni: (sortieId: string, unitId: string, toName: string, toPv: number, toEntry?: UnitListEntry) => void
  completeSortie: (sortieId: string) => void
  hirePilot: (sortieId: string, hire: HireRequest) => void
  removeHire: (sortieId: string, pilotId: string) => void
  dismissPilot: (pilotId: string) => void
  setPilotAllocation: (sortieId: string, pilotId: string, track: StatTrack, amount: number) => void
  setMvp: (sortieId: string, pilotId: string | null) => void
  setFielded: (sortieId: string, unitId: string, fielded: boolean) => void
  assignFieldedPilot: (sortieId: string, unitId: string, pilotId: string | null) => void
  setForceCommander: (sortieId: string, pilotId: string | null) => void
  reopenSortie: (sortieId: string) => void
  removePurchase: (sortieId: string, purchaseId: string) => void
  exportCampaignFile: (now?: Date) => { fileName: string; contents: string }
  readCampaignFile: (text: string) => ReadCampaignFileResult
  loadCampaignFile: (file: CampaignFile) => void
  hasCampaignData: () => boolean
  resetStore: () => void
}

export const useCampaignStore = create<CampaignStore>()(
  persist(
    (set, get) => ({
      campaign: defaultCampaign(),
      setupDraft: null,

      startSetup: () => set(s => ({ setupDraft: s.setupDraft ?? emptySetup() })),

      startExistingForceSetup: (finished) => set({
        setupDraft: {
          ...emptySetup(),
          forceName: finished.forceName,
          commandingOfficer: finished.commandingOfficer,
          units: finished.units,
          pilots: finished.namedPilots.map(p => {
            const pilot = selectEffectivePilot(finished, p)
            return {
              ...pilot,
              carriedOverSp: pilot.totalSpEarned - NAMED_PILOT_STARTING_SP,
              campaignHistory: finished.name ? [...pilot.campaignHistory, finished.name] : pilot.campaignHistory,
            }
          }),
          existingForce: {
            fromCampaign: finished.name,
            warchest: selectWarchestBalance(finished),
            unitIds: finished.units.map(u => u.id),
          },
        },
      }),

      updateSetup: (partial) => set(s => (s.setupDraft ? { setupDraft: { ...s.setupDraft, ...partial } } : s)),

      addSetupUnit: (unit) => set(s => (s.setupDraft ? { setupDraft: { ...s.setupDraft, units: [...s.setupDraft.units, unit] } } : s)),

      removeSetupUnit: (unitId) =>
        set(s => (s.setupDraft ? { setupDraft: { ...s.setupDraft, units: s.setupDraft.units.filter(u => u.id !== unitId) } } : s)),

      addSetupPilot: (pilot) =>
        set(s => (s.setupDraft && s.setupDraft.pilots.length < MAX_NAMED_PILOTS
          ? { setupDraft: { ...s.setupDraft, pilots: [...s.setupDraft.pilots, pilot] } }
          : s)),

      updateSetupPilot: (pilotId, partial) =>
        set(s => (s.setupDraft
          ? { setupDraft: { ...s.setupDraft, pilots: s.setupDraft.pilots.map(p => (p.id === pilotId ? { ...p, ...partial } : p)) } }
          : s)),

      removeSetupPilot: (pilotId) =>
        set(s => (s.setupDraft ? { setupDraft: { ...s.setupDraft, pilots: s.setupDraft.pilots.filter(p => p.id !== pilotId) } } : s)),

      cancelSetup: () => set({ setupDraft: null }),

      finishSetup: () => {
        const draft = get().setupDraft
        if (!draft || selectSetupForceErrors(draft).length > 0 || selectSetupPilotErrors(draft).length > 0) return false
        const now = new Date().toISOString()
        const campaign: Campaign = {
          ...defaultCampaign(),
          name: draft.name.trim(),
          forceName: draft.forceName.trim(),
          commandingOfficer: draft.commandingOfficer.trim(),
          difficultyLevel: draft.difficultyLevel,
          customPvPercent: draft.customPvPercent,
          customSpPercent: draft.customSpPercent,
          startingWarchest: draft.existingForce
            ? existingForceStartingWarchest(draft.existingForce.warchest, selectTotalRosterPV(draft.units))
            : setupStartingWarchest(selectTotalRosterPV(draft.units)),
          ...(draft.existingForce ? { existingForceFrom: draft.existingForce.fromCampaign } : {}),
          units: draft.units,
          namedPilots: draft.pilots.map(p => ({ ...p, callsign: p.callsign.trim() })),
          createdAt: now,
          updatedAt: now,
        }
        set({ campaign, setupDraft: null })
        return true
      },

      updateCampaignMeta: (partial) =>
        set(s => ({ campaign: touch({ ...s.campaign, ...partial }) })),

      addUnit: (unit) =>
        set(s => ({ campaign: touch({ ...s.campaign, units: [...s.campaign.units, unit] }) })),

      updateUnit: (id, partial) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            units: s.campaign.units.map(u => u.id === id ? { ...u, ...partial } : u),
          }),
        })),

      removeUnit: (id) =>
        set(s => ({ campaign: touch({ ...s.campaign, units: s.campaign.units.filter(u => u.id !== id) }) })),

      addStartingUnit: (unit) =>
        set(s => withStartingForce(s.campaign, [...s.campaign.units, unit])),

      removeStartingUnit: (id) =>
        set(s => withStartingForce(s.campaign, s.campaign.units.filter(u => u.id !== id))),

      assignPilot: (unitId, pilotId) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            units: s.campaign.units.map(u => {
              if (u.pilotId === pilotId && pilotId !== null) return { ...u, pilotId: null }
              if (u.id === unitId) return { ...u, pilotId }
              return u
            }),
          }),
        })),

      addPilot: (pilot) =>
        set(s => ({ campaign: touch({ ...s.campaign, namedPilots: [...s.campaign.namedPilots, pilot] }) })),

      updatePilot: (id, partial) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            namedPilots: s.campaign.namedPilots.map(p => p.id === id ? { ...p, ...partial } : p),
          }),
        })),

      spendOnStat: (pilotId, track, cost) =>
        set(s => {
          const pilot = s.campaign.namedPilots.find(p => p.id === pilotId)
          if (!pilot || selectPilotHasSortieSp(s.campaign, pilotId)) return s
          if (selectAvailableSP(selectEffectivePilot(s.campaign, pilot)) < cost) return s
          const field = trackField[track]
          return {
            campaign: touch({
              ...s.campaign,
              namedPilots: s.campaign.namedPilots.map(p =>
                p.id === pilotId ? { ...p, [field]: p[field] + cost } : p
              ),
            }),
          }
        }),

      refundStat: (pilotId, track, cost) =>
        set(s => {
          if (selectPilotHasSortieSp(s.campaign, pilotId)) return s
          const field = trackField[track]
          return {
            campaign: touch({
              ...s.campaign,
              namedPilots: s.campaign.namedPilots.map(p =>
                p.id === pilotId ? { ...p, [field]: Math.max(0, p[field] - cost) } : p
              ),
            }),
          }
        }),

      addToMemorial: (entry) =>
        set(s => ({ campaign: touch({ ...s.campaign, memorial: [...s.campaign.memorial, entry] }) })),

      addMemorialEntry: (entry) => {
        const id = uuidv4()
        set(s => ({ campaign: touch({ ...s.campaign, memorial: [...s.campaign.memorial, { id, ...entry, reason: 'manual' }] }) }))
        return id
      },

      updateMemorialEntry: (id, partial) =>
        set(s => ({
          campaign: touch({ ...s.campaign, memorial: s.campaign.memorial.map(m => m.id === id ? { ...m, ...partial } : m) }),
        })),

      updateFieldedUnit: (sortieId, unitId, partial) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            sorties: s.campaign.sorties.map(s2 =>
              s2.id === sortieId && s2.status === 'draft'
                ? { ...s2, fieldedUnits: s2.fieldedUnits.map(f => f.unitId === unitId ? { ...f, ...partial } : f) }
                : s2
            ),
          }),
        })),

      markBattle: (sortieId, unitId, change) =>
        set(s => withBattle(s.campaign, sortieId, (battle) => ({
          ...battle, units: { ...battle.units, [unitId]: withPending(unitBattle(battle, unitId), change) },
        }))),

      applyBattle: (sortieId, unitId) =>
        set(s => withBattle(s.campaign, sortieId, (battle, units) => ({
          ...battle, units: { ...battle.units, [unitId]: commitUnit(unitBattle(battle, unitId), battle.round, units[unitId] ?? {}) },
        }))),

      discardBattle: (sortieId, unitId) =>
        set(s => withBattle(s.campaign, sortieId, (battle) => ({
          ...battle, units: { ...battle.units, [unitId]: { ...unitBattle(battle, unitId), pending: undefined } },
        }))),

      endRound: (sortieId) =>
        set(s => withBattle(s.campaign, sortieId, (battle, units) => ({
          round: battle.round + 1,
          units: Object.fromEntries(Object.entries(battle.units).map(([id, record]) => [id, commitUnit(record, battle.round, units[id] ?? {})])),
        }))),

      syncBattleResults: (sortieId) =>
        set(s => {
          const sortie = s.campaign.sorties.find(x => x.id === sortieId)
          if (!sortie || sortie.status !== 'draft' || sortie.outcome === 'failed' || !sortie.battle) return s
          let changed = false
          const fieldedUnits = sortie.fieldedUnits.map(f => {
            const unit = s.campaign.units.find(u => u.id === f.unitId)
            if (f.setByHand || !unit || !sortie.battle!.units[f.unitId]) return f
            const marks = unitBattle(sortie.battle, f.unitId).committed
            const damage = battleDamageState(marks, unit)
            const cause = trulyDestroyedCause(marks, unit)
            // Only the ammo case comes from play mode; emplacement and airborne crashes are still ticked by hand.
            const autoTrulyDestroyed = cause ?? (f.autoTrulyDestroyed === 'ammo' ? null : f.autoTrulyDestroyed)
            if (damage === f.damage && autoTrulyDestroyed === f.autoTrulyDestroyed) return f
            changed = true
            return { ...f, damage, autoTrulyDestroyed }
          })
          if (!changed) return s
          return { campaign: touch({ ...s.campaign, sorties: s.campaign.sorties.map(x => (x.id === sortieId ? { ...x, fieldedUnits } : x)) }) }
        }),

      discardAllBattle: (sortieId) =>
        set(s => withBattle(s.campaign, sortieId, (battle) => ({
          ...battle,
          units: Object.fromEntries(Object.entries(battle.units).map(([id, record]) => [id, { ...record, pending: undefined }])),
        }))),

      setBattleNotes: (sortieId, unitId, notes) =>
        set(s => withBattle(s.campaign, sortieId, (battle) => ({
          ...battle, units: { ...battle.units, [unitId]: { ...unitBattle(battle, unitId), notes } },
        }))),

      linkUnit: (unitId, entry, keepPv) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            units: s.campaign.units.map(u => {
              if (u.id !== unitId) return u
              const stats = configurationStats(entry)
              return { ...u, ...stats, nameAndVariant: u.nameAndVariant, pvAtSkill4: keepPv ? u.pvAtSkill4 : entry.pv }
            }),
          }),
        })),

      addOpposingCopies: (sortieId, template, count) =>
        set(s => withDraftSortie(s.campaign, sortieId, sortie => ({
          opposingForce: addCopies(sortie.opposingForce ?? [], template, count, uuidv4),
        }))),

      updateOpposingUnit: (sortieId, unitId, partial) =>
        set(s => withDraftSortie(s.campaign, sortieId, sortie => ({
          opposingForce: (sortie.opposingForce ?? []).map(u => (u.id === unitId ? { ...u, ...partial } : u)),
        }))),

      removeOpposingUnit: (sortieId, unitId) =>
        set(s => withDraftSortie(s.campaign, sortieId, sortie => ({
          opposingForce: (sortie.opposingForce ?? []).filter(u => u.id !== unitId),
        }))),

      removeFromMemorial: (id) =>
        set(s => ({ campaign: touch({ ...s.campaign, memorial: s.campaign.memorial.filter(m => m.id !== id) }) })),

      // One draft at a time: logging a sortie while one is in progress continues it.
      addSortie: () => {
        const draft = get().campaign.sorties.find(s => s.status === 'draft')
        if (draft) return draft.id
        const id = uuidv4()
        const sortieNumber = String(get().campaign.sorties.length + 1).padStart(2, '0')
        const sortie: Sortie = {
          id, sortieNumber,
          name: '',
          datePlayed: new Date().toISOString().split('T')[0],
          status: 'draft',
          stepsDone: [],
          outcome: 'victory',
          listedPv: 0,
          primaryObjective: 0, otherObjectives: 0,
          reconnaissanceCost: 0, reconnaissanceNote: '', waypointsSP: 0, waypointsGainedSP: 0, waypointsNote: '',
          legacyUnitsWithoutENE: 0, fieldedUnits: [], forceCommanderPilotId: null, legacyWoundedOrKilledCrew: 0, legacyNewReplacementPilots: 0, hires: [],
          legacyRepairs: [], legacyNamedPilotSp: 0, maxSpPerPilot: 0, mvpPilotId: null, pilotAllocations: [], pilotShares: [], purchases: [], keywordsGained: [], nextSortieNote: '',
          appliedEffects: null,
        }
        set(s => ({ campaign: touch({ ...s.campaign, sorties: [...s.campaign.sorties, sortie] }) }))
        return id
      },

      updateSortie: (id, partial) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            sorties: s.campaign.sorties.map(s2 => s2.id === id ? { ...s2, ...partial } : s2),
          }),
        })),

      deleteSortie: (id) =>
        set(s => ({ campaign: touch({ ...s.campaign, sorties: s.campaign.sorties.filter(s2 => s2.id !== id) }) })),

      setStepDone: (sortieId, stepId, done) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            sorties: s.campaign.sorties.map(s2 => {
              if (s2.id !== sortieId) return s2
              const others = s2.stepsDone.filter(id => id !== stepId)
              return { ...s2, stepsDone: done ? [...others, stepId] : others }
            }),
          }),
        })),

      buyUnit: (sortieId, unit) =>
        addPurchaseTo(set, sortieId, { id: uuidv4(), kind: 'buy', unit, spCost: purchasePrice(unit.pvAtSkill4) }),

      sellUnit: (sortieId, unitId) => {
        const unit = get().campaign.units.find(u => u.id === unitId)
        if (!unit) return
        addPurchaseTo(set, sortieId, {
          id: uuidv4(), kind: 'sell', unitId, unitName: unit.nameAndVariant,
          pvAtSkill4: unit.pvAtSkill4, spCost: -salePrice(unit.pvAtSkill4),
        })
      },

      reconfigureOmni: (sortieId, unitId, toName, toPv, toEntry) => {
        const unit = get().campaign.units.find(u => u.id === unitId)
        if (!unit) return
        addPurchaseTo(set, sortieId, {
          id: uuidv4(), kind: 'omni', unitId, fromName: unit.nameAndVariant, toName,
          fromPv: unit.pvAtSkill4, toPv, spCost: omniReconfigurationCost(unit.pvAtSkill4, toPv, unit.size ?? 1),
          ...(toEntry ? { toUnit: configurationStats(toEntry) } : {}),
        })
      },

      setFielded: (sortieId, unitId, fielded) =>
        set(s => {
          const unit = s.campaign.units.find(u => u.id === unitId)
          return {
            campaign: touch({
              ...s.campaign,
              sorties: s.campaign.sorties.map(s2 => {
                if (s2.id !== sortieId || s2.status !== 'draft') return s2
                const others = s2.fieldedUnits.filter(f => f.unitId !== unitId)
                if (!fielded || !unit) return withValidCommander({ ...s2, fieldedUnits: others })
                // The roster's assignment carries over, unless that pilot is Wounded or already fielded.
                const rosterPilot = s.campaign.namedPilots.find(p => p.id === unit.pilotId)
                const pilotId = rosterPilot && !rosterPilot.wounded && !others.some(f => f.pilotId === rosterPilot.id)
                  ? rosterPilot.id : null
                const entry: FieldedUnit = {
                  unitId, nameAndVariant: unit.nameAndVariant, unitType: unit.unitType,
                  pvAtSkill4: unit.pvAtSkill4, size: unit.size, ene: unit.ene, pilotId,
                  damage: 'undamaged', autoTrulyDestroyed: null, salvageRoll: null, crewMode: 'roll', crewRoll: null,
                }
                return { ...s2, fieldedUnits: [...others, entry] }
              }),
            }),
          }
        }),

      assignFieldedPilot: (sortieId, unitId, pilotId) =>
        set(s => {
          if (pilotId && s.campaign.namedPilots.find(p => p.id === pilotId)?.wounded !== false) return s
          return {
            campaign: touch({
              ...s.campaign,
              sorties: s.campaign.sorties.map(s2 => {
                if (s2.id !== sortieId || s2.status !== 'draft') return s2
                // A pilot already on another fielded unit moves here, leaving a generic crew behind.
                const fieldedUnits = s2.fieldedUnits.map(f =>
                  f.unitId === unitId ? { ...f, pilotId } : pilotId && f.pilotId === pilotId ? { ...f, pilotId: null } : f
                )
                return withValidCommander({ ...s2, fieldedUnits })
              }),
            }),
          }
        }),

      setForceCommander: (sortieId, pilotId) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            sorties: s.campaign.sorties.map(s2 =>
              s2.id === sortieId && (pilotId === null || s2.fieldedUnits.some(f => f.pilotId === pilotId))
                ? { ...s2, forceCommanderPilotId: pilotId }
                : s2
            ),
          }),
        })),

      setPilotAllocation: (sortieId, pilotId, track, amount) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            sorties: s.campaign.sorties.map(s2 => {
              if (s2.id !== sortieId || s2.status !== 'draft') return s2
              const existing = s2.pilotAllocations.find(a => a.pilotId === pilotId) ?? { pilotId, skill: 0, edgeTokens: 0, edgeAbilities: 0 }
              const updated = { ...existing, [track]: Math.max(0, Math.round(amount)) }
              return { ...s2, pilotAllocations: [...s2.pilotAllocations.filter(a => a.pilotId !== pilotId), updated] }
            }),
          }),
        })),

      setMvp: (sortieId, pilotId) =>
        set(s => {
          const sortie = s.campaign.sorties.find(s2 => s2.id === sortieId)
          if (!sortie || sortie.status !== 'draft') return s
          if (pilotId && !selectMvpCandidates(s.campaign, sortie).some(c => c.pilotId === pilotId)) return s
          return {
            campaign: touch({
              ...s.campaign,
              sorties: s.campaign.sorties.map(s2 => (s2.id === sortieId ? { ...s2, mvpPilotId: pilotId } : s2)),
            }),
          }
        }),

      // Aces Rulebook: a new Named Pilot costs 150 SP and starts with 150 SP to spend.
      hirePilot: (sortieId, hire) =>
        set(s => {
          const sortie = s.campaign.sorties.find(s2 => s2.id === sortieId)
          const total = hire.skill + hire.edgeTokens + hire.edgeAbilities
          if (!sortie || selectHireBlocker(s.campaign, sortie) !== null || total !== 150 || !hire.callsign.trim()) return s
          const pilot: NamedPilot = {
            id: uuidv4(), callsign: hire.callsign.trim(), pilotType: hire.pilotType, wounded: false, mvpCount: 0,
            totalSpEarned: 150, spSpentOnSkill: hire.skill, spSpentOnEdgeTokens: hire.edgeTokens, spSpentOnEdgeAbilities: hire.edgeAbilities,
            edgeAbilitiesLearned: [], campaignHistory: [],
          }
          return {
            campaign: touch({
              ...s.campaign,
              sorties: s.campaign.sorties.map(s2 => (s2.id === sortieId ? { ...s2, hires: [...s2.hires, pilot] } : s2)),
            }),
          }
        }),

      removeHire: (sortieId, pilotId) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            sorties: s.campaign.sorties.map(s2 =>
              s2.id === sortieId && s2.status === 'draft' ? { ...s2, hires: s2.hires.filter(p => p.id !== pilotId) } : s2
            ),
          }),
        })),

      dismissPilot: (pilotId) =>
        set(s => {
          const pilot = s.campaign.namedPilots.find(p => p.id === pilotId)
          if (!pilot || selectDismissBlocker(s.campaign, pilotId) !== null) return s
          return {
            campaign: touch({
              ...s.campaign,
              namedPilots: s.campaign.namedPilots.filter(p => p.id !== pilotId),
              units: s.campaign.units.map(u => (u.pilotId === pilotId ? { ...u, pilotId: null } : u)),
              memorial: [...s.campaign.memorial, { id: uuidv4(), name: pilot.callsign, type: 'pilot', reason: 'dismissed' }],
            }),
          }
        }),

      completeSortie: (sortieId) =>
        set(s => {
          const sortie = s.campaign.sorties.find(s2 => s2.id === sortieId)
          if (!sortie || sortie.status === 'completed' || selectCompletionBlockers(sortie, s.campaign).length > 0) return s
          // A Failed Sortie is recorded but changes nothing.
          if (sortie.outcome === 'failed') {
            return {
              campaign: touch({
                ...s.campaign,
                sorties: s.campaign.sorties.map(s2 =>
                  s2.id === sortieId ? { ...s2, status: 'completed' as const, appliedEffects: null } : s2
                ),
              }),
            }
          }
          const pilotShares = selectPilotShares(s.campaign, sortie)
          const { units, namedPilots, memorial, effects } = applySortie(s.campaign, sortie, uuidv4)
          return {
            campaign: touch({
              ...s.campaign,
              units,
              namedPilots,
              memorial,
              sorties: s.campaign.sorties.map(s2 =>
                s2.id === sortieId ? { ...s2, status: 'completed' as const, appliedEffects: effects, pilotShares } : s2
              ),
            }),
          }
        }),

      reopenSortie: (sortieId) =>
        set(s => {
          if (selectReopenBlocker(s.campaign, sortieId) !== null) return s
          const sortie = s.campaign.sorties.find(s2 => s2.id === sortieId)!
          const reverted = sortie.appliedEffects ? revertSortie(s.campaign, sortie.appliedEffects) : {}
          return {
            campaign: touch({
              ...s.campaign,
              ...reverted,
              sorties: s.campaign.sorties.map(s2 =>
                s2.id === sortieId ? { ...s2, status: 'draft' as const, appliedEffects: null, pilotShares: [] } : s2
              ),
            }),
          }
        }),

      removePurchase: (sortieId, purchaseId) =>
        set(s => ({
          campaign: touch({
            ...s.campaign,
            sorties: s.campaign.sorties.map(s2 =>
              s2.id === sortieId
                ? { ...s2, purchases: s2.purchases.filter(p => p.id !== purchaseId) }
                : s2
            ),
          }),
        })),

      exportCampaignFile: (now = new Date()) => createCampaignFile(get().campaign, now),

      readCampaignFile: (text) => readCampaignFile(text, get().campaign),

      loadCampaignFile: (file) => set({ campaign: file.campaign }),

      hasCampaignData: () => hasCampaignData(get().campaign),

      resetStore: () => set({ campaign: defaultCampaign(), setupDraft: null }),
    }),
    {
      name: 'aces-campaign',
      version: CAMPAIGN_SCHEMA_VERSION,
      // Clean break (ADR 0001): data saved before the versioned schema is discarded.
      migrate: (persistedState: unknown, fromVersion: number) => {
        if (fromVersion < CAMPAIGN_SCHEMA_VERSION && !(fromVersion in UPGRADE_STEPS)) {
          return { campaign: defaultCampaign() }
        }
        return runUpgrades(persistedState as SavedData, fromVersion, CAMPAIGN_SCHEMA_VERSION, UPGRADE_STEPS)
      },
    }
  )
)
