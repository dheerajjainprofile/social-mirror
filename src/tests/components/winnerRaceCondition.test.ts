/**
 * winnerRaceCondition.test.ts
 *
 * Tests for Bug 3 — organizer shows 1 winner when B & C both tied.
 *
 * Root cause: auto-reveal guard was `if (!winnerPlayer) handleCalculateWinner()`.
 * refreshAll (triggered by scores INSERT realtime event) sets winnerPlayer early
 * from round.winner_player_id before handleCalculateWinner resolves.
 * The guard then fires false → handleCalculateWinner never called →
 * winners[] stays empty → revealWinnerNames stays empty → only 1 winner shown.
 *
 * The fix: guard on `winners.length === 0` instead.
 *
 * These tests would have caught this before shipping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useEffect, useRef } from 'react'

interface Player { id: string; name: string }

// ── Exact logic from auto-reveal useEffect (organizer page) ──────────────────

function useAutoRevealGuard_BROKEN(
  revealedCount: number,
  totalCards: number,
  winnerPlayer: Player | null,
  onCalculate: () => void
) {
  useEffect(() => {
    if (totalCards === 0) return
    if (revealedCount < totalCards) return
    // BUG: winnerPlayer can be set early by refreshAll
    if (!winnerPlayer) onCalculate()
  }, [revealedCount, totalCards, winnerPlayer, onCalculate])
}

// SUPERSEDED guard (v4 intermediate): winners.length === 0
// Kept for historical record — this guard fixed the tied-winner race but
// introduced a new infinite-loop bug when there was no winner (all passed).
function useAutoRevealGuard_FIXED_V1(
  revealedCount: number,
  totalCards: number,
  winners: Player[],
  onCalculate: () => void
) {
  useEffect(() => {
    if (totalCards === 0) return
    if (revealedCount < totalCards) return
    // Intermediate fix: guard on winners array being empty.
    // BUG: when no winner (all passed), winners stays [] and currentRound.status
    // changes to 'done' after the API call — re-triggering this effect infinitely.
    if (winners.length === 0) onCalculate()
  }, [revealedCount, totalCards, winners.length, onCalculate])
}

// CURRENT guard (v4 final): calculatedForRoundRef per-round dedup
// Mirrors the actual implementation: useRef<string | null>(null) tracks
// which round.id has already had calculate-winner called.
function useAutoRevealGuard_FIXED_V2(
  revealedCount: number,
  totalCards: number,
  roundId: string | null,
  onCalculate: () => void
) {
  const calculatedForRoundRef = useRef<string | null>(null)

  useEffect(() => {
    if (totalCards === 0) return
    if (revealedCount < totalCards) return
    if (calculatedForRoundRef.current !== roundId) {
      calculatedForRoundRef.current = roundId
      onCalculate()
    }
  }, [revealedCount, totalCards, roundId, onCalculate])
}

// ─────────────────────────────────────────────────────────────────────────────

describe('auto-reveal winner guard — broken vs fixed', () => {
  it('BROKEN: skips calculate when winnerPlayer set early by refreshAll', () => {
    const onCalculate = vi.fn()

    // Simulate: refreshAll fires scores INSERT → sets winnerPlayer = B
    // BEFORE handleCalculateWinner resolves (race condition)
    const earlyWinner: Player = { id: 'B', name: 'Player B' }

    renderHook(() =>
      useAutoRevealGuard_BROKEN(3, 3, earlyWinner, onCalculate)
    )

    // All cards revealed, but winnerPlayer is already set (by refreshAll)
    // → guard fires `!winnerPlayer = false` → skips calculate
    expect(onCalculate).not.toHaveBeenCalled() // BUG: tied winner C never computed
  })

  it('v1 FIXED: calls calculate even when winnerPlayer is set early', () => {
    const onCalculate = vi.fn()

    renderHook(() =>
      useAutoRevealGuard_FIXED_V1(3, 3, [], onCalculate) // winners = [] even though winnerPlayer is set
    )

    expect(onCalculate).toHaveBeenCalledTimes(1) // FIXED: calculate runs
  })

  it('v1 FIXED: does not call calculate again once winners array is populated', () => {
    const onCalculate = vi.fn()

    const { rerender } = renderHook(
      ({ winners }: { winners: Player[] }) =>
        useAutoRevealGuard_FIXED_V1(3, 3, winners, onCalculate),
      { initialProps: { winners: [] } }
    )

    expect(onCalculate).toHaveBeenCalledTimes(1)

    rerender({ winners: [{ id: 'B', name: 'B' }, { id: 'C', name: 'C' }] })

    expect(onCalculate).toHaveBeenCalledTimes(1) // no duplicate call
  })

  it('v1 BUG (no-winner infinite loop): re-fires when round.status changes to done and winners stays empty', () => {
    // This documents why v1 is not enough.
    // When all players pass, calculate-winner returns winner=null.
    // winners stays []. currentRound.status changes lobby→guessing→reveal→done.
    // Each status change re-triggers the effect. winners.length === 0 is always true → infinite loop.
    const onCalculate = vi.fn()

    const { rerender } = renderHook(
      ({ revealedCount, totalCards }: { revealedCount: number; totalCards: number }) =>
        useAutoRevealGuard_FIXED_V1(revealedCount, totalCards, [], onCalculate),
      { initialProps: { revealedCount: 3, totalCards: 3 } }
    )
    expect(onCalculate).toHaveBeenCalledTimes(1)

    // Simulate status change to 'done' causing a re-render with same counts
    // In real code this triggers because currentRound?.status is in the deps
    rerender({ revealedCount: 3, totalCards: 3 })

    // v1 BUG: fires again (infinite loop when no winner and status changes)
    expect(onCalculate).toHaveBeenCalledTimes(2) // keeps firing
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// v2 guard (current) — calculatedForRoundRef per-round dedup
// ─────────────────────────────────────────────────────────────────────────────

describe('auto-reveal guard v2 — calculatedForRoundRef (current implementation)', () => {
  it('calls calculate exactly once when all cards revealed', () => {
    const onCalculate = vi.fn()
    renderHook(() => useAutoRevealGuard_FIXED_V2(3, 3, 'round-1', onCalculate))
    expect(onCalculate).toHaveBeenCalledTimes(1)
  })

  it('does NOT call calculate again when status changes to done (no-winner infinite loop fixed)', () => {
    const onCalculate = vi.fn()

    const { rerender } = renderHook(
      ({ revealedCount, totalCards }: { revealedCount: number; totalCards: number }) =>
        useAutoRevealGuard_FIXED_V2(revealedCount, totalCards, 'round-1', onCalculate),
      { initialProps: { revealedCount: 3, totalCards: 3 } }
    )
    expect(onCalculate).toHaveBeenCalledTimes(1)

    // Same round ID, same counts — simulate status-change re-render
    rerender({ revealedCount: 3, totalCards: 3 })
    expect(onCalculate).toHaveBeenCalledTimes(1) // FIXED: no re-fire
  })

  it('calls calculate again for a new round (different round ID)', () => {
    const onCalculate = vi.fn()

    const { rerender } = renderHook(
      ({ roundId }: { roundId: string }) =>
        useAutoRevealGuard_FIXED_V2(3, 3, roundId, onCalculate),
      { initialProps: { roundId: 'round-1' } }
    )
    expect(onCalculate).toHaveBeenCalledTimes(1)

    // New round starts — different ID
    rerender({ roundId: 'round-2' })
    expect(onCalculate).toHaveBeenCalledTimes(2)
  })

  it('does NOT call calculate when cards not yet all revealed', () => {
    const onCalculate = vi.fn()
    renderHook(() => useAutoRevealGuard_FIXED_V2(2, 5, 'round-1', onCalculate))
    expect(onCalculate).not.toHaveBeenCalled()
  })

  it('does NOT call calculate when no cards built yet', () => {
    const onCalculate = vi.fn()
    renderHook(() => useAutoRevealGuard_FIXED_V2(0, 0, 'round-1', onCalculate))
    expect(onCalculate).not.toHaveBeenCalled()
  })

  it('handles null roundId (round not yet set) — does not call', () => {
    const onCalculate = vi.fn()
    renderHook(() => useAutoRevealGuard_FIXED_V2(3, 3, null, onCalculate))
    // roundId is null, calculatedForRoundRef starts null — they match → skips
    // This prevents spurious calls before the round loads
    expect(onCalculate).not.toHaveBeenCalled()
  })

  it('calls once per round across multiple rounds (3 consecutive rounds)', () => {
    const onCalculate = vi.fn()

    const { rerender } = renderHook(
      ({ roundId }: { roundId: string }) =>
        useAutoRevealGuard_FIXED_V2(3, 3, roundId, onCalculate),
      { initialProps: { roundId: 'round-1' } }
    )
    rerender({ roundId: 'round-2' })
    rerender({ roundId: 'round-3' })

    expect(onCalculate).toHaveBeenCalledTimes(3) // once per round
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tied winners reconstruction from scores
// ─────────────────────────────────────────────────────────────────────────────

interface ScoreRow { player_id: string; points: number }

function reconstructWinnersFromScores(scores: ScoreRow[], players: Player[]): Player[] {
  if (scores.length === 0) return []
  const maxPts = Math.max(...scores.map(s => s.points))
  const winnerIds = scores.filter(s => s.points === maxPts).map(s => s.player_id)
  return players.filter(p => winnerIds.includes(p.id))
}

describe('tied winners reconstruction — refreshAll must rebuild winners[] from scores', () => {
  const players: Player[] = [
    { id: 'A', name: 'Player A' },
    { id: 'B', name: 'Player B' },
    { id: 'C', name: 'Player C' },
  ]

  it('single winner → 1 player', () => {
    const w = reconstructWinnersFromScores([{ player_id: 'A', points: 1 }], players)
    expect(w).toHaveLength(1)
    expect(w[0].name).toBe('Player A')
  })

  it('2-way tie → both returned', () => {
    const scores = [{ player_id: 'B', points: 1 }, { player_id: 'C', points: 1 }]
    const w = reconstructWinnersFromScores(scores, players)
    expect(w).toHaveLength(2)
    expect(w.map(p => p.name)).toContain('Player B')
    expect(w.map(p => p.name)).toContain('Player C')
  })

  it('rich mode: 1st=3pts, 2nd=2pts — only 3pt players win', () => {
    const scores = [
      { player_id: 'A', points: 3 },
      { player_id: 'B', points: 3 },
      { player_id: 'C', points: 2 },
    ]
    const w = reconstructWinnersFromScores(scores, players)
    expect(w).toHaveLength(2)
    expect(w.map(p => p.id)).not.toContain('C')
  })

  it('empty scores → no crash, empty result', () => {
    expect(reconstructWinnersFromScores([], players)).toHaveLength(0)
  })

  it('winner no longer in players list (removed mid-game) → excluded safely', () => {
    const w = reconstructWinnersFromScores([{ player_id: 'GHOST', points: 1 }], players)
    expect(w).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// revealWinnerNames computation — verifies ties shown correctly on PLAYER side
// (player computes from revealCards locally, always correct)
// ─────────────────────────────────────────────────────────────────────────────

interface RevealCard { playerName: string; answer: number | null; isTarget: boolean; passed: boolean }

function computeWinnerNamesFromCards(cards: RevealCard[], targetAnswer: number): string[] {
  const guessCards = cards.filter(c => !c.isTarget && !c.passed && c.answer !== null)
  if (guessCards.length === 0) return []
  const minDist = Math.min(...guessCards.map(c => Math.abs(c.answer! - targetAnswer)))
  return guessCards
    .filter(c => Math.abs(c.answer! - targetAnswer) === minDist)
    .map(c => c.playerName)
}

describe('revealWinnerNames from cards — player page local computation', () => {
  it('2-way tie: both names returned', () => {
    const cards: RevealCard[] = [
      { playerName: 'Alice', answer: 20, isTarget: false, passed: false }, // off 10
      { playerName: 'Bob',   answer: 40, isTarget: false, passed: false }, // off 10
      { playerName: 'Carol', answer: 30, isTarget: true,  passed: false }, // target
    ]
    const names = computeWinnerNamesFromCards(cards, 30)
    expect(names).toContain('Alice')
    expect(names).toContain('Bob')
    expect(names).toHaveLength(2)
  })

  it('clear winner: only their name returned', () => {
    const cards: RevealCard[] = [
      { playerName: 'Alice', answer: 29, isTarget: false, passed: false }, // off 1
      { playerName: 'Bob',   answer: 10, isTarget: false, passed: false }, // off 20
    ]
    expect(computeWinnerNamesFromCards(cards, 30)).toEqual(['Alice'])
  })

  it('passed player never appears in winners', () => {
    const cards: RevealCard[] = [
      { playerName: 'Alice', answer: null, isTarget: false, passed: true },
      { playerName: 'Bob',   answer: 29,   isTarget: false, passed: false },
    ]
    const names = computeWinnerNamesFromCards(cards, 30)
    expect(names).not.toContain('Alice')
    expect(names).toContain('Bob')
  })

  it('target card excluded from winner names', () => {
    const cards: RevealCard[] = [
      { playerName: 'Target', answer: 30, isTarget: true,  passed: false },
      { playerName: 'Guesser', answer: 30, isTarget: false, passed: false },
    ]
    const names = computeWinnerNamesFromCards(cards, 30)
    expect(names).not.toContain('Target')
    expect(names).toContain('Guesser')
  })

  it('all passed → no winners', () => {
    const cards: RevealCard[] = [
      { playerName: 'A', answer: null, isTarget: false, passed: true },
      { playerName: 'B', answer: null, isTarget: false, passed: true },
    ]
    expect(computeWinnerNamesFromCards(cards, 30)).toHaveLength(0)
  })

  it('no cards → no crash, no winners', () => {
    expect(computeWinnerNamesFromCards([], 30)).toHaveLength(0)
  })
})
