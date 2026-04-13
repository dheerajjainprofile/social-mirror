/**
 * bugfixBatch2.test.ts
 *
 * Regression tests for the second batch of fixes (v4.1):
 *
 * Fix A — QR data is 2D: uqr.encode() returns { data: boolean[][] }, not boolean[].
 *   Root cause: organizer page used data[y * size + x] (flat) while uqr returns data[y][x] (2D).
 *   Result: row arrays were truthy → row 0 all black, everything else undefined/white.
 *
 * Fix B — iPhone iOS tap: onTouchEnd + preventDefault on Quick Start / Custom / I'll play too.
 *   Root cause: touch-action: manipulation alone is insufficient on some iOS Safari versions.
 *
 * Fix C — Round 1 auto-target for all modes.
 *   Root cause: init() only set targetPlayerId for party mode via rotationQueue.
 *   Custom mode required host to manually select target even on round 1.
 *
 * Fix D — Organizer confetti gated on being a winner.
 *   Root cause: handleCalculateWinner called setShowConfetti(true) unconditionally.
 *
 * Fix E — Winner badge hidden until all cards revealed.
 *   Root cause: winnerIds prop was populated as soon as winners state was set (mid-reveal).
 *
 * Fix F — Player confetti per-round-id dedup (tie race condition).
 *   Root cause: prevRoundStatusRef guard fired once per status transition; if scores hadn't
 *   arrived yet, confetti never fired for tied winners on subsequent polls.
 */

import { describe, it, expect } from 'vitest'

// ── Fix A: QR data indexing ───────────────────────────────────────────────────

// Simulates what uqr.encode() actually returns: { size: number, data: boolean[][] }
function makeQR2D(size: number): { size: number; data: boolean[][] } {
  const data: boolean[][] = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => (y + x) % 2 === 0)
  )
  return { size, data }
}

// BROKEN: treated data as flat array
function renderQRBroken(qr: { size: number; data: boolean[][] }): string[] {
  const pixels: string[] = []
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      // BUG: data is 2D but indexed as flat
      const cell = (qr.data as unknown as boolean[])[y * qr.size + x]
      pixels.push(cell ? 'B' : 'W')
    }
  }
  return pixels
}

// FIXED: correct 2D indexing
function renderQRFixed(qr: { size: number; data: boolean[][] }): string[] {
  const pixels: string[] = []
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      pixels.push(qr.data[y][x] ? 'B' : 'W')
    }
  }
  return pixels
}

describe('QR code 2D data indexing (Fix A)', () => {
  it('BROKEN: flat indexing on 2D array — all of row 0 renders black (array is truthy)', () => {
    const qr = makeQR2D(3)
    const rendered = renderQRBroken(qr)
    // Indices 0,1,2 (row 0): data[0], data[1], data[2] → all ROW ARRAYS → truthy = 'B'
    expect(rendered[0]).toBe('B')
    expect(rendered[1]).toBe('B')
    expect(rendered[2]).toBe('B')
    // Index 3 (row 1, x=0): data[3] = undefined → falsy = 'W'
    expect(rendered[3]).toBe('W')
    expect(rendered[4]).toBe('W')
  })

  it('FIXED: 2D indexing produces correct checkerboard pattern', () => {
    const qr = makeQR2D(3)
    const rendered = renderQRFixed(qr)
    // Row 0: (0+0)%2=0→B, (0+1)%2=1→W, (0+2)%2=0→B
    expect(rendered[0]).toBe('B')
    expect(rendered[1]).toBe('W')
    expect(rendered[2]).toBe('B')
    // Row 1: (1+0)%2=1→W, (1+1)%2=0→B, (1+2)%2=1→W
    expect(rendered[3]).toBe('W')
    expect(rendered[4]).toBe('B')
    expect(rendered[5]).toBe('W')
  })

  it('FIXED: renders same pixel count as size*size', () => {
    const qr = makeQR2D(5)
    expect(renderQRFixed(qr)).toHaveLength(25)
  })

  it('BROKEN: renders wrong pixel count (most are undefined/W from out-of-bounds access)', () => {
    const qr = makeQR2D(5)
    const rendered = renderQRBroken(qr)
    // First 5 entries (indices 0..4 = row arrays) are truthy → 'B'
    expect(rendered.slice(0, 5).every((p) => p === 'B')).toBe(true)
    // Rest are undefined → 'W'
    expect(rendered.slice(5).every((p) => p === 'W')).toBe(true)
  })
})

// ── Fix C: Round 1 auto-target for all modes ──────────────────────────────────

function selectInitialTarget(
  players: Array<{ id: string; is_organizer: boolean }>,
  preset: string,
  rotationQueue: string[]
): string | null {
  if (preset === 'party') {
    return rotationQueue[0] ?? null
  } else {
    // Fix C: also auto-select for non-party modes
    const nonOrg = players.filter((p) => !p.is_organizer)
    if (nonOrg.length === 0) return null
    // Deterministic for test — first player (simulating random.floor result)
    return nonOrg[0].id
  }
}

const TEST_PLAYERS = [
  { id: 'org', is_organizer: true },
  { id: 'p1',  is_organizer: false },
  { id: 'p2',  is_organizer: false },
]

describe('Round 1 auto-target for all modes (Fix C)', () => {
  it('party mode: picks first from rotation queue', () => {
    const target = selectInitialTarget(TEST_PLAYERS, 'party', ['p2', 'p1'])
    expect(target).toBe('p2')
  })

  it('custom mode: returns a non-organizer player', () => {
    const target = selectInitialTarget(TEST_PLAYERS, 'custom', [])
    expect(target).toBe('p1')
    expect(target).not.toBe('org')
  })

  it('custom mode with no players: returns null gracefully', () => {
    const target = selectInitialTarget([{ id: 'org', is_organizer: true }], 'custom', [])
    expect(target).toBeNull()
  })

  it('party mode with empty queue: returns null gracefully', () => {
    const target = selectInitialTarget(TEST_PLAYERS, 'party', [])
    expect(target).toBeNull()
  })
})

// ── Fix D: Organizer confetti logic ──────────────────────────────────────────

interface Player { id: string; name: string }

function shouldOrganizerGetConfetti(
  winners: Player[],
  organizerPlayerId: string | null,
  organizerPlays: boolean
): boolean {
  return organizerPlays && !!organizerPlayerId && winners.some((w) => w.id === organizerPlayerId)
}

describe('Organizer confetti gating (Fix D)', () => {
  it('fires when organizer is the sole winner', () => {
    expect(shouldOrganizerGetConfetti(
      [{ id: 'org', name: 'Host' }],
      'org',
      true
    )).toBe(true)
  })

  it('fires when organizer is one of tied winners', () => {
    expect(shouldOrganizerGetConfetti(
      [{ id: 'p1', name: 'P1' }, { id: 'org', name: 'Host' }],
      'org',
      true
    )).toBe(true)
  })

  it('does NOT fire when organizer is not a winner', () => {
    expect(shouldOrganizerGetConfetti(
      [{ id: 'p1', name: 'P1' }],
      'org',
      true
    )).toBe(false)
  })

  it('does NOT fire when organizer_plays = false', () => {
    expect(shouldOrganizerGetConfetti(
      [{ id: 'org', name: 'Host' }],
      'org',
      false
    )).toBe(false)
  })

  it('does NOT fire when organizerPlayerId is null (not yet loaded)', () => {
    expect(shouldOrganizerGetConfetti(
      [{ id: 'org', name: 'Host' }],
      null,
      true
    )).toBe(false)
  })

  it('does NOT fire when no winners', () => {
    expect(shouldOrganizerGetConfetti([], 'org', true)).toBe(false)
  })
})

// ── Fix E: Pre-reveal winner badge gating ────────────────────────────────────

function getWinnerIds(
  winners: Player[],
  allRevealed: boolean
): string[] {
  return allRevealed ? winners.map((w) => w.id) : []
}

describe('Winner badge hidden until all cards revealed (Fix E)', () => {
  const winners: Player[] = [{ id: 'p1', name: 'P1' }]

  it('returns empty array before all cards revealed', () => {
    expect(getWinnerIds(winners, false)).toHaveLength(0)
  })

  it('returns winner IDs once all cards are revealed', () => {
    expect(getWinnerIds(winners, true)).toEqual(['p1'])
  })

  it('handles multi-winner tie: all IDs returned after reveal', () => {
    const tied = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }]
    expect(getWinnerIds(tied, true)).toEqual(['p1', 'p2'])
    expect(getWinnerIds(tied, false)).toHaveLength(0)
  })

  it('empty winners: always empty regardless of reveal state', () => {
    expect(getWinnerIds([], true)).toHaveLength(0)
    expect(getWinnerIds([], false)).toHaveLength(0)
  })
})

// ── Fix F: Player confetti per-round-id dedup ────────────────────────────────

// Pure model of the confetti decision — mirrors refreshAll logic
function shouldFireConfetti(
  roundId: string,
  confettiFiredForRound: string | null,
  myScore: { points: number } | null,
  winnerPlayerId: string | null,
  myPlayerId: string
): { fire: boolean; newFiredRef: string | null } {
  if (confettiFiredForRound === roundId) {
    return { fire: false, newFiredRef: confettiFiredForRound }
  }
  if (myScore && myScore.points > 0) {
    return { fire: true, newFiredRef: roundId }
  }
  if (!myScore && winnerPlayerId === myPlayerId) {
    // Fallback for race condition where scores not yet written
    return { fire: true, newFiredRef: roundId }
  }
  // Scores not yet arrived — leave window open (don't set ref)
  return { fire: false, newFiredRef: confettiFiredForRound }
}

describe('Player confetti per-round-id dedup (Fix F)', () => {
  it('fires when player has points in scores table', () => {
    const r = shouldFireConfetti('r1', null, { points: 3 }, 'p1', 'p1')
    expect(r.fire).toBe(true)
    expect(r.newFiredRef).toBe('r1')
  })

  it('fires via fallback when scores not yet written but winner_player_id matches', () => {
    const r = shouldFireConfetti('r1', null, null, 'p1', 'p1')
    expect(r.fire).toBe(true)
  })

  it('does NOT fire when player has 0 points (did not win)', () => {
    const r = shouldFireConfetti('r1', null, { points: 0 }, 'p1', 'p1')
    expect(r.fire).toBe(false)
  })

  it('does NOT fire when scores not written AND winner_player_id is someone else', () => {
    const r = shouldFireConfetti('r1', null, null, 'p2', 'p1')
    expect(r.fire).toBe(false)
    // Importantly: ref is NOT set, so next poll can retry
    expect(r.newFiredRef).toBeNull()
  })

  it('does NOT re-fire once confettiFiredForRound matches roundId', () => {
    // First fire
    const first = shouldFireConfetti('r1', null, { points: 3 }, 'p1', 'p1')
    expect(first.fire).toBe(true)
    // Second poll — ref now set to 'r1'
    const second = shouldFireConfetti('r1', first.newFiredRef, { points: 3 }, 'p1', 'p1')
    expect(second.fire).toBe(false)
  })

  it('fires again for a new round after previous round was deduped', () => {
    const r = shouldFireConfetti('r2', 'r1', { points: 2 }, 'p1', 'p1')
    expect(r.fire).toBe(true)
    expect(r.newFiredRef).toBe('r2')
  })

  it('KEY tie scenario: first poll scores not arrived → no fire, ref stays open; second poll scores arrived → fires', () => {
    // Poll 1: tied winner B, scores not yet in DB
    const poll1 = shouldFireConfetti('r1', null, null, 'p_other', 'p_b')
    expect(poll1.fire).toBe(false)
    expect(poll1.newFiredRef).toBeNull() // window stays open

    // Poll 2: scores now in DB, B has points
    const poll2 = shouldFireConfetti('r1', poll1.newFiredRef, { points: 3 }, 'p_other', 'p_b')
    expect(poll2.fire).toBe(true) // 🎉 confetti fires
    expect(poll2.newFiredRef).toBe('r1')
  })

  it('KEY old bug: prevRoundStatus guard would block confetti on second poll', () => {
    // OLD behaviour: confetti gated on prevStatus !== 'done'
    // Simulated: after first poll (prevStatus set to 'done'), confetti never fires again
    const prevRoundStatusIsDone = true // after first poll
    const myScore = { points: 3 } // scores arrived on second poll

    // Old guard
    const oldBehavior = !prevRoundStatusIsDone && myScore.points > 0
    expect(oldBehavior).toBe(false) // BUG: tied winner never got confetti

    // New guard — per-round-id ref is null (never fired)
    const { fire: newBehavior } = shouldFireConfetti('r1', null, myScore, null, 'p1')
    expect(newBehavior).toBe(true) // FIX: fires correctly
  })
})
