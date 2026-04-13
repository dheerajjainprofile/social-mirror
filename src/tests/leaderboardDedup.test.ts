/**
 * leaderboardDedup.test.ts
 *
 * Tests for the leaderboard score deduplication fix.
 *
 * Bug caught: setScores called on every 2s poll even when data unchanged
 * → React re-renders leaderboard on every tick → visible flash/flicker on screen.
 *
 * Fix: skip setState if scores are identical to current state.
 */

import { describe, it, expect, vi } from 'vitest'

interface PlayerScore {
  playerId: string
  playerName: string
  totalPoints: number
  colorIndex?: number
}

// Mirrors the dedup logic added to loadScores
function shouldUpdateScores(prev: PlayerScore[], next: PlayerScore[]): boolean {
  if (prev.length !== next.length) return true
  return !prev.every(
    (s, i) => s.playerId === next[i].playerId && s.totalPoints === next[i].totalPoints
  )
}

describe('leaderboard score deduplication', () => {
  const scores: PlayerScore[] = [
    { playerId: 'p1', playerName: 'Alice', totalPoints: 10 },
    { playerId: 'p2', playerName: 'Bob', totalPoints: 7 },
    { playerId: 'p3', playerName: 'Carol', totalPoints: 3 },
  ]

  it('does NOT update when scores are identical (prevents flashing)', () => {
    const identical = [
      { playerId: 'p1', playerName: 'Alice', totalPoints: 10 },
      { playerId: 'p2', playerName: 'Bob', totalPoints: 7 },
      { playerId: 'p3', playerName: 'Carol', totalPoints: 3 },
    ]
    expect(shouldUpdateScores(scores, identical)).toBe(false)
  })

  it('updates when a player gains points', () => {
    const updated = [
      { playerId: 'p1', playerName: 'Alice', totalPoints: 13 }, // +3
      { playerId: 'p2', playerName: 'Bob', totalPoints: 7 },
      { playerId: 'p3', playerName: 'Carol', totalPoints: 3 },
    ]
    expect(shouldUpdateScores(scores, updated)).toBe(true)
  })

  it('updates when a new player is added', () => {
    const withNewPlayer = [
      ...scores,
      { playerId: 'p4', playerName: 'Dave', totalPoints: 0 },
    ]
    expect(shouldUpdateScores(scores, withNewPlayer)).toBe(true)
  })

  it('updates when order changes (player overtakes another)', () => {
    const reordered = [
      { playerId: 'p2', playerName: 'Bob', totalPoints: 7 },
      { playerId: 'p1', playerName: 'Alice', totalPoints: 10 },
      { playerId: 'p3', playerName: 'Carol', totalPoints: 3 },
    ]
    // Different playerId at index 0 → must update
    expect(shouldUpdateScores(scores, reordered)).toBe(true)
  })

  it('updates when player is removed (e.g. organizer removed them)', () => {
    const withoutCarol = scores.slice(0, 2)
    expect(shouldUpdateScores(scores, withoutCarol)).toBe(true)
  })

  it('does NOT update empty → empty (initial state before game starts)', () => {
    expect(shouldUpdateScores([], [])).toBe(false)
  })

  it('updates empty → non-empty (first score load)', () => {
    expect(shouldUpdateScores([], scores)).toBe(true)
  })

  it('simulates 10 identical polls — never triggers update', () => {
    let updateCount = 0
    let current = scores

    for (let i = 0; i < 10; i++) {
      const next = [
        { playerId: 'p1', playerName: 'Alice', totalPoints: 10 },
        { playerId: 'p2', playerName: 'Bob', totalPoints: 7 },
        { playerId: 'p3', playerName: 'Carol', totalPoints: 3 },
      ]
      if (shouldUpdateScores(current, next)) {
        updateCount++
        current = next
      }
    }

    expect(updateCount).toBe(0) // zero re-renders during stable game
  })

  it('simulates round completing — exactly 1 update when scores change', () => {
    let updateCount = 0
    let current = scores

    // 3 polls with same data
    for (let i = 0; i < 3; i++) {
      const next = [...scores]
      if (shouldUpdateScores(current, next)) { updateCount++; current = next }
    }

    // Round ends — Alice gets 3 points
    const afterRound = [
      { playerId: 'p1', playerName: 'Alice', totalPoints: 13 },
      { playerId: 'p2', playerName: 'Bob', totalPoints: 7 },
      { playerId: 'p3', playerName: 'Carol', totalPoints: 3 },
    ]
    if (shouldUpdateScores(current, afterRound)) { updateCount++; current = afterRound }

    // 3 more polls with same data
    for (let i = 0; i < 3; i++) {
      const next = [...afterRound]
      if (shouldUpdateScores(current, next)) { updateCount++; current = next }
    }

    expect(updateCount).toBe(1) // exactly 1 re-render when scores actually changed
  })
})
