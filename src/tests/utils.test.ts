import { describe, it, expect } from 'vitest'
import { calculateScores, calculateHotCold, generateRoomCode } from '../lib/utils'
import { getPlayerColorByIndex } from '../lib/playerColors'
import { computeBadge } from '../lib/badgeLogic'
import { getChaosScoreLabel } from '../lib/chaosScore'
import { getAdaptiveRevealDelay } from '../lib/revealTiming'

// ─── generateRoomCode ────────────────────────────────────────────────────────

describe('generateRoomCode', () => {
  it('always returns exactly 6 characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRoomCode()).toHaveLength(6)
    }
  })

  it('never contains ambiguous characters I, O, 1, 0', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode()
      expect(code).not.toMatch(/[IO10]/)
    }
  })

  it('only contains uppercase letters and digits', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRoomCode()).toMatch(/^[A-Z2-9]+$/)
    }
  })
})

// ─── calculateHotCold ────────────────────────────────────────────────────────

describe('calculateHotCold', () => {
  it('returns hot when guess is within 20% of target', () => {
    expect(calculateHotCold(95, 100)).toBe('hot')   // 5% off
    expect(calculateHotCold(105, 100)).toBe('hot')  // 5% off
    expect(calculateHotCold(81, 100)).toBe('hot')   // 19% off — just inside hot threshold
  })

  it('returns warm when guess is 20–50% off target', () => {
    expect(calculateHotCold(80, 100)).toBe('warm')  // exactly 20% off — boundary is warm
    expect(calculateHotCold(60, 100)).toBe('warm')  // 40% off
    expect(calculateHotCold(55, 100)).toBe('warm')  // 45% off
    expect(calculateHotCold(51, 100)).toBe('warm')  // just above 49% off
  })

  it('returns cold when guess is more than 50% off target', () => {
    expect(calculateHotCold(49, 100)).toBe('cold')  // 51% off
    expect(calculateHotCold(10, 100)).toBe('cold')  // 90% off
    expect(calculateHotCold(200, 100)).toBe('cold') // 100% off
  })

  it('handles exact match as hot', () => {
    expect(calculateHotCold(100, 100)).toBe('hot')
    expect(calculateHotCold(0, 0)).toBe('hot')
  })

  it('handles target = 0 edge case', () => {
    expect(calculateHotCold(0, 0)).toBe('hot')    // exact
    expect(calculateHotCold(0.5, 0)).toBe('hot')  // diff < 1
    expect(calculateHotCold(3, 0)).toBe('warm')   // diff < 5
    expect(calculateHotCold(10, 0)).toBe('cold')  // diff >= 5
  })
})

// ─── calculateScores — Simple mode ───────────────────────────────────────────

describe('calculateScores — simple mode', () => {
  it('closest player gets 1 point', () => {
    const guesses = [
      { playerId: 'p1', answer: 47, submittedAt: '2026-01-01T00:00:00Z' },
      { playerId: 'p2', answer: 60, submittedAt: '2026-01-01T00:00:01Z' },
    ]
    const result = calculateScores(guesses, 47, 'simple')
    expect(result.find(r => r.playerId === 'p1')?.points).toBe(1)
    expect(result.find(r => r.playerId === 'p2')?.points).toBe(0)
  })

  it('2-way tie — both players get 1 point', () => {
    const guesses = [
      { playerId: 'p1', answer: 47, submittedAt: '2026-01-01T00:00:00Z' },
      { playerId: 'p2', answer: 47, submittedAt: '2026-01-01T00:00:01Z' },
    ]
    const result = calculateScores(guesses, 47, 'simple')
    expect(result.find(r => r.playerId === 'p1')?.points).toBe(1)
    expect(result.find(r => r.playerId === 'p2')?.points).toBe(1)
  })

  it('returns empty array when no guesses', () => {
    expect(calculateScores([], 47, 'simple')).toEqual([])
  })
})

// ─── calculateScores — Rich mode ─────────────────────────────────────────────

describe('calculateScores — rich mode', () => {
  it('1st=3pts, 2nd=2pts, 3rd=1pt', () => {
    const guesses = [
      { playerId: 'p1', answer: 47, submittedAt: '2026-01-01T00:00:00Z' }, // closest
      { playerId: 'p2', answer: 50, submittedAt: '2026-01-01T00:00:01Z' }, // 2nd
      { playerId: 'p3', answer: 55, submittedAt: '2026-01-01T00:00:02Z' }, // 3rd
      { playerId: 'p4', answer: 80, submittedAt: '2026-01-01T00:00:03Z' }, // 4th
    ]
    const result = calculateScores(guesses, 47, 'rich')
    expect(result.find(r => r.playerId === 'p1')?.points).toBe(3)
    expect(result.find(r => r.playerId === 'p2')?.points).toBe(2)
    expect(result.find(r => r.playerId === 'p3')?.points).toBe(1)
    expect(result.find(r => r.playerId === 'p4')?.points).toBe(0)
  })

  it('exact 2-way tie for 1st — both get 3pts', () => {
    const guesses = [
      { playerId: 'p1', answer: 47, submittedAt: '2026-01-01T00:00:00Z' },
      { playerId: 'p2', answer: 47, submittedAt: '2026-01-01T00:00:01Z' },
      { playerId: 'p3', answer: 60, submittedAt: '2026-01-01T00:00:02Z' },
    ]
    const result = calculateScores(guesses, 47, 'rich')
    expect(result.find(r => r.playerId === 'p1')?.points).toBe(3)
    expect(result.find(r => r.playerId === 'p2')?.points).toBe(3)
    expect(result.find(r => r.playerId === 'p3')?.points).toBe(2)
  })

  it('3-way tie for 1st — all three get 3pts', () => {
    const guesses = [
      { playerId: 'p1', answer: 47, submittedAt: '2026-01-01T00:00:00Z' },
      { playerId: 'p2', answer: 47, submittedAt: '2026-01-01T00:00:01Z' },
      { playerId: 'p3', answer: 47, submittedAt: '2026-01-01T00:00:02Z' },
    ]
    const result = calculateScores(guesses, 47, 'rich')
    result.forEach(r => expect(r.points).toBe(3))
  })

  it('partial tie — two tied for 2nd both get 2pts', () => {
    const guesses = [
      { playerId: 'p1', answer: 47, submittedAt: '2026-01-01T00:00:00Z' }, // 1st: 3pts
      { playerId: 'p2', answer: 50, submittedAt: '2026-01-01T00:00:01Z' }, // tied 2nd: 2pts
      { playerId: 'p3', answer: 50, submittedAt: '2026-01-01T00:00:02Z' }, // tied 2nd: 2pts
      { playerId: 'p4', answer: 80, submittedAt: '2026-01-01T00:00:03Z' }, // 3rd (dense): 1pt
    ]
    const result = calculateScores(guesses, 47, 'rich')
    expect(result.find(r => r.playerId === 'p1')?.points).toBe(3)
    expect(result.find(r => r.playerId === 'p2')?.points).toBe(2)
    expect(result.find(r => r.playerId === 'p3')?.points).toBe(2)
    expect(result.find(r => r.playerId === 'p4')?.points).toBe(1)
  })

  it('all players submit the same number — everyone gets 3pts', () => {
    const guesses = [
      { playerId: 'p1', answer: 47, submittedAt: '2026-01-01T00:00:00Z' },
      { playerId: 'p2', answer: 47, submittedAt: '2026-01-01T00:00:01Z' },
      { playerId: 'p3', answer: 47, submittedAt: '2026-01-01T00:00:02Z' },
      { playerId: 'p4', answer: 47, submittedAt: '2026-01-01T00:00:03Z' },
    ]
    const result = calculateScores(guesses, 47, 'rich')
    result.forEach(r => expect(r.points).toBe(3))
  })

  it('single player gets 3pts in rich mode', () => {
    const guesses = [
      { playerId: 'p1', answer: 50, submittedAt: '2026-01-01T00:00:00Z' },
    ]
    const result = calculateScores(guesses, 47, 'rich')
    expect(result.find(r => r.playerId === 'p1')?.points).toBe(3)
  })

  it('returns empty array when no guesses', () => {
    expect(calculateScores([], 47, 'rich')).toEqual([])
  })
})

// ─── getPlayerColorByIndex ────────────────────────────────────────────────────
// Colours are assigned by join order (index), not by hashing player ID.
// Guarantees uniqueness within a session for up to 12 players.

describe('getPlayerColorByIndex', () => {
  it('returns a colour object with required keys for indices 0–11', () => {
    for (let i = 0; i <= 11; i++) {
      const colour = getPlayerColorByIndex(i)
      expect(colour).toBeTruthy()
      expect(colour).toHaveProperty('bg')
      expect(colour).toHaveProperty('dot')
      expect(colour.dot).toBeTruthy()
    }
  })

  it('returns different dot colours for different indices', () => {
    const dots = Array.from({ length: 10 }, (_, i) => getPlayerColorByIndex(i).dot)
    const unique = new Set(dots)
    expect(unique.size).toBe(10) // all 10 dot colours must be distinct
  })

  it('returns same colour for same index (deterministic)', () => {
    expect(getPlayerColorByIndex(0).dot).toBe(getPlayerColorByIndex(0).dot)
    expect(getPlayerColorByIndex(5).dot).toBe(getPlayerColorByIndex(5).dot)
  })

  it('wraps around gracefully for index >= 10', () => {
    // If more than 10 players somehow, should not crash
    expect(() => getPlayerColorByIndex(10)).not.toThrow()
    expect(() => getPlayerColorByIndex(11)).not.toThrow()
  })
})

// ─── getChaosScoreLabel ───────────────────────────────────────────────────────
// Raw number is never shown to users — only emoji + label + descriptor.

describe('getChaosScoreLabel', () => {
  it('returns Eerily Accurate for score <= 20', () => {
    const result = getChaosScoreLabel(0)
    expect(result.emoji).toBe('🎯')
    expect(result.label).toBe('Eerily Accurate')
    expect(result.description).toBeTruthy()

    const result2 = getChaosScoreLabel(20)
    expect(result2.label).toBe('Eerily Accurate')
  })

  it('returns Pretty Good Reads for score 21–50', () => {
    const result = getChaosScoreLabel(21)
    expect(result.emoji).toBe('😊')
    expect(result.label).toBe('Pretty Good Reads')

    const result2 = getChaosScoreLabel(50)
    expect(result2.label).toBe('Pretty Good Reads')
  })

  it('returns Respectably Chaotic for score 51–100', () => {
    const result = getChaosScoreLabel(51)
    expect(result.emoji).toBe('😂')
    expect(result.label).toBe('Respectably Chaotic')

    const result2 = getChaosScoreLabel(100)
    expect(result2.label).toBe('Respectably Chaotic')
  })

  it('returns Beautiful Chaos for score > 100', () => {
    const result = getChaosScoreLabel(101)
    expect(result.emoji).toBe('💀')
    expect(result.label).toBe('Beautiful Chaos')

    const result2 = getChaosScoreLabel(999)
    expect(result2.label).toBe('Beautiful Chaos')
  })

  it('each result includes a non-empty description string', () => {
    [0, 30, 75, 200].forEach(score => {
      const result = getChaosScoreLabel(score)
      expect(result.description).toBeTruthy()
      expect(typeof result.description).toBe('string')
    })
  })
})

// ─── getAdaptiveRevealDelay ───────────────────────────────────────────────────
// Adaptive timing: fast for early cards, slow for last 3 (tension + target reveal).
// Cards 1 to (n-3): 0.8s | Cards (n-2) and (n-1): 1.5s | Last card: 2.5s

describe('getAdaptiveRevealDelay', () => {
  it('returns 800ms for early cards (not in last 3)', () => {
    // 10 players: cards 0–6 are early
    expect(getAdaptiveRevealDelay(0, 10)).toBe(800)
    expect(getAdaptiveRevealDelay(3, 10)).toBe(800)
    expect(getAdaptiveRevealDelay(6, 10)).toBe(800)
  })

  it('returns 1500ms for second-to-last and third-to-last cards', () => {
    // 10 players: cards 7 and 8 are tension cards
    expect(getAdaptiveRevealDelay(7, 10)).toBe(1500)
    expect(getAdaptiveRevealDelay(8, 10)).toBe(1500)
  })

  it('returns 2500ms for the last card (target answer)', () => {
    // 10 players: card 9 is last
    expect(getAdaptiveRevealDelay(9, 10)).toBe(2500)
  })

  it('works correctly for 4 players', () => {
    // 4 players: card 0 = early (800ms), cards 1+2 = tension (1500ms), card 3 = last (2500ms)
    expect(getAdaptiveRevealDelay(0, 4)).toBe(800)
    expect(getAdaptiveRevealDelay(1, 4)).toBe(1500)
    expect(getAdaptiveRevealDelay(2, 4)).toBe(1500)
    expect(getAdaptiveRevealDelay(3, 4)).toBe(2500)
  })

  it('works correctly for 3 players — all in the last-3 window', () => {
    // 3 players: no early cards, card 0 = tension, card 1 = tension, card 2 = last
    expect(getAdaptiveRevealDelay(0, 3)).toBe(1500)
    expect(getAdaptiveRevealDelay(1, 3)).toBe(1500)
    expect(getAdaptiveRevealDelay(2, 3)).toBe(2500)
  })

  it('works correctly for 1 player — only card is the last card', () => {
    expect(getAdaptiveRevealDelay(0, 1)).toBe(2500)
  })
})

// ─── computeBadge ─────────────────────────────────────────────────────────────
// 13 Indian pop culture badges. Priority order (rarest first):
// Baba Vanga → Aamir Khan → Virat Kohli → MS Dhoni → Mogambo → Salman Khan →
// SRK → Arnab → Ambani → Hardik Pandya → Gabbar Singh → Devdas → Babu Bhaiya

describe('computeBadge', () => {
  // Helper to build a minimal player stats object
  const makeStats = (overrides = {}) => ({
    playerId: 'p1',
    exactGuesses: 0,
    roundsWon: 0,
    consecutiveWins: 0,
    avgDistance: 50,
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
  })

  it('assigns Baba Vanga for 2+ exact guesses', () => {
    const badge = computeBadge(makeStats({ exactGuesses: 2 }))
    expect(badge.name).toBe('The Baba Vanga')
  })

  it('assigns Aamir Khan for highest accuracy + slowest submission', () => {
    const badge = computeBadge(makeStats({ isSlowButAccurate: true }))
    expect(badge.name).toBe('The Aamir Khan')
  })

  it('assigns Virat Kohli for 3+ consecutive wins', () => {
    const badge = computeBadge(makeStats({ consecutiveWins: 3 }))
    expect(badge.name).toBe('The Virat Kohli')
  })

  it('assigns MS Dhoni for closest guesser most rounds', () => {
    const badge = computeBadge(makeStats({ closestGuesserRatio: 0.6, isFastestConsistently: false }))
    expect(badge.name).toBe('The MS Dhoni')
  })

  it('assigns Mogambo for highest answer spread as target', () => {
    const badge = computeBadge(makeStats({ answerSpreadAsTarget: 200 }))
    expect(badge.name).toBe('The Mogambo')
  })

  it('assigns Salman Khan for most wins without being fastest', () => {
    const badge = computeBadge(makeStats({ winsWithoutBeingFastest: 3 }))
    expect(badge.name).toBe('The Salman Khan')
  })

  it('assigns Devdas for 3+ passes', () => {
    const badge = computeBadge(makeStats({ passCount: 3 }))
    expect(badge.name).toBe('The Devdas')
  })

  it('assigns Arnab Goswami for fastest every round + lowest accuracy', () => {
    const badge = computeBadge(makeStats({ isFastestConsistently: true, avgDistance: 150 }))
    expect(badge.name).toBe('The Arnab Goswami')
  })

  it('assigns Ambani for submitting highest numbers', () => {
    const badge = computeBadge(makeStats({ submittedHighestNumbers: true }))
    expect(badge.name).toBe('The Ambani')
  })

  it('assigns Babu Bhaiya as fallback — never within 50% of any target', () => {
    const badge = computeBadge(makeStats({ neverWithin50Percent: true }))
    expect(badge.name).toBe('The Babu Bhaiya')
  })

  it('Baba Vanga takes priority over Aamir Khan when both conditions met', () => {
    const badge = computeBadge(makeStats({ exactGuesses: 2, isSlowButAccurate: true }))
    expect(badge.name).toBe('The Baba Vanga')
  })

  it('Aamir Khan takes priority over Virat Kohli when both conditions met', () => {
    const badge = computeBadge(makeStats({ isSlowButAccurate: true, consecutiveWins: 3 }))
    expect(badge.name).toBe('The Aamir Khan')
  })

  it('every badge has a non-empty name, emoji, and copy', () => {
    const statVariants = [
      makeStats({ exactGuesses: 2 }),
      makeStats({ isSlowButAccurate: true }),
      makeStats({ consecutiveWins: 3 }),
      makeStats({ roundsWon: 3, totalRounds: 5 }),
      makeStats({ answerSpreadAsTarget: 200 }),
      makeStats({ winsWithoutBeingFastest: 3 }),
      makeStats({ passCount: 3 }),
      makeStats({ isFastestConsistently: true, avgDistance: 150 }),
      makeStats({ submittedHighestNumbers: true }),
      makeStats({ neverWithin50Percent: true }),
    ]
    statVariants.forEach(stats => {
      const badge = computeBadge(stats)
      expect(badge.name).toBeTruthy()
      expect(badge.emoji).toBeTruthy()
      expect(badge.copy).toBeTruthy()
    })
  })

  it('always returns a badge — never null or undefined', () => {
    // Even with all defaults (no notable behaviour), a badge is assigned
    const badge = computeBadge(makeStats())
    expect(badge).toBeTruthy()
    expect(badge.name).toBeTruthy()
  })
})
