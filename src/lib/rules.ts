import type { CrewOutcome, DamageState, DifficultyLevel, UnitType } from './types'

// Aces Rulebook: a new force is built from 400 PV.
export const FORCE_PV_LIMIT = 400

// Aces Rulebook: Campaign Difficulty Adjustments.
export const DIFFICULTY_LEVELS: Record<Exclude<DifficultyLevel, 'custom'>, { name: string; pvPercent: number; spPercent: number }> = {
  rookie: { name: 'Rookie', pvPercent: 20, spPercent: 120 },
  standard: { name: 'Standard', pvPercent: 0, spPercent: 100 },
  veteran: { name: 'Veteran', pvPercent: -10, spPercent: 90 },
  elite: { name: 'Elite', pvPercent: -20, spPercent: 80 },
  legendary: { name: 'Legendary', pvPercent: -30, spPercent: 70 },
}

// Aces Rulebook: Existing Force Difficulty Modifiers, by Named Pilots' combined Total SP Earned.
const EXISTING_FORCE_BANDS: [moreThanSp: number, pvPercent: number][] = [
  [12000, -40],
  [9000, -30],
  [6000, -20],
  [3000, -10],
]

export function existingForceModifier(combinedTotalSp: number): number {
  for (const [moreThanSp, pvPercent] of EXISTING_FORCE_BANDS) {
    if (combinedTotalSp > moreThanSp) return pvPercent
  }
  return 0
}

// Rounding down is the conservative reading: never field more PV or earn more SP than allowed.
export function applyPercent(value: number, percent: number): number {
  return Math.floor((value * percent) / 100)
}

// Aces Rulebook: buying and selling units.
export function purchasePrice(pvAtSkill4: number): number {
  return pvAtSkill4 * 40
}

export function salePrice(pvAtSkill4: number): number {
  return pvAtSkill4 * 20
}

// Aces Rulebook: changing an OMNI's configuration.
export function omniReconfigurationCost(fromPv: number, toPv: number, size: number): number {
  return toPv <= fromPv ? size * 5 : (toPv - fromPv) * 40
}

// Aces Rulebook: Salvage Check targets on 2D6.
const SALVAGE_TARGETS: Record<UnitType, number> = {
  'BattleMech': 4,
  'Combat Vehicle': 6,
  'Battle Armor': 8,
  'Conventional Infantry': 10,
}

export function salvageTarget(unitType: UnitType): number {
  return SALVAGE_TARGETS[unitType]
}

// Aces Rulebook: Crew Check on 2D6.
export function crewOutcomeFromRoll(roll: number): CrewOutcome {
  if (roll <= 3) return 'killed'
  if (roll <= 6) return 'wounded'
  return 'unscathed'
}

// Aces Rulebook: repair cost per point of Size.
export const REPAIR_COST_PER_SIZE: Record<Exclude<DamageState, 'undamaged'>, number> = {
  destroyed: 100,
  crippled: 60,
  structure: 40,
  armor: 20,
}

/** Non-'Mech units count as half their Size for repairs; never rounded. */
export function repairSize(unitType: UnitType, size: number): number {
  return unitType === 'BattleMech' ? size : size / 2
}

export function roll2d6(): number {
  return 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6)
}

// Aces Rulebook: a new force has 400 PV and 400 SP; unspent PV converts at 40 SP per PV.
export const STARTING_SP = 400
export const SP_PER_UNSPENT_PV = 40
export const MIN_SETUP_UNITS = 8
export const NAMED_PILOT_STARTING_SP = 150

export function setupStartingWarchest(forcePv: number): number {
  return STARTING_SP + Math.max(0, FORCE_PV_LIMIT - forcePv) * SP_PER_UNSPENT_PV
}

// Aces Rulebook: an Existing Force's Warchest is raised to 400 SP if lower, then unspent PV converts as above.
export function existingForceStartingWarchest(warchest: number, forcePv: number): number {
  return Math.max(STARTING_SP, warchest) + Math.max(0, FORCE_PV_LIMIT - forcePv) * SP_PER_UNSPENT_PV
}
