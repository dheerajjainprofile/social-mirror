/**
 * scoring.test.ts
 *
 * Tests for the core scoring logic that drives calculate-winner.
 * These are pure-function tests — no Supabase needed.
 * Covers the exact scenarios that caused bugs in production.
 */

import { describe, it, expect } from 'vitest'
import { calculateScores } from '../lib/utils'

// ─── Simple mode ─────────────────────────────────────────────────────────────

describe('calculateScores — simple mode', () => {
  it('single player closest wins 1pt', () => {
    const result = calculateScores(
      [{ playerId: 'A', answer: 48, submittedAt: '' }],
      50,
      'simple'
    )
    expect(result.find(r => r.playerId === 'A')?.points).toBe(1)
  })

  it('clear winner gets 1pt, loser gets 0', () => {
    const result = calculateScores(
      [
        { playerId: 'A', answer: 49, submittedAt: '' },
        { playerId: 'B', answer: 10, submittedAt: '' },
      ],
      50,
      'simple'
    )
    expect(result.find(r => r.playerId === 'A')?.points).toBe(1)
    expect(result.find(r => r.playerId === 'B')?.points).toBe(0)
  })

  it('two players same distance both get 1pt (tie)', () => {
    // target=30, A says 20 (off by 10), B says 40 (off by 10)
    const result = calculateScores(
      [
        { playerId: 'A', answer: 20, submittedAt: '' },
        { playerId: 'B', answer: 40, submittedAt: '' },
      ],
      30,
      'simple'
    )
    expect(result.find(r => r.playerId === 'A')?.points).toBe(1)
    expect(result.find(r => r.playerId === 'B')?.points).toBe(1)
  })

  it('exact match beats a close guess', () => {
    const result = calculateScores(
      [
        { playerId: 'A', answer: 30, submittedAt: '' }, // exact
        { playerId: 'B', answer: 31, submittedAt: '' }, // 1 off
      ],
      30,
      'simple'
    )
    expect(result.find(r => r.playerId === 'A')?.points).toBe(1)
    expect(result.find(r => r.playerId === 'B')?.points).toBe(0)
  })

  it('all players exact match — all get 1pt', () => {
    const result = calculateScores(
      [
        { playerId: 'A', answer: 50, submittedAt: '' },
        { playerId: 'B', answer: 50, submittedAt: '' },
        { playerId: 'C', answer: 50, submittedAt: '' },
      ],
      50,
      'simple'
    )
    expect(result.every(r => r.points === 1)).toBe(true)
  })

  it('returns empty array for no guesses', () => {
    expect(calculateScores([], 50, 'simple')).toEqual([])
  })
})

// ─── Rich mode ────────────────────────────────────────────────────────────────

describe('calculateScores — rich mode', () => {
  it('1st=3pts, 2nd=2pts, 3rd=1pt in clear ranking', () => {
    const result = calculateScores(
      [
        { playerId: 'A', answer: 51, submittedAt: '' }, // 1 off
        { playerId: 'B', answer: 55, submittedAt: '' }, // 5 off
        { playerId: 'C', answer: 70, submittedAt: '' }, // 20 off
        { playerId: 'D', answer: 10, submittedAt: '' }, // 40 off
      ],
      50,
      'rich'
    )
    expect(result.find(r => r.playerId === 'A')?.points).toBe(3)
    expect(result.find(r => r.playerId === 'B')?.points).toBe(2)
    expect(result.find(r => r.playerId === 'C')?.points).toBe(1)
    expect(result.find(r => r.playerId === 'D')?.points).toBe(0)
  })

  it('tie for 1st: both get 3pts, next gets 2pts (dense ranking)', () => {
    // target=30, A&B both say 20 (tied), C says 40
    const result = calculateScores(
      [
        { playerId: 'A', answer: 20, submittedAt: '' },
        { playerId: 'B', answer: 40, submittedAt: '' },
        { playerId: 'C', answer: 5,  submittedAt: '' },
      ],
      30,
      'rich'
    )
    expect(result.find(r => r.playerId === 'A')?.points).toBe(3)
    expect(result.find(r => r.playerId === 'B')?.points).toBe(3)
    expect(result.find(r => r.playerId === 'C')?.points).toBe(2)
  })

  it('single player gets 3pts', () => {
    const result = calculateScores(
      [{ playerId: 'A', answer: 99, submittedAt: '' }],
      100,
      'rich'
    )
    expect(result.find(r => r.playerId === 'A')?.points).toBe(3)
  })

  it('player far off gets 0 pts even in 4th place', () => {
    const result = calculateScores(
      [
        { playerId: 'A', answer: 51, submittedAt: '' },
        { playerId: 'B', answer: 55, submittedAt: '' },
        { playerId: 'C', answer: 60, submittedAt: '' },
        { playerId: 'D', answer: 200, submittedAt: '' },
      ],
      50,
      'rich'
    )
    expect(result.find(r => r.playerId === 'D')?.points).toBe(0)
  })
})

// ─── Winner selection (mirrors calculate-winner route logic) ─────────────────

describe('winner selection from calculateScores', () => {
  it('topScorer is the player with highest points', () => {
    const scores = calculateScores(
      [
        { playerId: 'A', answer: 49, submittedAt: '' },
        { playerId: 'B', answer: 20, submittedAt: '' },
      ],
      50,
      'rich'
    )
    const maxPoints = Math.max(...scores.map(s => s.points))
    const topScorers = scores.filter(s => s.points === maxPoints && s.points > 0)
    expect(topScorers.map(s => s.playerId)).toContain('A')
    expect(topScorers).toHaveLength(1)
  })

  it('tied topScorers returns both player IDs', () => {
    const scores = calculateScores(
      [
        { playerId: 'A', answer: 20, submittedAt: '' },
        { playerId: 'B', answer: 40, submittedAt: '' },
        { playerId: 'C', answer: 5,  submittedAt: '' },
      ],
      30,
      'simple'
    )
    const maxPoints = Math.max(...scores.map(s => s.points))
    const topScorers = scores.filter(s => s.points === maxPoints && s.points > 0)
    expect(topScorers.map(s => s.playerId)).toContain('A')
    expect(topScorers.map(s => s.playerId)).toContain('B')
    expect(topScorers).toHaveLength(2)
  })

  it('no guesses → no topScorers', () => {
    const scores = calculateScores([], 50, 'simple')
    const topScorers = scores.filter(s => s.points > 0)
    expect(topScorers).toHaveLength(0)
  })
})
