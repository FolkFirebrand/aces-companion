export interface Campaign {
  id: string
  name: string
  forceName: string
  commandingOfficer: string
  difficultyLevel: DifficultyLevel
  customPvPercent: number
  customSpPercent: number
  startingWarchest: number
  units: Unit[]
  namedPilots: NamedPilot[]
  memorial: MemorialEntry[]
  sorties: Sortie[]
  /** The finished campaign this one's Existing Force came from (Aces Rulebook p. 29), if any. */
  existingForceFrom?: string
  createdAt: string
  updatedAt: string
}

export interface UnitMoveEntry {
  move: number
  type: string
}

export interface UnitDamage {
  short: number
  medium: number
  long: number
  extreme: number
}

export interface Unit {
  id: string
  nameAndVariant: string
  unitType: UnitType
  pvAtSkill4: number
  pilotId: string | null
  totalSpEarned: number
  imageURL?: string
  tonnage?: number
  role?: string
  /** Alpha Strike Size; repairs use it (non-'Mechs count half). */
  size: number
  /** Has the ENE special: no rearming cost. */
  ene: boolean
  currentSkill?: number
  move?: UnitMoveEntry[]
  abilities?: string[]
  overheat?: number
  tmm?: number
  armor?: number
  structure?: number
  damage?: UnitDamage
  /** The unit-list entry this unit was picked from (v2); hand-entered units have none. */
  unitListId?: string
  /** Damage S/M/L as printed on the card, e.g. "0*" for minimal damage (v2, from the unit list). */
  damageText?: [string, string, string]
  /** MegaMek's icon for the unit, a path under mm-data's data/images/units/ (ADR 0006). */
  iconPath?: string
  /** The player's own photo of the unit, e.g. their painted miniature; shown instead of the icon. */
  photoUrl?: string
}

export type StatTrack = 'skill' | 'edgeTokens' | 'edgeAbilities'

export type UnitType = 'BattleMech' | 'Combat Vehicle' | 'Battle Armor' | 'Conventional Infantry'

export const UNIT_TYPES = ['BattleMech', 'Combat Vehicle', 'Battle Armor', 'Conventional Infantry'] as const satisfies UnitType[]

/** Free text: players name abilities from their own Edge cards. */
export type EdgeAbilityName = string


export interface NamedPilot {
  id: string
  callsign: string
  pilotType: UnitType
  wounded: boolean
  mvpCount: number
  totalSpEarned: number
  spSpentOnSkill: number
  spSpentOnEdgeTokens: number
  spSpentOnEdgeAbilities: number
  edgeAbilitiesLearned: EdgeAbilityName[]
  campaignHistory: string[]
  /** SP earned in earlier campaigns, already counted in Total SP Earned. */
  carriedOverSp?: number
  photoUrl?: string
}

export type MemorialReason = 'trulyDestroyed' | 'killedInAction' | 'dismissed' | 'manual'

export interface MemorialEntry {
  id: string
  name: string
  type: 'unit' | 'pilot'
  reason: MemorialReason
  /** The sortie that put it here, if any; reopening that sortie removes it. */
  sortieId?: string
  note?: string
}

export interface Sortie {
  id: string
  sortieNumber: string
  name: string
  datePlayed: string
  status: SortieStatus
  stepsDone: string[]
  outcome: SortieOutcome
  listedPv: number
  primaryObjective: number
  otherObjectives: number
  reconnaissanceCost: number
  reconnaissanceNote: string
  /** SP that waypoint text made you pay during or at the end of the sortie. */
  waypointsSP: number
  /** SP that waypoint text gave you; it offsets the costs on the Sortie Log's Waypoints line (p. 34). */
  waypointsGainedSP: number
  waypointsNote: string
  /** Rearming count typed in before Fielded Units existed (v6 saves); 0 for new sorties. */
  legacyUnitsWithoutENE: number
  fieldedUnits: FieldedUnit[]
  forceCommanderPilotId: string | null
  /** Crew count typed in before Crew Checks existed (v7 saves); 0 for new sorties. */
  legacyWoundedOrKilledCrew: number
  /** Replacement pilots typed in before hiring existed (v9 saves); 0 for new sorties. */
  legacyNewReplacementPilots: number
  /** Named Pilots hired in After-Sortie step 4; they join the force when the sortie is completed. */
  hires: NamedPilot[]
  /** Repairs typed in before Damage States existed (v7 saves); empty for new sorties. */
  legacyRepairs: RepairEntry[]
  /** SP to Named Pilots typed in before shares were calculated (v8 saves); 0 for new sorties. */
  legacyNamedPilotSp: number
  /** After-Sortie step 5 (Aces Rulebook p. 35). */
  maxSpPerPilot: number
  mvpPilotId: string | null
  pilotAllocations: PilotAllocation[]
  /** Frozen when the sortie is completed (pilots can leave the force later); empty while a draft. */
  pilotShares: PilotShare[]
  purchases: PurchaseEntry[]
  keywordsGained: string[]
  nextSortieNote: string
  /** What completing the sortie changed in the Player Force, so reopening can undo it exactly. */
  appliedEffects: AppliedEffects | null
  /** Play mode (v2): what happened in the battle, round by round. Absent until play mode is opened. */
  battle?: SortieBattle
  /** Sortie Setup step 6 (v2): this sortie's enemy units. Never part of the Player Force or the books. */
  opposingForce?: OpposingUnit[]
}

/** An enemy unit in a sortie's Opposing Force: a unit's Alpha Strike stats, its own name and Skill. */
export interface OpposingUnit extends Omit<Unit, 'pilotId' | 'totalSpEarned' | 'photoUrl'> {
  /** The name copies are numbered from, e.g. "Hunchback HBK-4G" for "Hunchback HBK-4G 2". */
  baseName: string
  skill: number
}

/** Damage marked on one unit's Alpha Strike card. Counts are hits taken, not points left. */
export interface BattleMarks {
  armor: number
  structure: number
  /** Marked destroyed by hand (e.g. a crit result); structure gone also destroys it. */
  destroyed: boolean
  /** 'Mech heat: 0–3, or 4 for Shutdown (#43). */
  heat: number
  /** 'Mech critical hits taken on each track (#43). */
  engine: number
  fireControl: number
  mp: number
  weapons: number
  ammoHit: boolean
  /** Vehicle motive damage in the order it happened (#44): each −2" hit and each half-move hit. */
  motive: MotiveHit[]
  /** Vehicle motive damage: immobilized. */
  immobilized: boolean
  /** Edge tokens the unit's Named Pilot has spent this battle (#45); the pilot's stats and SP don't change. */
  edgeSpent: number
  /** One-use and exhaustible specials used this battle, by special code (#55), e.g. { BOMB2: 1, RHS: 1 }. */
  specialsUsed: Record<string, number>
}

export type MotiveHit = 'minus2' | 'half'

export interface UnitBattle {
  committed: BattleMarks
  /** Changes not yet applied (dashed on the card); Apply or End Round commits them. */
  pending?: BattleMarks
  notes: string
  /** The round it was destroyed in, once committed. */
  destroyedRound?: number
}

export interface SortieBattle {
  round: number
  /** Keyed by the Fielded Unit's unit id. */
  units: Record<string, UnitBattle>
}

export interface AppliedEffects {
  addedUnitIds: string[]
  removedUnits: { unit: Unit; index: number }[]
  unitsBefore: Unit[]
  removedPilots: { pilot: NamedPilot; index: number }[]
  pilotsBefore: NamedPilot[]
  memorialAddedIds: string[]
  addedPilotIds: string[]
}

// A unit as fielded in a sortie. Its details are copied in when fielded, so a played sortie's
// costs never change if the roster does later.
export interface FieldedUnit {
  unitId: string
  nameAndVariant: string
  unitType: UnitType
  pvAtSkill4: number
  size: number
  ene: boolean
  pilotId: string | null
  /** After-Sortie step 3 (Aces Rulebook p. 33). */
  damage: DamageState
  autoTrulyDestroyed: TrulyDestroyedCause | null
  salvageRoll: number | null
  crewMode: CrewMode
  crewRoll: number | null
  /** The player set its Damage State or Truly Destroyed case by hand; play mode's results no longer overwrite them (#46). */
  setByHand?: boolean
}

export type DamageState = 'undamaged' | 'armor' | 'structure' | 'crippled' | 'destroyed'
/** Cases that are truly destroyed with no Salvage Check. */
export type TrulyDestroyedCause = 'ammo' | 'emplacement' | 'airborne'
/** Roll 2D6, or a critical hit that decides it: Crew Stunned wounds, Crew Killed / Unit Destroyed kills. */
export type CrewMode = 'roll' | 'stunned' | 'killed'
export type CrewOutcome = 'killed' | 'wounded' | 'unscathed'

export interface PilotAllocation {
  pilotId: string
  skill: number
  edgeTokens: number
  edgeAbilities: number
}

export type PilotShareStatus = 'fielded' | 'wounded' | 'satOut' | 'killed'

export interface PilotShare {
  pilotId: string
  callsign: string
  status: PilotShareStatus
  share: number
  mvp: boolean
}

export interface HireRequest {
  callsign: string
  pilotType: UnitType
  skill: number
  edgeTokens: number
  edgeAbilities: number
}

export type SortieStatus = 'draft' | 'completed'

export type DifficultyLevel = 'rookie' | 'standard' | 'veteran' | 'elite' | 'legendary' | 'custom'

export type SortieOutcome = 'victory' | 'failed'

export type RepairTier = 'destroyed' | 'crippled' | 'structure' | 'armor'

export interface RepairEntry {
  id: string
  unitId: string
  size: number
  tier: RepairTier
}

// Step 6 and setup step 5 of a sortie. spCost is what it costs the Warchest: a sale is negative.
export type PurchaseEntry =
  | { id: string; kind: 'buy'; unit: Unit; spCost: number }
  | { id: string; kind: 'sell'; unitId: string; unitName: string; pvAtSkill4: number; spCost: number }
  | { id: string; kind: 'omni'; unitId: string; fromName: string; toName: string; fromPv: number; toPv: number; spCost: number; /** Stats of a configuration picked from the unit list (v2). */ toUnit?: Partial<Unit> }

export const REPAIR_MULTIPLIERS: Record<RepairTier, number> = {
  destroyed: 100,
  crippled: 60,
  structure: 40,
  armor: 20,
}

/** A new campaign being set up (Aces Rulebook p. 26–28); kept until started or cancelled. */
export interface SetupDraft {
  step: 1 | 2 | 3 | 4
  name: string
  forceName: string
  commandingOfficer: string
  difficultyLevel: DifficultyLevel
  customPvPercent: number
  customSpPercent: number
  units: Unit[]
  pilots: NamedPilot[]
  chassisConfirmed: boolean
  /** Set when the setup carries over an Existing Force (Aces Rulebook p. 29). */
  existingForce?: ExistingForceStart | null
}

export interface ExistingForceStart {
  fromCampaign: string
  /** The finished campaign's Warchest balance. */
  warchest: number
  /** The units carried over; units added during setup are the rest. */
  unitIds: string[]
}
