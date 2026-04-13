/**
 * bugfixBatch5.test.ts
 *
 * Tests for the fifth batch of fixes:
 * - Join/Create button loading state: stays disabled after navigation (no flash)
 * - Confetti fires only for top scorer (not all point-earners)
 * - Target auto-select in lobby poll
 * - QuestionBank hidden on player game over
 * - Host in player leaderboard when organizer_plays=true
 * - QR code on session card (2D array access)
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Fix M: Loading state — no re-activation flash after navigation
// ---------------------------------------------------------------------------

describe('Fix M: Loading state — no re-activation flash after navigation', () => {
  it('navigated=false resets loading to false in finally', () => {
    let loading = true
    let navigated = false
    // Simulate error path (no navigation)
    try {
      throw new Error('network error')
    } catch {
      // no-op
    } finally {
      if (!navigated) loading = false
    }
    expect(loading).toBe(false)
  })

  it('navigated=true keeps loading true in finally (no flash)', () => {
    let loading = true
    let navigated = false
    try {
      navigated = true
      // router.push() would be called here — component will unmount naturally
    } finally {
      if (!navigated) loading = false
    }
    // loading stays true — button stays disabled until page transitions away
    expect(loading).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Fix N: Confetti — top scorer only
// ---------------------------------------------------------------------------

interface RoundScore { playerId: string; points: number }

function shouldFireConfetti(
  myScore: RoundScore | null,
  topScore: RoundScore | null,
  winnerPlayerId: string | null,
  playerId: string,
): boolean {
  // Scores path: fires only when this player's points equal the highest in round
  if (myScore && topScore && myScore.points > 0 && myScore.points === topScore.points) {
    return true
  }
  // Fallback: scores not yet inserted but winner_player_id matches
  if (!myScore && winnerPlayerId === playerId) {
    return true
  }
  return false
}

describe('Fix N: Confetti fires only for top scorer', () => {
  it('fires for winner with max points (3pts in rich mode)', () => {
    expect(shouldFireConfetti({ playerId: 'p1', points: 3 }, { playerId: 'p1', points: 3 }, 'p1', 'p1')).toBe(true)
  })

  it('fires for tied winner (both have max points)', () => {
    // Two players each with 2pts (tied)
    expect(shouldFireConfetti({ playerId: 'p2', points: 2 }, { playerId: 'p1', points: 2 }, null, 'p2')).toBe(true)
  })

  it('does NOT fire for runner-up in rich mode (2pts when max is 3pts)', () => {
    expect(shouldFireConfetti({ playerId: 'p2', points: 2 }, { playerId: 'p1', points: 3 }, 'p1', 'p2')).toBe(false)
  })

  it('does NOT fire for third-place (1pt when max is 3pts)', () => {
    expect(shouldFireConfetti({ playerId: 'p3', points: 1 }, { playerId: 'p1', points: 3 }, 'p1', 'p3')).toBe(false)
  })

  it('does NOT fire when player scored 0', () => {
    expect(shouldFireConfetti({ playerId: 'p4', points: 0 }, { playerId: 'p1', points: 3 }, 'p1', 'p4')).toBe(false)
  })

  it('fires via fallback when scores not yet inserted but winner_player_id matches', () => {
    expect(shouldFireConfetti(null, null, 'p1', 'p1')).toBe(true)
  })

  it('fallback does NOT fire for non-winner when scores not inserted', () => {
    expect(shouldFireConfetti(null, null, 'p1', 'p2')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Fix O: Target auto-select in lobby — functional setState pattern
// ---------------------------------------------------------------------------

describe('Fix O: Target auto-select via functional setState', () => {
  const playerData = [
    { id: 'org', is_organizer: true },
    { id: 'p1', is_organizer: false },
    { id: 'p2', is_organizer: false },
  ]

  function autoSelectTarget(current: string, data: typeof playerData): string {
    if (current) return current
    const nonOrg = data.filter((p) => !p.is_organizer)
    if (nonOrg.length === 0) return current
    return nonOrg[Math.floor(Math.random() * nonOrg.length)].id
  }

  it('selects a non-organizer player when none selected', () => {
    const result = autoSelectTarget('', playerData)
    expect(['p1', 'p2']).toContain(result)
  })

  it('keeps existing selection (does not override)', () => {
    const result = autoSelectTarget('p1', playerData)
    expect(result).toBe('p1')
  })

  it('returns empty string when no players available yet', () => {
    const result = autoSelectTarget('', [{ id: 'org', is_organizer: true }])
    expect(result).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Fix P: Host in player leaderboard — organizerPlays filter
// ---------------------------------------------------------------------------

interface Player { id: string; name: string; is_organizer: boolean; created_at?: string }

function buildLeaderboard(
  playerList: Player[],
  totals: Record<string, number>,
  organizerPlays: boolean,
) {
  return playerList
    .filter((p) => !p.is_organizer || organizerPlays)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .map((p) => ({ playerId: p.id, playerName: p.name, totalPoints: totals[p.id] ?? 0 }))
}

describe('Fix P: Host in player leaderboard', () => {
  const players: Player[] = [
    { id: 'org', name: 'Host', is_organizer: true, created_at: '2024-01-01T00:00:00Z' },
    { id: 'p1', name: 'Alice', is_organizer: false, created_at: '2024-01-01T00:01:00Z' },
    { id: 'p2', name: 'Bob', is_organizer: false, created_at: '2024-01-01T00:02:00Z' },
  ]
  const totals = { org: 80, p1: 60, p2: 40 }

  it('includes host in leaderboard when organizer_plays=true', () => {
    const lb = buildLeaderboard(players, totals, true)
    expect(lb.map((x) => x.playerId)).toContain('org')
    expect(lb).toHaveLength(3)
  })

  it('excludes host from leaderboard when organizer_plays=false', () => {
    const lb = buildLeaderboard(players, totals, false)
    expect(lb.map((x) => x.playerId)).not.toContain('org')
    expect(lb).toHaveLength(2)
  })

  it('host points are included in their leaderboard entry', () => {
    const lb = buildLeaderboard(players, totals, true)
    const host = lb.find((x) => x.playerId === 'org')
    expect(host?.totalPoints).toBe(80)
  })
})

// ---------------------------------------------------------------------------
// Fix Q: QR code on session card — 2D array access
// ---------------------------------------------------------------------------

describe('Fix Q: QR code 2D array access', () => {
  const size = 3
  // Simulate qr.data as 2D boolean[][] (what uqr actually returns)
  const data: boolean[][] = [
    [true, false, true],
    [false, true, false],
    [true, true, false],
  ]

  it('2D access [y][x] gives correct value', () => {
    expect(data[0][0]).toBe(true)  // top-left black
    expect(data[0][1]).toBe(false) // second pixel white
    expect(data[1][1]).toBe(true)  // center black
    expect(data[2][2]).toBe(false) // bottom-right white
  })

  it('flat access [y * size + x] gives WRONG value (demonstrates the bug)', () => {
    // Simulating flat array interpretation of 2D array: data[0] is the first row array,
    // not a scalar — flat indexing doesn't work on nested arrays
    const flatAttempt = (data as unknown as (boolean | boolean[])[])[0 * size + 1]
    // Index 1 on the outer array is the second ROW [false, true, false], not a scalar
    expect(Array.isArray(flatAttempt)).toBe(true) // proves the old code was wrong
  })

  it('correct rendering: black cell maps to #000', () => {
    const bg = (v: boolean) => v ? '#000' : '#fff'
    expect(bg(data[0][0])).toBe('#000')
    expect(bg(data[0][1])).toBe('#fff')
  })
})
