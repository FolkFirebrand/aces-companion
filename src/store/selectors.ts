import type { NamedPilot, Sortie, Campaign, Unit, FieldedUnit, CrewOutcome, PilotShare, StatTrack, SetupDraft } from '@/lib/types'
import { UNIT_TYPES } from '@/lib/types'
import { REPAIR_MULTIPLIERS } from '@/lib/types'
import {
  FORCE_PV_LIMIT, MIN_SETUP_UNITS,
  DIFFICULTY_LEVELS, REPAIR_COST_PER_SIZE, applyPercent, crewOutcomeFromRoll, existingForceModifier, repairSize, salvageTarget,
} from '@/lib/rules'
import { STEPS } from '@/lib/steps'
import type { StepDefinition } from '@/lib/steps'
import {
  lookupStatFromSP, nextTierCost,
  SKILL_THRESHOLDS, EDGE_TOKEN_THRESHOLDS, EDGE_ABILITY_THRESHOLDS
} from '@/lib/thresholds'

export function selectAvailableSP(pilot: NamedPilot): number {
  return pilot.totalSpEarned - pilot.spSpentOnSkill - pilot.spSpentOnEdgeTokens - pilot.spSpentOnEdgeAbilities
}

export function selectPilotSkill(pilot: NamedPilot): number {
  return lookupStatFromSP(pilot.spSpentOnSkill, SKILL_THRESHOLDS)
}

export function selectPilotEdgeTokens(pilot: NamedPilot): number {
  return lookupStatFromSP(pilot.spSpentOnEdgeTokens, EDGE_TOKEN_THRESHOLDS)
}

export function selectPilotEdgeAbilities(pilot: NamedPilot): number {
  return lookupStatFromSP(pilot.spSpentOnEdgeAbilities, EDGE_ABILITY_THRESHOLDS)
}

export function selectDifficulty(campaign: Campaign): { pvPercent: number; spPercent: number } {
  if (campaign.difficultyLevel === 'custom') {
    return { pvPercent: campaign.customPvPercent, spPercent: campaign.customSpPercent }
  }
  const { pvPercent, spPercent } = DIFFICULTY_LEVELS[campaign.difficultyLevel]
  return { pvPercent, spPercent }
}

export function selectDifficultyName(campaign: Campaign): string {
  return campaign.difficultyLevel === 'custom' ? 'Custom' : DIFFICULTY_LEVELS[campaign.difficultyLevel].name
}

// Until pilot SP is derived from the log (#13), this uses each pilot's current Total SP Earned.
// Aces Rulebook p. 29: for an Existing Force, the modifier follows the pilots' current totals, so it
// changes from the sortie where they reach a new threshold.
export function selectExistingForceModifier(campaign: Campaign): number {
  const pilots = campaign.existingForceFrom ? campaign.namedPilots.map(p => selectEffectivePilot(campaign, p)) : campaign.namedPilots
  return existingForceModifier(pilots.reduce((sum, p) => sum + p.totalSpEarned, 0))
}

export function selectPvLimit(campaign: Campaign, sortie: Sortie): number {
  const percent = 100 + selectDifficulty(campaign).pvPercent + selectExistingForceModifier(campaign)
  return applyPercent(sortie.listedPv, percent)
}

export function selectTotalIncome(campaign: Campaign, sortie: Sortie): number {
  return applyPercent(sortie.primaryObjective + sortie.otherObjectives, selectDifficulty(campaign).spPercent)
}

/** The Sortie Log's Waypoints line: SP paid less SP gained, so a net gain lowers the expenses (p. 34). */
export function selectWaypointsNet(sortie: Sortie): number {
  return sortie.waypointsSP - sortie.waypointsGainedSP
}

export function selectTotalExpenses(sortie: Sortie): number {
  const rearming = selectRearmingUnits(sortie) * 20
  return sortie.reconnaissanceCost + selectWaypointsNet(sortie) + rearming + selectPersonnelCost(sortie) + selectRepairCost(sortie)
}

export function selectSortieEarnings(campaign: Campaign, sortie: Sortie): number {
  return selectTotalIncome(campaign, sortie) - selectTotalExpenses(sortie)
}

export interface CampaignLogRow {
  sortie: Sortie
  playOrder: number
  status: Sortie['status']
  /** Only a completed, non-Failed sortie changes the Warchest. */
  counts: boolean
  earnings: number
  namedPilotSp: number
  purchases: number
  warchest: number
}

// The paper Campaign Log, row by row: Warchest = previous + Earnings − Named Pilots' SP − Purchases.
// A Failed Sortie is listed but changes nothing (ADR 0001).
export function selectCampaignLog(campaign: Campaign): CampaignLogRow[] {
  let warchest = campaign.startingWarchest
  return campaign.sorties.map((sortie, index) => {
    const counts = sortie.status === 'completed' && sortie.outcome !== 'failed'
    const earnings = counts ? selectSortieEarnings(campaign, sortie) : 0
    const namedPilotSp = counts
      ? computePilotShares(campaign, sortie, warchest, earnings).reduce((sum, p) => sum + p.share, 0) + sortie.legacyNamedPilotSp
      : 0
    const purchases = counts ? sortie.purchases.reduce((sum, p) => sum + p.spCost, 0) : 0
    warchest += earnings - namedPilotSp - purchases
    return { sortie, playOrder: index + 1, status: sortie.status, counts, earnings, namedPilotSp, purchases, warchest }
  })
}

export function selectWarchestBalance(campaign: Campaign): number {
  const rows = selectCampaignLog(campaign)
  return rows.length > 0 ? rows[rows.length - 1].warchest : campaign.startingWarchest
}

export function selectNextSkillCost(pilot: NamedPilot): number | null {
  return nextTierCost(pilot.spSpentOnSkill, SKILL_THRESHOLDS)
}

export function selectNextEdgeTokenCost(pilot: NamedPilot): number | null {
  return nextTierCost(pilot.spSpentOnEdgeTokens, EDGE_TOKEN_THRESHOLDS)
}

export function selectNextEdgeAbilityCost(pilot: NamedPilot): number | null {
  return nextTierCost(pilot.spSpentOnEdgeAbilities, EDGE_ABILITY_THRESHOLDS)
}

export function selectTotalRosterPV(units: Unit[]): number {
  return units.reduce((sum, u) => sum + u.pvAtSkill4, 0)
}

export function selectAssignedPilot(units: Unit[], namedPilots: NamedPilot[], unitId: string): NamedPilot | undefined {
  const unit = units.find(u => u.id === unitId)
  if (!unit?.pilotId) return undefined
  return namedPilots.find(p => p.id === unit.pilotId)
}

export function selectPilotAssignedUnit(units: Unit[], pilotId: string): Unit | undefined {
  return units.find(u => u.pilotId === pilotId)
}

export function selectSortieSteps(sortie: Sortie): (StepDefinition & { done: boolean })[] {
  return STEPS.map(step => ({ ...step, done: sortie.stepsDone.includes(step.id) }))
}

// A Failed Sortie skips the after-sortie steps (Aces Rulebook p. 32), so only setup is required.
export function selectCompletionBlockers(sortie: Sortie, campaign?: Campaign): string[] {
  const steps = selectSortieSteps(sortie)
    .filter(step => !step.done && (sortie.outcome !== 'failed' || step.section === 'setup'))
    .map(step => step.name)
  if (sortie.outcome === 'failed') return steps
  const rolls = sortie.fieldedUnits.flatMap(f => [
    ...(selectTrulyDestroyed(f) === null ? [`Check for Casualties: salvage roll for ${f.nameAndVariant}`] : []),
    ...(selectCrewOutcome(f) === null ? [`Check for Casualties: crew roll for ${f.nameAndVariant}`] : []),
  ])
  return [...steps, ...rolls, ...(campaign ? selectImproveBlockers(campaign, sortie) : [])]
}

// ADR 0002: only the latest sortie can be reopened, because later ones were set up against it.
export function selectReopenBlocker(campaign: Campaign, sortieId: string): string | null {
  const index = campaign.sorties.findIndex(s => s.id === sortieId)
  if (index < 0 || campaign.sorties[index].status !== 'completed') return 'This sortie is not completed.'
  if (index !== campaign.sorties.length - 1) return 'Only the latest sortie can be reopened.'
  return null
}

function countsForCampaign(sortie: Sortie): boolean {
  return sortie.status === 'completed' && sortie.outcome !== 'failed'
}

// Derived, so reopening a sortie drops its Keywords unless another completed sortie also gained them.
export function selectCampaignKeywords(campaign: Campaign): string[] {
  const seen = new Map<string, string>()
  for (const sortie of campaign.sorties.filter(countsForCampaign)) {
    for (const keyword of sortie.keywordsGained) {
      const key = keyword.trim().toLowerCase()
      if (key && !seen.has(key)) seen.set(key, keyword.trim())
    }
  }
  return [...seen.values()]
}

export function selectNextSortieNote(campaign: Campaign): string | null {
  const latest = [...campaign.sorties].reverse().find(s => s.status === 'completed')
  return latest?.nextSortieNote.trim() || null
}

// An OMNI reconfigured in this sortie's setup is fielded at its new PV (Aces Rulebook p. 31).
export function selectFieldedPv(sortie: Sortie): number {
  return sortie.fieldedUnits.reduce((sum, f) => {
    const omni = [...sortie.purchases].reverse().find(p => p.kind === 'omni' && p.unitId === f.unitId)
    return sum + (omni && omni.kind === 'omni' ? omni.toPv : f.pvAtSkill4)
  }, 0)
}

export function selectParticipatingPilotIds(sortie: Sortie): string[] {
  return sortie.fieldedUnits.flatMap(f => (f.pilotId ? [f.pilotId] : []))
}

// Aces Rulebook p. 34: every unit fielded needs rearming, except those with ENE.
export function selectRearmingUnits(sortie: Sortie): number {
  return sortie.fieldedUnits.filter(f => !f.ene).length + sortie.legacyUnitsWithoutENE
}

/** True or false once decided; null while a destroyed unit still needs its Salvage Check. */
export function selectTrulyDestroyed(unit: FieldedUnit): boolean | null {
  if (unit.damage !== 'destroyed') return false
  if (unit.autoTrulyDestroyed) return true
  if (unit.salvageRoll === null) return null
  return unit.salvageRoll < salvageTarget(unit.unitType)
}

/** Crew Checks apply to destroyed units only; null while the roll is still to be made. */
export function selectCrewOutcome(unit: FieldedUnit): CrewOutcome | null {
  if (unit.damage !== 'destroyed') return 'unscathed'
  if (unit.crewMode === 'stunned') return 'wounded'
  if (unit.crewMode === 'killed') return 'killed'
  return unit.crewRoll === null ? null : crewOutcomeFromRoll(unit.crewRoll)
}

// Aces Rulebook p. 34: Size × 100 destroyed (salvaged), × 60 crippled, × 40 structure or criticals,
// × 20 armor only. Truly destroyed units aren't repaired.
export function selectUnitRepairCost(unit: FieldedUnit): number {
  if (unit.damage === 'undamaged' || selectTrulyDestroyed(unit) === true) return 0
  return repairSize(unit.unitType, unit.size) * REPAIR_COST_PER_SIZE[unit.damage]
}

export function selectRepairCost(sortie: Sortie): number {
  const legacy = sortie.legacyRepairs.reduce((sum, r) => sum + r.size * REPAIR_MULTIPLIERS[r.tier], 0)
  return sortie.fieldedUnits.reduce((sum, f) => sum + selectUnitRepairCost(f), 0) + legacy
}

// 100 SP to replace a generic crew killed or wounded, or to treat a wounded Named Pilot;
// 150 SP per new or replacement Named Pilot. A Named Pilot killed costs nothing here.
export function selectCrewCasualtyCount(sortie: Sortie): number {
  return sortie.fieldedUnits.filter(f => {
    const crew = selectCrewOutcome(f)
    return crew === 'wounded' || (crew === 'killed' && f.pilotId === null)
  }).length
}

export function selectPersonnelCost(sortie: Sortie): number {
  return (selectCrewCasualtyCount(sortie) + sortie.legacyWoundedOrKilledCrew) * 100 + selectNewPilotCount(sortie) * 150
}

const TRACK_FIELD: Record<StatTrack, 'skill' | 'edgeTokens' | 'edgeAbilities'> = { skill: 'skill', edgeTokens: 'edgeTokens', edgeAbilities: 'edgeAbilities' }
export { TRACK_FIELD }

export type ImproveSkipReason = 'negativeEarnings' | 'emptyWarchest'

function warchestBefore(campaign: Campaign, sortie: Sortie): number {
  const rows = selectCampaignLog(campaign)
  const index = rows.findIndex(r => r.sortie.id === sortie.id)
  return index > 0 ? rows[index - 1].warchest : campaign.startingWarchest
}

// Aces Rulebook p. 34: no SP for pilots from a sortie that lost money, and the step is skipped
// if the Warchest is at zero or below afterwards.
function skipReason(earnings: number, before: number): ImproveSkipReason | null {
  if (earnings <= 0) return 'negativeEarnings'
  if (before + earnings <= 0) return 'emptyWarchest'
  return null
}

export function selectImproveSkipReason(campaign: Campaign, sortie: Sortie): ImproveSkipReason | null {
  return skipReason(selectSortieEarnings(campaign, sortie), warchestBefore(campaign, sortie))
}

/**
 * Aces Rulebook p. 35: each fielded Named Pilot can take up to the outcome's maximum (wounded this
 * sortie or not); pilots who sat out take half; pilots killed take nothing. If Earnings can't cover
 * everyone's maximum, they are split evenly the same way, rounded down. Frozen once completed.
 */
function computePilotShares(campaign: Campaign, sortie: Sortie, before: number, earnings: number): PilotShare[] {
  if (sortie.status === 'completed') return sortie.pilotShares
  const skipped = skipReason(earnings, before) !== null
  const entries = campaign.namedPilots.map(pilot => {
    const fielded = sortie.fieldedUnits.find(f => f.pilotId === pilot.id)
    const crew = fielded ? selectCrewOutcome(fielded) : null
    const status: PilotShare['status'] = !fielded ? 'satOut' : crew === 'killed' ? 'killed' : crew === 'wounded' ? 'wounded' : 'fielded'
    return { pilot, status }
  })
  const full = entries.filter(e => e.status === 'fielded' || e.status === 'wounded').length
  const half = entries.filter(e => e.status === 'satOut').length
  const max = Math.max(0, sortie.maxSpPerPilot)
  let fullShare = 0
  if (!skipped && full + half > 0) {
    const needed = max * full + Math.floor(max / 2) * half
    fullShare = earnings >= needed ? max : Math.min(max, Math.floor(earnings / (full + half / 2)))
  }
  return entries.map(({ pilot, status }) => ({
    pilotId: pilot.id,
    callsign: pilot.callsign,
    status,
    share: status === 'killed' ? 0 : status === 'satOut' ? Math.floor(fullShare / 2) : fullShare,
    mvp: !skipped && sortie.mvpPilotId === pilot.id,
  }))
}

export function selectPilotShares(campaign: Campaign, sortie: Sortie): PilotShare[] {
  return computePilotShares(campaign, sortie, warchestBefore(campaign, sortie), selectSortieEarnings(campaign, sortie))
}

/** A pilot's new SP from this sortie: their share plus the MVP bonus (which isn't from the Warchest). */
export function selectNewSp(share: PilotShare): number {
  return share.share + (share.mvp ? 20 : 0)
}

export function selectAllocation(sortie: Sortie, pilotId: string): { skill: number; edgeTokens: number; edgeAbilities: number } {
  const a = sortie.pilotAllocations.find(x => x.pilotId === pilotId)
  return { skill: a?.skill ?? 0, edgeTokens: a?.edgeTokens ?? 0, edgeAbilities: a?.edgeAbilities ?? 0 }
}

export function selectMvpCandidates(campaign: Campaign, sortie: Sortie): PilotShare[] {
  return selectPilotShares(campaign, sortie).filter(s => s.status === 'fielded' || s.status === 'wounded')
}

function selectImproveBlockers(campaign: Campaign, sortie: Sortie): string[] {
  if (sortie.outcome === 'failed' || selectImproveSkipReason(campaign, sortie) !== null) return []
  const shares = selectPilotShares(campaign, sortie)
  const blockers: string[] = []
  if (!sortie.mvpPilotId && selectMvpCandidates(campaign, sortie).length > 0) blockers.push('Improving Named Pilots: choose an MVP')
  for (const share of shares) {
    const a = selectAllocation(sortie, share.pilotId)
    const gap = selectNewSp(share) - (a.skill + a.edgeTokens + a.edgeAbilities)
    if (gap > 0) blockers.push(`Improving Named Pilots: allocate ${gap} more SP for ${share.callsign}`)
    if (gap < 0) blockers.push(`Improving Named Pilots: allocate ${-gap} SP less for ${share.callsign}`)
  }
  return blockers
}

/**
 * ADR 0001: a pilot's Total SP Earned and spending are their starting figures plus every completed
 * sortie's share, MVP bonus and allocation, so reopening a sortie undoes them.
 */
export function selectEffectivePilot(campaign: Campaign, pilot: NamedPilot): NamedPilot {
  let { totalSpEarned, spSpentOnSkill, spSpentOnEdgeTokens, spSpentOnEdgeAbilities, mvpCount } = pilot
  for (const sortie of campaign.sorties) {
    if (sortie.status !== 'completed' || sortie.outcome === 'failed') continue
    const share = sortie.pilotShares.find(s => s.pilotId === pilot.id)
    if (!share) continue
    totalSpEarned += selectNewSp(share)
    if (share.mvp) mvpCount += 1
    const a = selectAllocation(sortie, pilot.id)
    spSpentOnSkill += a.skill
    spSpentOnEdgeTokens += a.edgeTokens
    spSpentOnEdgeAbilities += a.edgeAbilities
  }
  return { ...pilot, totalSpEarned, spSpentOnSkill, spSpentOnEdgeTokens, spSpentOnEdgeAbilities, mvpCount }
}

/** Starting SP can be spent only until a pilot's first completed sortie gives them SP. */
export function selectPilotHasSortieSp(campaign: Campaign, pilotId: string): boolean {
  return campaign.sorties.some(s => s.status === 'completed' && s.pilotShares.some(p => p.pilotId === pilotId && selectNewSp(p) > 0))
}

// Aces Rulebook p. 34: 150 SP per new or replacement Named Pilot.
export function selectNewPilotCount(sortie: Sortie): number {
  return sortie.hires.length + sortie.legacyNewReplacementPilots
}

export const MAX_NAMED_PILOTS = 6

/** Hiring is limited to six Named Pilots, counting this sortie's losses and earlier hires. */
export function selectHireBlocker(campaign: Campaign, sortie: Sortie): string | null {
  if (sortie.status !== 'draft') return 'This sortie is completed.'
  const killed = sortie.fieldedUnits.filter(f => f.pilotId && selectCrewOutcome(f) === 'killed').length
  if (campaign.namedPilots.length - killed + sortie.hires.length >= MAX_NAMED_PILOTS) return 'Your force already has six Named Pilots.'
  return null
}

/** A Named Pilot fielded in a draft sortie can't be dismissed until it is completed or they're taken off. */
export function selectDismissBlocker(campaign: Campaign, pilotId: string): string | null {
  const draft = campaign.sorties.find(s => s.status === 'draft' && s.fieldedUnits.some(f => f.pilotId === pilotId))
  return draft ? `Fielded in Sortie ${draft.sortieNumber}. Take them off that sortie's Player Force first.` : null
}

/** Once a sortie is completed, new Named Pilots are hired in After-Sortie step 4 (150 SP), not added free. */
export function selectCampaignStarted(campaign: Campaign): boolean {
  return campaign.sorties.some(s => s.status === 'completed')
}

// Aces Rulebook p. 26: setup enforces these (unlike a sortie's PV Limit, which only warns).
export function selectSetupForceErrors(draft: SetupDraft): string[] {
  const pv = selectTotalRosterPV(draft.units)
  const existing = draft.existingForce
  const errors: string[] = []
  // An Existing Force may only add units up to 400 PV (p. 29); one already over carries over as it is.
  const addedUnits = existing ? draft.units.some(u => !existing.unitIds.includes(u.id)) : true
  if (pv > FORCE_PV_LIMIT && addedUnits) errors.push(`Your force is ${pv - FORCE_PV_LIMIT} PV over the ${FORCE_PV_LIMIT} PV limit.`)
  if (!existing && draft.units.length < MIN_SETUP_UNITS) errors.push(`Your force needs at least ${MIN_SETUP_UNITS} units (it has ${draft.units.length}).`)
  if (draft.units.some(u => !UNIT_TYPES.includes(u.unitType))) errors.push('Only BattleMechs, battle armor, combat vehicles and infantry are allowed.')
  if (!existing && !draft.chassisConfirmed) errors.push('Confirm the chassis rule.')
  return errors
}

// Aces Rulebook p. 27: 2 to 6 Named Pilots, each spending exactly 150 SP (carried-over pilots: all their SP).
export function selectSetupPilotErrors(draft: SetupDraft): string[] {
  const errors: string[] = []
  if (draft.pilots.length < 2) errors.push('Create at least 2 Named Pilots.')
  if (draft.pilots.some(p => !p.callsign.trim())) errors.push('Every Named Pilot needs a callsign.')
  for (const p of draft.pilots) {
    const left = p.totalSpEarned - p.spSpentOnSkill - p.spSpentOnEdgeTokens - p.spSpentOnEdgeAbilities
    if (left > 0) errors.push(`${p.callsign || 'A pilot'} has ${left} SP left to allocate.`)
    if (left < 0) errors.push(`${p.callsign || 'A pilot'} has ${-left} SP too many.`)
  }
  return errors
}

export interface PilotSpBreakdown {
  start: number
  carriedOver: number
  sorties: number
  mvp: number
  total: number
  sortiesPlayed: number
  mvpCount: number
}

/** Where a Named Pilot's Total SP Earned came from, for the pilot's record. */
export function selectPilotSpBreakdown(campaign: Campaign, stored: NamedPilot): PilotSpBreakdown {
  const pilot = selectEffectivePilot(campaign, stored)
  const carriedOver = stored.carriedOverSp ?? 0
  const mvp = (pilot.mvpCount - stored.mvpCount) * 20
  const sortiesPlayed = campaign.sorties.filter(s =>
    s.status === 'completed' && s.outcome !== 'failed' && s.pilotShares.some(p => p.pilotId === stored.id && p.status !== 'satOut'),
  ).length
  return {
    start: stored.totalSpEarned - carriedOver,
    carriedOver,
    sorties: pilot.totalSpEarned - stored.totalSpEarned - mvp,
    mvp,
    total: pilot.totalSpEarned,
    sortiesPlayed,
    mvpCount: pilot.mvpCount,
  }
}
