// Each entry: [spRequired, statValue]
// lookupStatFromSP: returns highest statValue where spRequired <= spSpent
// Tables are sorted highest spRequired first

export type ThresholdTable = [spRequired: number, statValue: number][]

// Skill track: lower skill number = better pilot (0 is best)
// Thresholds from pilot card grid. SP values are CUMULATIVE totals spent on this track.
// Skill 4 is the baseline (free, 0 SP required).
// ⚠️ Verify skill level mapping (0-10) against your physical rulebook.
export const SKILL_THRESHOLDS: ThresholdTable = [
  [3400, 0],   // 3400 SP spent → Skill 0 (best)
  [1900, 1],
  [900, 2],
  [400, 3],
  [0, 4],      // Skill 4 is the free starting baseline
]

// Edge Abilities: 0–5, unlocked as cumulative SP is spent on this track
// Values from pilot card right column: 60, 180, 360, 600, 900
export const EDGE_ABILITY_THRESHOLDS: ThresholdTable = [
  [900, 5],
  [600, 4],
  [360, 3],
  [180, 2],
  [60, 1],
  [0, 0],
]

// Edge Tokens: 1 token is the free baseline, extends to max 10 tokens
// Values confirmed from BattleTech: Aces rulebook
export const EDGE_TOKEN_THRESHOLDS: ThresholdTable = [
  [1100, 10],
  [900, 9],
  [720, 8],
  [560, 7],
  [420, 6],
  [300, 5],
  [200, 4],
  [120, 3],
  [60, 2],
  [0, 1],     // 1 edge token is the free starting baseline
]

/**
 * Given SP spent on a track and its threshold table, return the current stat value.
 * Table must be sorted descending by spRequired.
 */
export function lookupStatFromSP(spSpent: number, table: ThresholdTable): number {
  for (const [spRequired, statValue] of table) {
    if (spSpent >= spRequired) return statValue
  }
  return 0
}

/**
 * Returns the additional SP needed to reach the next tier, or null if already at max.
 * Table must be sorted descending by spRequired.
 * "Next tier" means the lowest threshold that is still above spSpent.
 */
export function nextTierCost(spSpent: number, table: ThresholdTable): number | null {
  // Already at max if spSpent meets the highest threshold (first entry)
  if (table.length === 0) return null
  const [maxRequired] = table[0]
  if (spSpent >= maxRequired) return null

  // Walk from the end (lowest threshold) upward to find the lowest threshold > spSpent
  for (let i = table.length - 1; i >= 0; i--) {
    const [spRequired] = table[i]
    if (spRequired > spSpent) {
      return spRequired - spSpent
    }
  }
  return null
}

export interface TrackProgress {
  value: number
  /** The next stat value and the SP spent on the track that reaches it; null at the top. */
  next: { value: number; at: number } | null
  toGo: number
  /** How far toward the next threshold, 0–1, for a progress bar. */
  fraction: number
}

export function trackProgress(spSpent: number, table: ThresholdTable): TrackProgress {
  const value = lookupStatFromSP(spSpent, table)
  const nextEntry = [...table].reverse().find(([spRequired]) => spRequired > spSpent)
  if (!nextEntry) return { value, next: null, toGo: 0, fraction: 1 }
  const [at, nextValue] = nextEntry
  return { value, next: { value: nextValue, at }, toGo: at - spSpent, fraction: spSpent / at }
}

/** SP that "+" adds: up to the track's next level, or whatever SP is left if that is not enough. */
export function trackStepUp(spSpent: number, available: number, table: ThresholdTable): number {
  const { next } = trackProgress(spSpent, table)
  return next ? Math.max(0, Math.min(next.at - spSpent, available)) : 0
}

/** SP that "−" takes back: down to the last level reached, or from there to the level before. */
export function trackStepDown(spSpent: number, table: ThresholdTable): number {
  const reached = table.find(([spRequired]) => spRequired <= spSpent)?.[0] ?? 0
  if (spSpent > reached) return spSpent - reached
  const before = table.find(([spRequired]) => spRequired < reached)?.[0] ?? 0
  return reached - before
}
