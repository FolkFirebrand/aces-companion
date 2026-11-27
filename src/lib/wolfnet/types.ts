// Wolfnet 350 (AS350): a tournament format for Alpha Strike. Forces of up to 350 PV, of which up to 250 PV is
// deployed for each scenario. Its own module beside the Aces campaign; nothing here touches a Campaign.
import type { SortieBattle } from '@/lib/types'
import type { ListTypeCode, RulesLevel } from '@/lib/unit-list/convert'

/** A unit in a Wolfnet force: its unit-list entry's Alpha Strike stats, copied in when added, and its Skill. */
export interface WnUnit {
  id: string
  /** The unit-list entry it came from; its faction and era availability are read from there. */
  unitListId: string
  name: string
  chassis: string
  type: ListTypeCode
  /** PV at Skill 4. */
  basePv: number
  skill: number
  size: number
  tmm: number
  move: Record<string, number>
  armor: number
  structure: number
  damage: [string, string, string]
  ov: number
  specials: string[]
  icon?: string
  role?: string
  rules?: RulesLevel
}

export type ArtilleryKind = 'sniper' | 'thumper'

/** An Off-Board Artillery Support card: counts toward PV, never toward unit counts. */
export interface WnArtillery {
  id: string
  kind: ArtilleryKind
}

/** A 250 PV list picked from the force for one scenario (pre-built lists are encouraged). */
export interface WnDeployment {
  id: string
  name: string
  unitIds: string[]
  artilleryIds: string[]
}

export interface WnForce {
  id: string
  name: string
  /** Index into ERAS. */
  era: number | null
  /** Faction name, as in the unit list's factions. */
  faction: string | null
  /** The General List the faction adds, or null for a Blank General List. */
  generalList: string | null
  units: WnUnit[]
  artillery: WnArtillery[]
  deployments: WnDeployment[]
  createdAt: string
  updatedAt: string
}

/** A deployed unit as both players see it in a match: the force unit with its PV at its Skill. */
export interface WnMatchUnit extends WnUnit {
  pv: number
}

/** One player's side of a match. Each device owns its own side and sends it to the other. */
export interface WnSide {
  playerId: string
  playerName: string
  forceName: string
  faction: string | null
  era: number | null
  units: WnMatchUnit[]
  artillery: WnArtillery[]
  battle: SortieBattle
  /** Objective points scored. */
  vp: number
  /** Deployed units designated Command Units (Headhunter). */
  commandUnitIds: string[]
  updatedAt: number
}

export type MatchRole = 'host' | 'guest'

export interface WnMatch {
  code: string
  role: MatchRole
  /** Scenario number on the roll table (1–10); the host picks it, the guest takes the host's. */
  scenario: number | null
  me: WnSide
  /** The opponent's side as last received; read-only here. */
  opponent: WnSide | null
  startedAt: string
}
