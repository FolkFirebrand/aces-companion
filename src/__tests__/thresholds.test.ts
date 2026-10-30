import { lookupStatFromSP, nextTierCost, SKILL_THRESHOLDS, EDGE_TOKEN_THRESHOLDS, EDGE_ABILITY_THRESHOLDS } from '@/lib/thresholds'

describe('lookupStatFromSP', () => {
  it('returns 4 (baseline skill) when no SP spent on skill track', () => {
    expect(lookupStatFromSP(0, SKILL_THRESHOLDS)).toBe(4)
  })

  it('returns correct value at exact threshold', () => {
    // [0, 4] is the free baseline — any SP total including 200 still yields Skill 4
    expect(lookupStatFromSP(200, SKILL_THRESHOLDS)).toBe(4)
  })

  it('returns lower number (better skill) when SP exceeds threshold', () => {
    // 500 SP is between 400 (skill 3) and 900 (skill 2) → skill 3
    expect(lookupStatFromSP(500, SKILL_THRESHOLDS)).toBe(3)
  })

  it('returns best skill at max SP', () => {
    expect(lookupStatFromSP(3400, SKILL_THRESHOLDS)).toBe(0)
  })

  it('returns 0 edge abilities when no SP spent', () => {
    expect(lookupStatFromSP(0, EDGE_ABILITY_THRESHOLDS)).toBe(0)
  })

  it('returns 5 edge abilities at max threshold', () => {
    expect(lookupStatFromSP(900, EDGE_ABILITY_THRESHOLDS)).toBe(5)
  })

  it('returns 1 edge token (baseline) when no SP spent', () => {
    expect(lookupStatFromSP(0, EDGE_TOKEN_THRESHOLDS)).toBe(1)
  })

  it('returns 10 edge tokens at max threshold (1100 SP)', () => {
    expect(lookupStatFromSP(1100, EDGE_TOKEN_THRESHOLDS)).toBe(10)
  })

  it('returns correct mid-range edge tokens', () => {
    // 200 SP → 4 tokens
    expect(lookupStatFromSP(200, EDGE_TOKEN_THRESHOLDS)).toBe(4)
    // 301 SP → 5 tokens (between 300 and 420)
    expect(lookupStatFromSP(301, EDGE_TOKEN_THRESHOLDS)).toBe(5)
  })
})

describe('nextTierCost', () => {
  it('returns SP needed for next tier', () => {
    // Baseline is Skill 4 (free), next tier is Skill 3 at 400 SP
    expect(nextTierCost(0, SKILL_THRESHOLDS)).toBe(400)
  })

  it('returns null when at max tier', () => {
    expect(nextTierCost(3400, SKILL_THRESHOLDS)).toBeNull()
  })

  it('returns SP needed for next edge token tier', () => {
    // At 0 SP (baseline 1 token), next tier is 2 tokens at 60 SP
    expect(nextTierCost(0, EDGE_TOKEN_THRESHOLDS)).toBe(60)
  })

  it('returns correct cost from mid-tier edge tokens', () => {
    // At 200 SP (4 tokens), next tier is 5 tokens at 300 SP → costs 100 more
    expect(nextTierCost(200, EDGE_TOKEN_THRESHOLDS)).toBe(100)
  })

  it('returns null for edge tokens at max tier (1100 SP)', () => {
    expect(nextTierCost(1100, EDGE_TOKEN_THRESHOLDS)).toBeNull()
  })

  it('returns 60 for edge tokens just below first paid tier (59 SP → still 1 token)', () => {
    // 59 SP is below [60, 2] threshold — still at 1 token, next costs 60-59=1 more SP
    expect(nextTierCost(59, EDGE_TOKEN_THRESHOLDS)).toBe(1)
  })
})
