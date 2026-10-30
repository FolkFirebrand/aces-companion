import type { AppliedEffects, Campaign, MemorialEntry, NamedPilot, PurchaseEntry, Sortie, Unit } from './types'
import { selectCrewOutcome, selectTrulyDestroyed } from '@/store/selectors'

// Completing a sortie changes the Player Force all at once; reopening it must undo exactly that
// (ADR 0002). Order: OMNI changes, then sales, then purchases appended to the roster.
export function applyPurchases(units: Unit[], purchases: PurchaseEntry[], effects: AppliedEffects = emptyEffects()): { units: Unit[]; effects: AppliedEffects } {
  const next = [...units]

  for (const p of purchases) {
    if (p.kind !== 'omni') continue
    const index = next.findIndex(u => u.id === p.unitId)
    if (index < 0) continue
    if (!effects.unitsBefore.some(u => u.id === p.unitId)) effects.unitsBefore.push(next[index])
    next[index] = { ...next[index], ...p.toUnit, nameAndVariant: p.toName, pvAtSkill4: p.toPv }
  }
  for (const p of purchases) {
    if (p.kind !== 'sell') continue
    const index = next.findIndex(u => u.id === p.unitId)
    if (index < 0) continue
    effects.removedUnits.push({ unit: next[index], index })
    next.splice(index, 1)
  }
  for (const p of purchases) {
    if (p.kind !== 'buy') continue
    next.push(p.unit)
    effects.addedUnitIds.push(p.unit.id)
  }
  return { units: next, effects }
}

function revertUnits(units: Unit[], effects: AppliedEffects): Unit[] {
  const next = units.filter(u => !effects.addedUnitIds.includes(u.id))
  for (const { unit, index } of [...effects.removedUnits].reverse()) next.splice(index, 0, unit)
  return next.map(u => effects.unitsBefore.find(before => before.id === u.id) ?? u)
}

export function emptyEffects(): AppliedEffects {
  return { addedUnitIds: [], removedUnits: [], unitsBefore: [], removedPilots: [], pilotsBefore: [], memorialAddedIds: [], addedPilotIds: [] }
}

type ForceState = Pick<Campaign, 'units' | 'namedPilots' | 'memorial'>

function rememberPilot(effects: AppliedEffects, pilot: NamedPilot) {
  if (!effects.pilotsBefore.some(p => p.id === pilot.id)) effects.pilotsBefore.push(pilot)
}

function rememberUnit(effects: AppliedEffects, unit: Unit) {
  if (!effects.unitsBefore.some(u => u.id === unit.id)) effects.unitsBefore.push(unit)
}

/**
 * Everything completing a sortie does to the force, recorded so reopening undoes it exactly:
 * pilots wounded last time recover, casualties are applied, then purchases.
 */
export function applySortie(force: ForceState, sortie: Sortie, newId: () => string): ForceState & { effects: AppliedEffects } {
  const effects = emptyEffects()
  let units = [...force.units]
  let pilots = [...force.namedPilots]
  const memorial = [...force.memorial]

  // Pilots Wounded in an earlier sortie sat this one out; they are fit again.
  pilots = pilots.map(p => {
    if (!p.wounded) return p
    rememberPilot(effects, p)
    return { ...p, wounded: false }
  })

  for (const fielded of sortie.fieldedUnits) {
    const crew = selectCrewOutcome(fielded)
    const pilot = pilots.find(p => p.id === fielded.pilotId)
    if (pilot && crew === 'wounded') {
      rememberPilot(effects, pilot)
      pilots = pilots.map(p => (p.id === pilot.id ? { ...p, wounded: true } : p))
    }
    if (pilot && crew === 'killed') {
      const index = pilots.findIndex(p => p.id === pilot.id)
      effects.removedPilots.push({ pilot: pilots[index], index })
      pilots.splice(index, 1)
      units = units.map(u => {
        if (u.pilotId !== pilot.id) return u
        rememberUnit(effects, u)
        return { ...u, pilotId: null }
      })
      memorial.push(memorialEntry(newId(), pilot.callsign, 'pilot', 'killedInAction', sortie.id, effects))
    }
    if (selectTrulyDestroyed(fielded) === true) {
      const index = units.findIndex(u => u.id === fielded.unitId)
      if (index >= 0) {
        effects.removedUnits.push({ unit: units[index], index })
        units.splice(index, 1)
      }
      memorial.push(memorialEntry(newId(), fielded.nameAndVariant, 'unit', 'trulyDestroyed', sortie.id, effects))
    }
  }

  for (const hire of sortie.hires) {
    pilots.push(hire)
    effects.addedPilotIds.push(hire.id)
  }

  const bought = applyPurchases(units, sortie.purchases, effects)
  return { units: bought.units, namedPilots: pilots, memorial, effects }
}

function memorialEntry(id: string, name: string, type: MemorialEntry['type'], reason: MemorialEntry['reason'], sortieId: string, effects: AppliedEffects): MemorialEntry {
  effects.memorialAddedIds.push(id)
  return { id, name, type, reason, sortieId }
}

export function revertSortie(force: ForceState, effects: AppliedEffects): ForceState {
  const pilots = force.namedPilots.filter(p => !(effects.addedPilotIds ?? []).includes(p.id))
  for (const { pilot, index } of [...(effects.removedPilots ?? [])].reverse()) pilots.splice(index, 0, pilot)
  return {
    units: revertUnits(force.units, effects),
    namedPilots: pilots.map(p => (effects.pilotsBefore ?? []).find(before => before.id === p.id) ?? p),
    memorial: force.memorial.filter(m => !(effects.memorialAddedIds ?? []).includes(m.id)),
  }
}
