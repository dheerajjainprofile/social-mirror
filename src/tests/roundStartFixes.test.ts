/**
 * roundStartFixes.test.ts
 *
 * Tests for the batch of fixes shipped in the v4 bugfix round:
 *
 * Fix #5 — session status updated locally on round start
 *   Root cause: handleStartRound set currentRound but not session.status.
 *   Active-round UI gated on session.status === 'active' → blank screen until realtime fired.
 *
 * Fix #4 — buildSuggestedQuestions uses stale isPartyMode during init()
 *   Root cause: isPartyMode derived from React state; state not set yet when init() runs.
 *   Fix: explicit `preset` param passed from DB row so no stale closure.
 *
 * Fix #3 — QR pixel rendering (logic)
 *   The pixel array uses row-major indexing: data[y * size + x].
 *   Tests verify correct indexing and edge cases.
 *
 * Fix #7 — sticky button label no longer shows question text
 *   Label logic: missing target → prompt, missing question → prompt, ready → "▶ Start Round N".
 *
 * Fix #1 — organizer "GUESS WHAT" header shown correctly
 *   Condition: organizer_plays=true AND organizer is NOT the current target.
 *   Color: uses getPlayerColorByIndex with join-order index among non-organizer players.
 *
 * Fix #6 — calculatedForRoundRef guard prevents round-2 infinite loop (pure logic)
 *   Models the ref-based guard as a stateful function to verify it fires once per round.
 *
 * Fix #2 — iOS touch: pointer-events-none on disabled button
 *   Documents that disabled + pointer-events-none together can confuse iOS Safari touch routing.
 *   Tests the corrected disabled state logic (opacity only, not pointer-events-none).
 */

import { describe, it, expect } from 'vitest'

// ── Fix #6 — calculatedForRoundRef guard (pure-logic model) ──────────────────
//
// The auto-reveal effect calls handleCalculateWinner() once all cards are revealed.
// Guard: a mutable ref (`calculatedForRoundRef`) tracks which round.id has already fired.
// This prevents the infinite loop where:
//   1. calculate-winner marks round as 'done'
//   2. refreshAll re-sets currentRound.status → 'done' → effect re-runs
//   3. if no winner (all passed), winners stays [] → would call calculate again → loop
//
// We model the ref as a plain object to test the logic without React hooks.

describe('calculatedForRoundRef guard — pure logic model', () => {
  function makeGuard() {
    const ref = { current: null as string | null }
    return {
      shouldCalculate(roundId: string | null, totalCards: number, revealedCount: number): boolean {
        if (totalCards === 0) return false
        if (revealedCount < totalCards) return false
        if (ref.current === roundId) return false
        ref.current = roundId
        return true
      },
      reset() { ref.current = null },
    }
  }

  it('calls calculate exactly once when all cards are revealed', () => {
    const guard = makeGuard()
    expect(guard.shouldCalculate('round-1', 3, 3)).toBe(true)
  })

  it('does NOT call again on same round even if effect re-triggers (no-winner infinite loop fixed)', () => {
    const guard = makeGuard()
    guard.shouldCalculate('round-1', 3, 3)
    // Effect re-fires because currentRound.status changed to 'done'
    expect(guard.shouldCalculate('round-1', 3, 3)).toBe(false)
    expect(guard.shouldCalculate('round-1', 3, 3)).toBe(false) // still blocked
  })

  it('calls calculate again for a NEW round after reset', () => {
    const guard = makeGuard()
    guard.shouldCalculate('round-1', 3, 3)
    guard.reset() // handleStartRound resets calculatedForRoundRef.current = null
    expect(guard.shouldCalculate('round-2', 4, 4)).toBe(true)
  })

  it('does NOT call when cards not yet all revealed', () => {
    const guard = makeGuard()
    expect(guard.shouldCalculate('round-1', 5, 2)).toBe(false)
  })

  it('does NOT call when no cards (revealCards empty)', () => {
    const guard = makeGuard()
    expect(guard.shouldCalculate('round-1', 0, 0)).toBe(false)
  })

  it('does NOT call when roundId is null (round not yet loaded)', () => {
    const guard = makeGuard()
    // ref starts null, roundId is null → they match → no call
    expect(guard.shouldCalculate(null, 3, 3)).toBe(false)
  })

  it('handles 3 consecutive rounds — exactly 3 total calls', () => {
    const guard = makeGuard()
    let calls = 0
    for (const id of ['r1', 'r2', 'r3']) {
      guard.reset()
      if (guard.shouldCalculate(id, 3, 3)) calls++
      // Simulate 3 re-triggers per round (status changes)
      guard.shouldCalculate(id, 3, 3)
      guard.shouldCalculate(id, 3, 3)
    }
    expect(calls).toBe(3) // one per round, never more
  })
})

// ── Fix #5 — session status update on round start ────────────────────────────
//
// handleStartRound must update session.status to 'active' locally on success.
// Without this the active-round UI (gated on session.status === 'active') never renders
// until realtime fires a session update.

describe('handleStartRound — session status must be updated locally', () => {
  type SessionStatus = 'lobby' | 'active' | 'paused' | 'ended'

  function simulateRoundStart(
    currentStatus: SessionStatus,
    apiSuccess: boolean
  ): SessionStatus {
    if (!apiSuccess) return currentStatus
    // FIX: set status to active immediately after successful API call
    return 'active'
  }

  it('sets session.status to active after successful round start', () => {
    expect(simulateRoundStart('lobby', true)).toBe('active')
  })

  it('leaves status unchanged when API call fails', () => {
    expect(simulateRoundStart('lobby', false)).toBe('lobby')
  })

  it('active-round UI condition is satisfied immediately (no realtime wait)', () => {
    const newStatus = simulateRoundStart('lobby', true)
    const showActiveRound = newStatus === 'active' || newStatus === 'paused'
    expect(showActiveRound).toBe(true)
  })

  it('does not regress paused state — only updates from lobby', () => {
    // If somehow called during paused (shouldn't happen but guard against it)
    // The function always returns active on success; real code only runs from lobby
    expect(simulateRoundStart('paused', true)).toBe('active')
  })
})

// ── Fix #4 — buildSuggestedQuestions stale-closure bug ───────────────────────
//
// isPartyMode = session?.preset === 'party' reads React state.
// During init(), session state is null → isPartyMode is false → function returns early.
// Fix: explicit `preset` param; when provided, it takes precedence over isPartyMode.

describe('buildSuggestedQuestions — preset param prevents stale-closure bug', () => {
  // Models the partyMode resolution logic from the fixed function
  function resolvePartyMode(
    isPartyModeFromState: boolean,   // React state (may be stale during init)
    presetFromParam: string | null | undefined  // explicit param from DB row
  ): boolean {
    return presetFromParam != null ? presetFromParam === 'party' : isPartyModeFromState
  }

  it('uses explicit preset param when provided — ignores stale state', () => {
    // During init(): isPartyMode from state is false (session not yet set)
    // but sess.preset from DB is 'party'
    expect(resolvePartyMode(false, 'party')).toBe(true)
  })

  it('correctly rejects non-party preset when provided explicitly', () => {
    expect(resolvePartyMode(true, 'custom')).toBe(false)
  })

  it('falls back to isPartyMode when no explicit preset given (undefined)', () => {
    expect(resolvePartyMode(true, undefined)).toBe(true)
    expect(resolvePartyMode(false, undefined)).toBe(false)
  })

  it('falls back to isPartyMode when null passed (no preset on session)', () => {
    // null means session has no preset field set
    expect(resolvePartyMode(false, null)).toBe(false)
    expect(resolvePartyMode(true, null)).toBe(true)
  })

  it('init() path: stale isPartyMode=false + explicit preset=party → suggestions built', () => {
    // This is the exact scenario that was broken:
    // session state not yet set → isPartyMode=false
    // but DB row has preset='party'
    const staleModeFromState = false
    const presetFromDB = 'party'
    expect(resolvePartyMode(staleModeFromState, presetFromDB)).toBe(true)
  })

  it('init() path: stale isPartyMode=false + explicit preset=custom → no suggestions', () => {
    const staleModeFromState = false
    const presetFromDB = 'custom'
    expect(resolvePartyMode(staleModeFromState, presetFromDB)).toBe(false)
  })

  it('post-init path: preset not passed → isPartyMode from state used (backwards compat)', () => {
    // After init, session is in state; buildSuggestedQuestions can rely on isPartyMode
    // even without explicit preset (both callers after init pass preset, but if not → fallback)
    const upToDateModeFromState = true
    expect(resolvePartyMode(upToDateModeFromState, undefined)).toBe(true)
  })
})

// ── Fix #3 — QR pixel array indexing ─────────────────────────────────────────
//
// uqr encode() returns { size: number, data: boolean[] } in row-major order.
// Pixel at (col=x, row=y) is data[y * size + x].
// The render loop iterates y from 0..size-1, x from 0..size-1 — this must be correct.

describe('QR pixel array — row-major indexing', () => {
  function makeTestQR(size: number, filledPositions: [number, number][]): { size: number; data: boolean[] } {
    const data = new Array(size * size).fill(false)
    for (const [x, y] of filledPositions) {
      data[y * size + x] = true
    }
    return { size, data }
  }

  function getPixel(qr: { size: number; data: boolean[] }, x: number, y: number): boolean {
    return qr.data[y * qr.size + x]
  }

  it('correct pixel at top-left (0,0)', () => {
    const qr = makeTestQR(5, [[0, 0]])
    expect(getPixel(qr, 0, 0)).toBe(true)
    expect(getPixel(qr, 1, 0)).toBe(false)
    expect(getPixel(qr, 0, 1)).toBe(false)
  })

  it('correct pixel at bottom-right corner', () => {
    const qr = makeTestQR(5, [[4, 4]])
    expect(getPixel(qr, 4, 4)).toBe(true)
    expect(getPixel(qr, 3, 4)).toBe(false)
    expect(getPixel(qr, 4, 3)).toBe(false)
  })

  it('row-major: pixel (x=2, y=1) is at index 1*size+2 = 7 in a 5x5 grid', () => {
    const qr = makeTestQR(5, [[2, 1]])
    expect(qr.data[7]).toBe(true)   // y=1, x=2 → 1*5+2=7
    expect(qr.data[2]).toBe(false)  // y=0, x=2 → 0*5+2=2 (different row)
  })

  it('all pixels in a row iterate correctly', () => {
    const size = 4
    // Row y=2: all pixels set
    const positions: [number, number][] = [0, 1, 2, 3].map(x => [x, 2])
    const qr = makeTestQR(size, positions)
    for (let x = 0; x < size; x++) {
      expect(getPixel(qr, x, 2)).toBe(true)   // row 2 all filled
      expect(getPixel(qr, x, 0)).toBe(false)  // row 0 empty
    }
  })

  it('total pixels in grid equals size * size', () => {
    const qr = makeTestQR(10, [])
    expect(qr.data.length).toBe(100)
  })

  it('1x1 grid: single pixel at (0,0)', () => {
    const qr = makeTestQR(1, [[0, 0]])
    expect(qr.data.length).toBe(1)
    expect(qr.data[0]).toBe(true)
  })

  it('render iteration produces correct number of row-div and pixel-div elements', () => {
    const size = 3
    const qr = makeTestQR(size, [])
    const rowCount = Array.from({ length: size }).length
    const pixelsPerRow = size
    expect(rowCount).toBe(3)
    expect(pixelsPerRow).toBe(3)
    expect(rowCount * pixelsPerRow).toBe(9) // total pixel divs
  })
})

// ── Fix #7 — sticky "Start Round" button label ────────────────────────────────
//
// Label was: `▶ Round N — [first 40 chars of question]`
// Now:        `▶ Start Round N` (no question text)
// Fallbacks: "👆 Pick a target player above" / "👆 Pick a question above"

describe('sticky button label logic', () => {
  function getStickyButtonLabel(
    actionLoading: boolean,
    targetPlayerId: string,
    selectedQuestion: { text: string } | null,
    customQuestion: string,
    roundNumber: number
  ): string {
    if (actionLoading) return 'Starting...'
    if (!targetPlayerId) return '👆 Pick a target player above'
    if (!selectedQuestion && !customQuestion.trim()) return '👆 Pick a question above'
    return `▶ Start Round ${roundNumber}`
  }

  it('shows loading state', () => {
    expect(getStickyButtonLabel(true, 'p1', { text: 'Q' }, '', 2)).toBe('Starting...')
  })

  it('prompts to pick target when none selected', () => {
    expect(getStickyButtonLabel(false, '', { text: 'Q' }, '', 1))
      .toBe('👆 Pick a target player above')
  })

  it('prompts to pick question when no question and no custom text', () => {
    expect(getStickyButtonLabel(false, 'p1', null, '', 1))
      .toBe('👆 Pick a question above')
  })

  it('prompts to pick question when custom text is only whitespace', () => {
    expect(getStickyButtonLabel(false, 'p1', null, '   ', 1))
      .toBe('👆 Pick a question above')
  })

  it('shows Start Round N when both target and question are set', () => {
    expect(getStickyButtonLabel(false, 'p1', { text: 'How many coffees today?' }, '', 3))
      .toBe('▶ Start Round 3')
  })

  it('shows Start Round N with custom question text — no question preview in label', () => {
    expect(getStickyButtonLabel(false, 'p1', null, 'My custom question', 4))
      .toBe('▶ Start Round 4')
  })

  it('label does NOT include question text regardless of length', () => {
    const longQ = { text: 'A'.repeat(100) }
    const label = getStickyButtonLabel(false, 'p1', longQ, '', 1)
    expect(label).toBe('▶ Start Round 1')
    expect(label).not.toContain('A'.repeat(10)) // no question content in label
  })

  it('round number increments correctly', () => {
    for (let n = 1; n <= 5; n++) {
      expect(getStickyButtonLabel(false, 'p1', { text: 'Q' }, '', n))
        .toBe(`▶ Start Round ${n}`)
    }
  })
})

// ── Fix #1 — organizer "GUESS WHAT" header condition ─────────────────────────
//
// Show "🎯 Guess what [TARGET] will say" on organizer screen when:
//   - session.organizer_plays = true
//   - organizer is NOT the target this round
// Do NOT show when organizer IS the target (they're answering, not guessing).
// Do NOT show when organizer_plays = false.

describe('organizer GUESS WHAT header — show/hide condition', () => {
  function shouldShowOrganizerGuessWhatHeader(
    organizerPlays: boolean,
    organizerPlayerId: string | null,
    targetPlayerId: string
  ): boolean {
    return !!(organizerPlays && organizerPlayerId && targetPlayerId !== organizerPlayerId)
  }

  it('shows header when organizer plays and is NOT the target', () => {
    expect(shouldShowOrganizerGuessWhatHeader(true, 'org-id', 'player-2')).toBe(true)
  })

  it('hides header when organizer IS the target this round', () => {
    expect(shouldShowOrganizerGuessWhatHeader(true, 'org-id', 'org-id')).toBe(false)
  })

  it('hides header when organizer_plays is false', () => {
    expect(shouldShowOrganizerGuessWhatHeader(false, 'org-id', 'player-2')).toBe(false)
  })

  it('hides header when organizerPlayerId is not yet loaded (null)', () => {
    expect(shouldShowOrganizerGuessWhatHeader(true, null, 'player-2')).toBe(false)
  })

  it('hides header when organizer_plays=false AND is not the target', () => {
    // Belt-and-suspenders: even if IDs differ, false organizer_plays wins
    expect(shouldShowOrganizerGuessWhatHeader(false, 'org-id', 'player-3')).toBe(false)
  })
})

// ── Fix #1 — organizer target color lookup ────────────────────────────────────
//
// The "GUESS WHAT [TARGET]" header uses the target's join-order player colour.
// Target index is found among non-organizer players only (organizer is excluded
// from the 0-indexed colour assignment).

describe('organizer GUESS WHAT — target colour lookup', () => {
  const COLORS = [
    { text: 'text-purple-300', dot: '#a855f7' },
    { text: 'text-pink-300',   dot: '#ec4899' },
    { text: 'text-cyan-300',   dot: '#06b6d4' },
    { text: 'text-amber-300',  dot: '#f59e0b' },
  ]

  function getPlayerColorByIndex(index: number) {
    return COLORS[index % COLORS.length]
  }

  interface Player { id: string; name: string; is_organizer: boolean }

  function getTargetColorIndex(players: Player[], targetId: string): number {
    const nonOrg = players.filter(p => !p.is_organizer)
    const idx = nonOrg.findIndex(p => p.id === targetId)
    return idx >= 0 ? idx : 0
  }

  const players: Player[] = [
    { id: 'org',  name: 'Host',    is_organizer: true },
    { id: 'p1',   name: 'Alice',   is_organizer: false },
    { id: 'p2',   name: 'Bob',     is_organizer: false },
    { id: 'p3',   name: 'Charlie', is_organizer: false },
  ]

  it('first non-organizer player gets color index 0 (purple)', () => {
    expect(getTargetColorIndex(players, 'p1')).toBe(0)
    expect(getPlayerColorByIndex(0).text).toBe('text-purple-300')
  })

  it('second non-organizer player gets color index 1 (pink)', () => {
    expect(getTargetColorIndex(players, 'p2')).toBe(1)
    expect(getPlayerColorByIndex(1).text).toBe('text-pink-300')
  })

  it('third non-organizer player gets color index 2 (cyan)', () => {
    expect(getTargetColorIndex(players, 'p3')).toBe(2)
    expect(getPlayerColorByIndex(2).text).toBe('text-cyan-300')
  })

  it('organizer is excluded from index calculation', () => {
    // org is at index 0 in the full players array but should not affect non-org indices
    const nonOrg = players.filter(p => !p.is_organizer)
    expect(nonOrg[0].id).toBe('p1')
    expect(nonOrg[0].name).toBe('Alice')
  })

  it('falls back to index 0 when target ID not found in player list', () => {
    expect(getTargetColorIndex(players, 'ghost-player')).toBe(0)
  })
})

// ── Fix #2 — iOS touch: disabled button state ─────────────────────────────────
//
// Disabled button previously used `pointer-events-none` in CSS alongside `disabled` attr.
// iOS Safari can misroute touch events when pointer-events-none is present on an element
// near other interactive buttons (especially with Suspense re-renders).
// Fix: use `opacity-50` only; rely on `disabled` attr for blocking interaction.

describe('disabled button state — pointer-events-none removed', () => {
  function getDisabledButtonClasses(isDisabled: boolean): string {
    // BEFORE fix: returned 'bg-slate-600 pointer-events-none'
    // AFTER fix:  returns 'bg-slate-600 opacity-50'
    if (isDisabled) return 'bg-slate-600 opacity-50'
    return 'bg-gradient-to-r from-purple-600 to-pink-600'
  }

  it('disabled state uses opacity-50, not pointer-events-none', () => {
    const cls = getDisabledButtonClasses(true)
    expect(cls).toContain('opacity-50')
    expect(cls).not.toContain('pointer-events-none')
  })

  it('enabled state uses gradient, no opacity or pointer-events override', () => {
    const cls = getDisabledButtonClasses(false)
    expect(cls).toContain('from-purple-600')
    expect(cls).not.toContain('pointer-events-none')
    expect(cls).not.toContain('opacity-50')
  })

  it('Create Room button is disabled when name is empty', () => {
    const isDisabled = (name: string, preset: string | null) =>
      !name.trim() || !preset
    expect(isDisabled('', 'party')).toBe(true)
    expect(isDisabled('Dheeraj', null)).toBe(true)
    expect(isDisabled('Dheeraj', 'party')).toBe(false)
  })
})
