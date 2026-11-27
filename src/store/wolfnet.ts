// The Wolfnet 350 module's own store: saved forces and the match in progress. Kept apart from the campaign (its own
// localStorage key), so a Wolfnet force never touches an Aces campaign and vice versa.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { BattleMarks, Unit } from '@/lib/types'
import type { UnitListEntry } from '@/lib/unit-list/convert'
import { commitUnit, sortieBattle, unitBattle, withPending } from '@/lib/battle'
import { SKILL_RANGE, cardUnit, matchUnits, unitFromListEntry } from '@/lib/wolfnet/rules'
import type { ArtilleryKind, MatchRole, WnDeployment, WnForce, WnMatch, WnSide } from '@/lib/wolfnet/types'
import type { MatchMessage } from '@/lib/wolfnet/sync'

const now = () => new Date().toISOString()

function blankForce(name: string): WnForce {
  return {
    id: uuidv4(), name, era: null, faction: null, generalList: null, units: [], artillery: [], deployments: [],
    createdAt: now(), updatedAt: now(),
  }
}

export interface StartMatch {
  code: string
  role: MatchRole
  forceId: string
  unitIds: string[]
  artilleryIds: string[]
  scenario: number | null
}

interface WolfnetState {
  /** This device's player, so the other device can tell the two sides apart. */
  playerId: string
  playerName: string
  forces: WnForce[]
  match: WnMatch | null

  setPlayerName: (name: string) => void
  createForce: (name?: string) => string
  updateForce: (forceId: string, change: Partial<Pick<WnForce, 'name' | 'era' | 'faction' | 'generalList'>>) => void
  deleteForce: (forceId: string) => void
  addUnit: (forceId: string, entry: UnitListEntry) => void
  setUnitSkill: (forceId: string, unitId: string, skill: number) => void
  removeUnit: (forceId: string, unitId: string) => void
  addArtillery: (forceId: string, kind: ArtilleryKind) => void
  removeArtillery: (forceId: string, artilleryId: string) => void
  /** Adds the deployment, or replaces the one with its id. Returns its id. */
  saveDeployment: (forceId: string, deployment: Omit<WnDeployment, 'id'> & { id?: string }) => string
  deleteDeployment: (forceId: string, deploymentId: string) => void

  startMatch: (start: StartMatch) => boolean
  leaveMatch: () => void
  setScenario: (scenario: number | null) => void
  setVp: (vp: number) => void
  toggleCommandUnit: (unitId: string) => void
  markBattle: (unitId: string, change: Partial<BattleMarks>) => void
  applyBattle: (unitId: string) => void
  discardBattle: (unitId: string) => void
  discardAllBattle: () => void
  setBattleNotes: (unitId: string, notes: string) => void
  endRound: () => void
  /** A message from the match channel: the opponent's side, or their scenario if they host. */
  receive: (message: MatchMessage) => void
}

function withForce(forces: WnForce[], forceId: string, change: (force: WnForce) => Partial<WnForce>): WnForce[] {
  return forces.map(f => (f.id === forceId ? { ...f, ...change(f), updatedAt: now() } : f))
}

function withMe(match: WnMatch | null, change: (me: WnSide) => Partial<WnSide>): { match: WnMatch | null } {
  if (!match) return { match }
  return { match: { ...match, me: { ...match.me, ...change(match.me), updatedAt: Date.now() } } }
}

function cardFor(me: WnSide, unitId: string): Pick<Unit, 'unitType'> & Partial<Unit> {
  const unit = me.units.find(u => u.id === unitId)
  // A record for a unit not deployed can't be destroyed by structure; any type will do.
  return unit ? cardUnit(unit) : { unitType: 'BattleMech' }
}

export const useWolfnetStore = create<WolfnetState>()(
  persist(
    (set, get) => ({
      playerId: uuidv4(),
      playerName: '',
      forces: [],
      match: null,

      setPlayerName: playerName => set(s => ({ playerName, ...withMe(s.match, () => ({ playerName })) })),

      createForce: (name = '') => {
        const force = blankForce(name)
        set(s => ({ forces: [...s.forces, force] }))
        return force.id
      },

      updateForce: (forceId, change) => set(s => ({ forces: withForce(s.forces, forceId, () => change) })),

      deleteForce: forceId => set(s => ({ forces: s.forces.filter(f => f.id !== forceId) })),

      addUnit: (forceId, entry) =>
        set(s => ({ forces: withForce(s.forces, forceId, f => ({ units: [...f.units, unitFromListEntry(entry, uuidv4())] })) })),

      setUnitSkill: (forceId, unitId, skill) => {
        const clamped = Math.min(SKILL_RANGE.max, Math.max(SKILL_RANGE.min, Math.round(skill)))
        set(s => ({ forces: withForce(s.forces, forceId, f => ({ units: f.units.map(u => (u.id === unitId ? { ...u, skill: clamped } : u)) })) }))
      },

      // Deployments drop a removed unit too, so a saved list never points at a unit that's gone.
      removeUnit: (forceId, unitId) =>
        set(s => ({
          forces: withForce(s.forces, forceId, f => ({
            units: f.units.filter(u => u.id !== unitId),
            deployments: f.deployments.map(d => ({ ...d, unitIds: d.unitIds.filter(id => id !== unitId) })),
          })),
        })),

      addArtillery: (forceId, kind) =>
        set(s => ({ forces: withForce(s.forces, forceId, f => ({ artillery: [...f.artillery, { id: uuidv4(), kind }] })) })),

      removeArtillery: (forceId, artilleryId) =>
        set(s => ({
          forces: withForce(s.forces, forceId, f => ({
            artillery: f.artillery.filter(a => a.id !== artilleryId),
            deployments: f.deployments.map(d => ({ ...d, artilleryIds: d.artilleryIds.filter(id => id !== artilleryId) })),
          })),
        })),

      saveDeployment: (forceId, deployment) => {
        const id = deployment.id ?? uuidv4()
        const saved: WnDeployment = { ...deployment, id }
        set(s => ({
          forces: withForce(s.forces, forceId, f => ({
            deployments: f.deployments.some(d => d.id === id) ? f.deployments.map(d => (d.id === id ? saved : d)) : [...f.deployments, saved],
          })),
        }))
        return id
      },

      deleteDeployment: (forceId, deploymentId) =>
        set(s => ({ forces: withForce(s.forces, forceId, f => ({ deployments: f.deployments.filter(d => d.id !== deploymentId) })) })),

      startMatch: ({ code, role, forceId, unitIds, artilleryIds, scenario }) => {
        const { forces, playerId, playerName } = get()
        const force = forces.find(f => f.id === forceId)
        if (!force) return false
        const me: WnSide = {
          playerId, playerName, forceName: force.name, faction: force.faction, era: force.era,
          units: matchUnits(force, unitIds),
          artillery: force.artillery.filter(a => artilleryIds.includes(a.id)),
          battle: { round: 1, units: {} }, vp: 0, commandUnitIds: [], updatedAt: Date.now(),
        }
        set({ match: { code, role, scenario: role === 'host' ? scenario : null, me, opponent: null, startedAt: now() } })
        return true
      },

      leaveMatch: () => set({ match: null }),

      setScenario: scenario => set(s => (s.match?.role === 'host' ? { match: { ...s.match, scenario, me: { ...s.match.me, updatedAt: Date.now() } } } : s)),

      setVp: vp => set(s => withMe(s.match, () => ({ vp: Math.max(0, Math.round(vp)) }))),

      toggleCommandUnit: unitId => set(s => withMe(s.match, me => ({
        commandUnitIds: me.commandUnitIds.includes(unitId) ? me.commandUnitIds.filter(id => id !== unitId) : [...me.commandUnitIds, unitId],
      }))),

      markBattle: (unitId, change) => set(s => withMe(s.match, me => ({
        battle: { ...me.battle, units: { ...me.battle.units, [unitId]: withPending(unitBattle(me.battle, unitId), change) } },
      }))),

      applyBattle: unitId => set(s => withMe(s.match, me => ({
        battle: { ...me.battle, units: { ...me.battle.units, [unitId]: commitUnit(unitBattle(me.battle, unitId), me.battle.round, cardFor(me, unitId)) } },
      }))),

      discardBattle: unitId => set(s => withMe(s.match, me => ({
        battle: { ...me.battle, units: { ...me.battle.units, [unitId]: { ...unitBattle(me.battle, unitId), pending: undefined } } },
      }))),

      discardAllBattle: () => set(s => withMe(s.match, me => ({
        battle: { ...me.battle, units: Object.fromEntries(Object.entries(me.battle.units).map(([id, r]) => [id, { ...r, pending: undefined }])) },
      }))),

      setBattleNotes: (unitId, notes) => set(s => withMe(s.match, me => ({
        battle: { ...me.battle, units: { ...me.battle.units, [unitId]: { ...unitBattle(me.battle, unitId), notes } } },
      }))),

      endRound: () => set(s => withMe(s.match, me => {
        const battle = sortieBattle(me.battle)
        return {
          battle: {
            round: battle.round + 1,
            units: Object.fromEntries(Object.entries(battle.units).map(([id, r]) => [id, commitUnit(r, battle.round, cardFor(me, id))])),
          },
        }
      })),

      receive: message => set(s => {
        const match = s.match
        if (!match || message.from === s.playerId || message.kind !== 'side') return s
        // The first other player to send a side is the opponent; anyone else on the code is ignored.
        if (match.opponent && match.opponent.playerId !== message.from) return s
        if (match.opponent && match.opponent.updatedAt > message.side.updatedAt) return s
        const scenario = match.role === 'guest' && message.role === 'host' ? message.scenario : match.scenario
        return { match: { ...match, scenario, opponent: message.side } }
      }),
    }),
    {
      name: 'aces-wolfnet',
      version: 1,
    },
  ),
)
