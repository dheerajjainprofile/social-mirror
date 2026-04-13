/**
 * badgeLogic.test.ts
 *
 * Tests for badge assignment — both computeBadge (priority logic) and
 * assignBadges (full stats computation from raw game data).
 *
 * v4: All 5 previously dead stats now computed. MS Dhoni fixed to
 * "closest guesser in majority of rounds". Badge exclusivity enforced.
 */

import { describe, it, expect } from 'vitest'
import { computeBadge, assignBadges, type PlayerBadgeStats } from '../lib/badgeLogic'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<PlayerBadgeStats> = {}): PlayerBadgeStats {
  return {
    playerId: 'p1',
    exactGuesses: 0,
    roundsWon: 0,
    consecutiveWins: 0,
    avgDistance: 30,
    isSlowButAccurate: false,
    winsWithoutBeingFastest: 0,
    answerSpreadAsTarget: 0,
    passCount: 0,
    totalRounds: 5,
    submittedHighestNumbers: false,
    isFastestConsistently: false,
    neverWithin50Percent: false,
    isTargetMostRounds: false,
    closestGuesserRatio: 0,
    avgSubmittedNumber: 0,
    avgSubmissionRank: 0,
    ...overrides,
  }
}

// Timestamps spaced 1s apart starting from base
function makeTimestamp(base: number, offsetSeconds: number): string {
  return new Date(base + offsetSeconds * 1000).toISOString()
}

// ─── computeBadge: all 13 badges reachable ────────────────────────────────────

describe('computeBadge — all 13 badges reachable', () => {
  it('Baba Vanga: 2+ exact guesses', () => {
    expect(computeBadge(makeStats({ exactGuesses: 2 })).name).toBe('The Baba Vanga')
  })

  it('Baba Vanga: exactly 2 (boundary)', () => {
    expect(computeBadge(makeStats({ exactGuesses: 2 })).name).toBe('The Baba Vanga')
  })

  it('Aamir Khan: isSlowButAccurate', () => {
    expect(computeBadge(makeStats({ isSlowButAccurate: true })).name).toBe('The Aamir Khan')
  })

  it('Virat Kohli: 3+ consecutive wins', () => {
    expect(computeBadge(makeStats({ consecutiveWins: 3 })).name).toBe('The Virat Kohli')
  })

  it('Virat Kohli: more than 3 consecutive wins also qualifies', () => {
    expect(computeBadge(makeStats({ consecutiveWins: 5 })).name).toBe('The Virat Kohli')
  })

  it('MS Dhoni: closest guesser in majority of rounds (ratio > 0.5)', () => {
    expect(computeBadge(makeStats({ closestGuesserRatio: 0.6 })).name).toBe('The MS Dhoni')
  })

  it('MS Dhoni: boundary — exactly 0.5 does NOT trigger (must be > 0.5)', () => {
    expect(computeBadge(makeStats({ closestGuesserRatio: 0.5 })).name).not.toBe('The MS Dhoni')
  })

  it('MS Dhoni: 0.51 triggers', () => {
    expect(computeBadge(makeStats({ closestGuesserRatio: 0.51 })).name).toBe('The MS Dhoni')
  })

  it('Mogambo: answerSpreadAsTarget > 100', () => {
    expect(computeBadge(makeStats({ answerSpreadAsTarget: 200 })).name).toBe('The Mogambo')
  })

  it('Salman Khan: 2+ wins without being fastest', () => {
    expect(computeBadge(makeStats({ winsWithoutBeingFastest: 2 })).name).toBe('The Salman Khan')
  })

  it('SRK: isTargetMostRounds', () => {
    expect(computeBadge(makeStats({ isTargetMostRounds: true })).name).toBe('The SRK')
  })

  it('Arnab Goswami: fastest consistently AND avgDistance > 80', () => {
    expect(computeBadge(makeStats({ isFastestConsistently: true, avgDistance: 150 })).name).toBe('The Arnab Goswami')
  })

  it('Ambani: submittedHighestNumbers', () => {
    expect(computeBadge(makeStats({ submittedHighestNumbers: true })).name).toBe('The Ambani')
  })

  it('Hardik Pandya: fastest consistently AND avgDistance <= 80', () => {
    expect(computeBadge(makeStats({ isFastestConsistently: true, avgDistance: 80 })).name).toBe('The Hardik Pandya')
  })

  it('Gabbar Singh: avgDistance > 60', () => {
    expect(computeBadge(makeStats({ avgDistance: 90 })).name).toBe('The Gabbar Singh')
  })

  it('Devdas: passCount >= 3', () => {
    expect(computeBadge(makeStats({ passCount: 3, avgDistance: 30 })).name).toBe('The Devdas')
  })

  it('Babu Bhaiya: default fallback when nothing special', () => {
    expect(computeBadge(makeStats({ avgDistance: 30 })).name).toBe('The Babu Bhaiya')
  })
})

describe('computeBadge — priority order', () => {
  it('exactGuesses beats isSlowButAccurate', () => {
    expect(computeBadge(makeStats({ exactGuesses: 2, isSlowButAccurate: true })).name).toBe('The Baba Vanga')
  })

  it('isSlowButAccurate beats consecutiveWins', () => {
    expect(computeBadge(makeStats({ isSlowButAccurate: true, consecutiveWins: 3 })).name).toBe('The Aamir Khan')
  })

  it('consecutiveWins beats closestGuesserRatio', () => {
    expect(computeBadge(makeStats({ consecutiveWins: 3, closestGuesserRatio: 0.8 })).name).toBe('The Virat Kohli')
  })

  it('all badges have non-empty emoji and copy', () => {
    const triggerSets: Partial<PlayerBadgeStats>[] = [
      { exactGuesses: 2 },
      { isSlowButAccurate: true },
      { consecutiveWins: 3 },
      { closestGuesserRatio: 0.6 },
      { answerSpreadAsTarget: 200 },
      { winsWithoutBeingFastest: 2 },
      { isTargetMostRounds: true },
      { isFastestConsistently: true, avgDistance: 150 },
      { submittedHighestNumbers: true },
      { isFastestConsistently: true, avgDistance: 80 },
      { avgDistance: 90 },
      { passCount: 3, avgDistance: 30 },
      {},
    ]
    for (const overrides of triggerSets) {
      const badge = computeBadge(makeStats(overrides))
      expect(badge.emoji.length).toBeGreaterThan(0)
      expect(badge.copy.length).toBeGreaterThan(0)
      expect(badge.name.length).toBeGreaterThan(0)
    }
  })
})

// ─── assignBadges: stats computation from raw data ───────────────────────────

describe('assignBadges — Baba Vanga', () => {
  it('player with 2 exact guesses gets Baba Vanga', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p2', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p2', targetAnswer: 80 },
    ]
    const guesses = [
      { playerId: 'p1', roundId: 'r1', answer: 50, passed: false },
      { playerId: 'p1', roundId: 'r2', answer: 80, passed: false },
    ]
    const scores = [
      { playerId: 'p1', roundId: 'r1', points: 1 },
      { playerId: 'p1', roundId: 'r2', points: 1 },
    ]
    const result = assignBadges(['p1'], guesses, rounds, scores, { p1: 'Player1' })
    expect(result[0].badge).toBe('The Baba Vanga')
  })
})

describe('assignBadges — MS Dhoni (fixed condition)', () => {
  it('closest guesser in 3 of 4 rounds (75%) gets MS Dhoni', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r3', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r4', targetPlayerId: 'p3', targetAnswer: 50 },
    ]
    const guesses = [
      // r1: p1=51 (closest), p2=60
      { playerId: 'p1', roundId: 'r1', answer: 51, passed: false },
      { playerId: 'p2', roundId: 'r1', answer: 60, passed: false },
      // r2: p1=52 (closest), p2=60
      { playerId: 'p1', roundId: 'r2', answer: 52, passed: false },
      { playerId: 'p2', roundId: 'r2', answer: 60, passed: false },
      // r3: p1=53 (closest), p2=60
      { playerId: 'p1', roundId: 'r3', answer: 53, passed: false },
      { playerId: 'p2', roundId: 'r3', answer: 60, passed: false },
      // r4: p1=80 (not closest), p2=52 (closest)
      { playerId: 'p1', roundId: 'r4', answer: 80, passed: false },
      { playerId: 'p2', roundId: 'r4', answer: 52, passed: false },
    ]
    const result = assignBadges(['p1'], guesses, rounds, [], { p1: 'Player1' })
    expect(result[0].badge).toBe('The MS Dhoni')
  })

  it('closest in exactly 50% of rounds does NOT get MS Dhoni (needs > 50%)', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p3', targetAnswer: 50 },
    ]
    const guesses = [
      { playerId: 'p1', roundId: 'r1', answer: 51, passed: false }, // closest (dist 1)
      { playerId: 'p1', roundId: 'r2', answer: 80, passed: false }, // not closest (dist 30)
      { playerId: 'p2', roundId: 'r1', answer: 90, passed: false }, // not closest (dist 40)
      { playerId: 'p2', roundId: 'r2', answer: 51, passed: false }, // closest (dist 1)
    ]
    const result = assignBadges(['p1', 'p2'], guesses, rounds, [], { p1: 'Player1', p2: 'Player2' })
    expect(result[0].badge).not.toBe('The MS Dhoni')
  })
})

describe('assignBadges — Devdas', () => {
  it('player who passes 3+ rounds gets Devdas', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p2', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p2', targetAnswer: 50 },
      { roundId: 'r3', targetPlayerId: 'p2', targetAnswer: 50 },
    ]
    const guesses = [
      { playerId: 'p1', roundId: 'r1', answer: null, passed: true },
      { playerId: 'p1', roundId: 'r2', answer: null, passed: true },
      { playerId: 'p1', roundId: 'r3', answer: null, passed: true },
    ]
    const result = assignBadges(['p1'], guesses, rounds, [], { p1: 'Player1' })
    expect(result[0].badge).toBe('The Devdas')
  })
})

describe('assignBadges — SRK', () => {
  it('player who was target most rounds gets SRK', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p1', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p1', targetAnswer: 50 },
    ]
    const guesses = [
      { playerId: 'p2', roundId: 'r1', answer: 40, passed: false },
      { playerId: 'p2', roundId: 'r2', answer: 40, passed: false },
    ]
    const result = assignBadges(['p1', 'p2'], guesses, rounds, [], { p1: 'TargetPlayer', p2: 'Guesser' })
    const p1Badge = result.find(b => b.playerId === 'p1')
    expect(p1Badge?.badge).toBe('The SRK')
  })
})

describe('assignBadges — Ambani (submittedHighestNumbers)', () => {
  it('player with highest average submitted number gets Ambani', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p3', targetAnswer: 10 },
      { roundId: 'r2', targetPlayerId: 'p3', targetAnswer: 10 },
    ]
    const guesses = [
      { playerId: 'p1', roundId: 'r1', answer: 10000, passed: false },
      { playerId: 'p1', roundId: 'r2', answer: 9000, passed: false },
      { playerId: 'p2', roundId: 'r1', answer: 11, passed: false },
      { playerId: 'p2', roundId: 'r2', answer: 12, passed: false },
    ]
    const result = assignBadges(['p1', 'p2'], guesses, rounds, [], { p1: 'BigNumbers', p2: 'Normal' })
    const p1Badge = result.find(b => b.playerId === 'p1')
    expect(p1Badge?.badge).toBe('The Ambani')
  })
})

describe('assignBadges — timestamp-based badges', () => {
  const BASE = Date.now()

  it('fastest + inaccurate player gets Arnab Goswami', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r3', targetPlayerId: 'p3', answer: 50, targetAnswer: 50 },
    ]
    const guesses = [
      // p1: always first, but way off
      { playerId: 'p1', roundId: 'r1', answer: 500, passed: false, submittedAt: makeTimestamp(BASE, 1) },
      { playerId: 'p1', roundId: 'r2', answer: 500, passed: false, submittedAt: makeTimestamp(BASE, 11) },
      { playerId: 'p1', roundId: 'r3', answer: 500, passed: false, submittedAt: makeTimestamp(BASE, 21) },
      // p2: always last, accurate
      { playerId: 'p2', roundId: 'r1', answer: 52, passed: false, submittedAt: makeTimestamp(BASE, 9) },
      { playerId: 'p2', roundId: 'r2', answer: 52, passed: false, submittedAt: makeTimestamp(BASE, 19) },
      { playerId: 'p2', roundId: 'r3', answer: 52, passed: false, submittedAt: makeTimestamp(BASE, 29) },
    ]
    const result = assignBadges(['p1', 'p2'], guesses, rounds, [], { p1: 'Fast', p2: 'Slow' })
    const p1Badge = result.find(b => b.playerId === 'p1')
    expect(p1Badge?.badge).toBe('The Arnab Goswami')
  })

  it('fastest + accurate player gets Hardik Pandya', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p3', targetAnswer: 50 },
    ]
    const guesses = [
      // p1: always first AND accurate
      { playerId: 'p1', roundId: 'r1', answer: 52, passed: false, submittedAt: makeTimestamp(BASE, 1) },
      { playerId: 'p1', roundId: 'r2', answer: 53, passed: false, submittedAt: makeTimestamp(BASE, 11) },
      // p2: slower
      { playerId: 'p2', roundId: 'r1', answer: 200, passed: false, submittedAt: makeTimestamp(BASE, 9) },
      { playerId: 'p2', roundId: 'r2', answer: 200, passed: false, submittedAt: makeTimestamp(BASE, 19) },
    ]
    const result = assignBadges(['p1', 'p2'], guesses, rounds, [], { p1: 'FastAccurate', p2: 'Slow' })
    const p1Badge = result.find(b => b.playerId === 'p1')
    expect(p1Badge?.badge).toBe('The Hardik Pandya')
  })

  it('winsWithoutBeingFastest gives Salman Khan', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r3', targetPlayerId: 'p3', targetAnswer: 50 },
    ]
    const scores = [
      { playerId: 'p1', roundId: 'r1', points: 1 },
      { playerId: 'p1', roundId: 'r2', points: 1 },
    ]
    const guesses = [
      // p1: wins r1, r2 but submitted late both times
      { playerId: 'p1', roundId: 'r1', answer: 51, passed: false, submittedAt: makeTimestamp(BASE, 9) },
      { playerId: 'p1', roundId: 'r2', answer: 51, passed: false, submittedAt: makeTimestamp(BASE, 19) },
      { playerId: 'p1', roundId: 'r3', answer: 51, passed: false, submittedAt: makeTimestamp(BASE, 29) },
      // p2: always first
      { playerId: 'p2', roundId: 'r1', answer: 90, passed: false, submittedAt: makeTimestamp(BASE, 1) },
      { playerId: 'p2', roundId: 'r2', answer: 90, passed: false, submittedAt: makeTimestamp(BASE, 11) },
      { playerId: 'p2', roundId: 'r3', answer: 90, passed: false, submittedAt: makeTimestamp(BASE, 21) },
    ]
    const result = assignBadges(['p1', 'p2'], guesses, rounds, scores, { p1: 'LateWinner', p2: 'FastLoser' })
    const p1Badge = result.find(b => b.playerId === 'p1')
    expect(p1Badge?.badge).toBe('The Salman Khan')
  })
})

describe('assignBadges — badge exclusivity', () => {
  it('two players cannot get the same badge — second gets next eligible', () => {
    // Both p1 and p2 pass 3 rounds — only one gets Devdas
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p3', targetAnswer: 50 },
      { roundId: 'r3', targetPlayerId: 'p3', targetAnswer: 50 },
    ]
    const guesses = [
      { playerId: 'p1', roundId: 'r1', answer: null, passed: true },
      { playerId: 'p1', roundId: 'r2', answer: null, passed: true },
      { playerId: 'p1', roundId: 'r3', answer: null, passed: true },
      { playerId: 'p2', roundId: 'r1', answer: null, passed: true },
      { playerId: 'p2', roundId: 'r2', answer: null, passed: true },
      { playerId: 'p2', roundId: 'r3', answer: null, passed: true },
    ]
    const result = assignBadges(['p1', 'p2'], guesses, rounds, [], { p1: 'Alice', p2: 'Bob' })
    const badges = result.map(r => r.badge)
    // Only one Devdas
    expect(badges.filter(b => b === 'The Devdas')).toHaveLength(1)
    // Both still get a badge
    expect(result).toHaveLength(2)
  })

  it('all players get distinct badges', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p4', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p4', targetAnswer: 50 },
      { roundId: 'r3', targetPlayerId: 'p4', targetAnswer: 50 },
    ]
    const guesses = [
      { playerId: 'p1', roundId: 'r1', answer: 50, passed: false }, // exact
      { playerId: 'p1', roundId: 'r2', answer: 50, passed: false }, // exact
      { playerId: 'p2', roundId: 'r1', answer: null, passed: true },
      { playerId: 'p2', roundId: 'r2', answer: null, passed: true },
      { playerId: 'p2', roundId: 'r3', answer: null, passed: true },
      { playerId: 'p3', roundId: 'r1', answer: 500, passed: false },
      { playerId: 'p3', roundId: 'r2', answer: 500, passed: false },
      { playerId: 'p3', roundId: 'r3', answer: 500, passed: false },
    ]
    const result = assignBadges(['p1', 'p2', 'p3'], guesses, rounds, [], { p1: 'A', p2: 'B', p3: 'C' })
    const badges = result.map(r => r.badge)
    const uniqueBadges = new Set(badges)
    expect(uniqueBadges.size).toBe(badges.length)
  })
})

describe('assignBadges — edge cases', () => {
  it('returns one badge per player', () => {
    const rounds = [{ roundId: 'r1', targetPlayerId: 'p2', targetAnswer: 50 }]
    const guesses = [
      { playerId: 'p1', roundId: 'r1', answer: 48, passed: false },
      { playerId: 'p2', roundId: 'r1', answer: 48, passed: false },
    ]
    const result = assignBadges(['p1', 'p2'], guesses, rounds, [], { p1: 'Alice', p2: 'Bob' })
    expect(result).toHaveLength(2)
    expect(result.map(b => b.playerId)).toContain('p1')
    expect(result.map(b => b.playerId)).toContain('p2')
  })

  it('each badge result has playerId, badge, emoji, name, copy', () => {
    const rounds = [{ roundId: 'r1', targetPlayerId: 'p2', targetAnswer: 50 }]
    const guesses = [{ playerId: 'p1', roundId: 'r1', answer: 48, passed: false }]
    const result = assignBadges(['p1'], guesses, rounds, [], { p1: 'Alice' })
    const badge = result[0]
    expect(badge.playerId).toBe('p1')
    expect(badge.badge).toBeTruthy()
    expect(badge.emoji).toBeTruthy()
    expect(badge.name).toBeTruthy()
    expect(badge.copy).toBeTruthy()
  })

  it('empty player list returns empty array', () => {
    expect(assignBadges([], [], [], [], {})).toHaveLength(0)
  })

  it('player with no guesses at all gets a badge without crashing', () => {
    const rounds = [{ roundId: 'r1', targetPlayerId: 'p2', targetAnswer: 50 }]
    const result = assignBadges(['p1'], [], rounds, [], { p1: 'Silent' })
    expect(result).toHaveLength(1)
    expect(result[0].badge).toBeTruthy()
  })

  it('works correctly without submittedAt (graceful degradation)', () => {
    const rounds = [
      { roundId: 'r1', targetPlayerId: 'p2', targetAnswer: 50 },
      { roundId: 'r2', targetPlayerId: 'p2', targetAnswer: 50 },
    ]
    const guesses = [
      { playerId: 'p1', roundId: 'r1', answer: 50, passed: false }, // exact — no submittedAt
      { playerId: 'p1', roundId: 'r2', answer: 50, passed: false }, // exact
    ]
    const result = assignBadges(['p1'], guesses, rounds, [], { p1: 'NoTimestamp' })
    expect(result[0].badge).toBe('The Baba Vanga')
  })
})
