/**
 * roundRanking.test.ts
 *
 * Tests for the biggest-miss and rank logic that lives in RoundRanking.tsx.
 * Extracted as pure functions so they can be tested without React.
 * Covers the bugs we found: exact match flagged as biggest miss,
 * winner flagged as biggest miss when all tie.
 */

import { describe, it, expect } from 'vitest'

// ─── Extracted logic (mirrors RoundRanking.tsx exactly) ──────────────────────

interface Card {
  playerId: string
  answer: number | null
  passed: boolean
  distance: number | null
  rank?: number | null
}

function buildRankedCards(
  guesses: { playerId: string; answer: number | null; passed: boolean }[],
  targetAnswer: number
): Card[] {
  const withDist = guesses.map(c => ({
    ...c,
    distance: c.passed || c.answer === null ? null : Math.abs(c.answer - targetAnswer),
  }))

  const sorted = [...withDist].sort((a, b) => {
    if (a.distance === null) return 1
    if (b.distance === null) return -1
    return a.distance - b.distance
  })

  let rank = 0
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].distance === null) { sorted[i].rank = null; continue }
    if (i > 0 && sorted[i].distance !== sorted[i - 1].distance) rank++
    sorted[i].rank = rank
  }

  return sorted
}

function getBiggestMissId(cards: Card[]): string | null {
  const nonPassed = cards.filter(c => c.distance !== null && c.distance > 0)
  if (nonPassed.length <= 1) return null
  const maxDist = Math.max(...nonPassed.map(c => c.distance!))
  const miss = cards.find(c => c.distance !== null && c.distance > 0 && c.distance === maxDist && c.rank !== 0)
  return miss?.playerId ?? null
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('biggest miss logic', () => {
  it('correctly identifies the furthest player', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: 49, passed: false },
      { playerId: 'B', answer: 10, passed: false },
    ], 50)
    expect(getBiggestMissId(cards)).toBe('B')
  })

  it('does NOT flag exact match as biggest miss', () => {
    // The bug: target=30, all say 30 → distance=0 → maxDist=0 → everyone flagged
    const cards = buildRankedCards([
      { playerId: 'A', answer: 30, passed: false },
      { playerId: 'B', answer: 30, passed: false },
    ], 30)
    expect(getBiggestMissId(cards)).toBeNull()
  })

  it('does NOT flag winner as biggest miss even if their distance equals maxDist among others', () => {
    // target=30, A says 20 (off 10, rank 0 winner), B says 40 (off 10, rank 0 tied), C says 5 (off 25)
    const cards = buildRankedCards([
      { playerId: 'A', answer: 20, passed: false },
      { playerId: 'B', answer: 40, passed: false },
      { playerId: 'C', answer: 5,  passed: false },
    ], 30)
    expect(getBiggestMissId(cards)).toBe('C')
  })

  it('returns null when only 1 non-passed player', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: 10, passed: false },
    ], 50)
    expect(getBiggestMissId(cards)).toBeNull()
  })

  it('ignores passed players for biggest miss', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: 49, passed: false },
      { playerId: 'B', answer: null, passed: true },
      { playerId: 'C', answer: 5,   passed: false },
    ], 50)
    expect(getBiggestMissId(cards)).toBe('C')
  })

  it('returns null when all players passed', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: null, passed: true },
      { playerId: 'B', answer: null, passed: true },
    ], 50)
    expect(getBiggestMissId(cards)).toBeNull()
  })

  it('no biggest miss when all players are exact', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: 50, passed: false },
      { playerId: 'B', answer: 50, passed: false },
      { playerId: 'C', answer: 50, passed: false },
    ], 50)
    expect(getBiggestMissId(cards)).toBeNull()
  })
})

describe('rank assignment', () => {
  it('single player gets rank 0', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: 50, passed: false },
    ], 50)
    expect(cards.find(c => c.playerId === 'A')?.rank).toBe(0)
  })

  it('passed player gets null rank', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: null, passed: true },
    ], 50)
    expect(cards.find(c => c.playerId === 'A')?.rank).toBeNull()
  })

  it('two tied players both get rank 0', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: 20, passed: false },
      { playerId: 'B', answer: 40, passed: false },
    ], 30)
    expect(cards.find(c => c.playerId === 'A')?.rank).toBe(0)
    expect(cards.find(c => c.playerId === 'B')?.rank).toBe(0)
  })

  it('dense ranking: after two tied at 0, next player gets rank 1', () => {
    const cards = buildRankedCards([
      { playerId: 'A', answer: 20, passed: false }, // off 10
      { playerId: 'B', answer: 40, passed: false }, // off 10
      { playerId: 'C', answer: 5,  passed: false }, // off 25
    ], 30)
    expect(cards.find(c => c.playerId === 'C')?.rank).toBe(1)
  })
})
