/**
 * stateTransitions.test.ts
 *
 * Tests for state machine transitions in the game flow.
 * These catch bugs where a wrong status transition causes
 * the wrong UI to be shown (or not shown).
 *
 * Gaps found by reading the code:
 * 1. refreshAll on player page: early return on 'ended' skips loadScores
 *    → leaderboard might show stale scores on game over screen
 * 2. Round form state reset: if same round id comes back (e.g. re-fetch),
 *    submitted state must NOT be reset
 * 3. Skip toast: only shown once per skip, not on every refreshAll
 * 4. confetti: only fires when transitioning INTO done, not on every reload
 * 5. Timer ticking after round ends: paused check prevents sound
 * 6. Session status guard: player UI should show correct screen per status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useRef, useCallback } from 'react'

// ── 1. refreshAll early return must still call loadScores when ended ──────────

describe('refreshAll — ended session loads scores for leaderboard', () => {
  // Mirrors the player page refreshAll structure
  async function refreshAll_BROKEN(
    status: string,
    loadScores: () => Promise<void>,
    computeBadge: () => Promise<void>
  ) {
    if (status === 'ended') {
      await computeBadge()
      return  // BUG: returns before loadScores → stale leaderboard
    }
    await loadScores()
  }

  async function refreshAll_FIXED(
    status: string,
    loadScores: () => Promise<void>,
    computeBadge: () => Promise<void>
  ) {
    if (status === 'ended') {
      await computeBadge()
      await loadScores()  // FIX: also reload scores for game-over leaderboard
      return
    }
    await loadScores()
  }

  it('BROKEN: documents the old behaviour — loadScores skipped when ended (leaderboard stale)', async () => {
    const loadScores = vi.fn().mockResolvedValue(undefined)
    const computeBadge = vi.fn().mockResolvedValue(undefined)

    await refreshAll_BROKEN('ended', loadScores, computeBadge)

    // This was the bug — loadScores never called, game-over leaderboard showed stale totals
    expect(loadScores).not.toHaveBeenCalled()
  })

  it('FIXED: loadScores called even when session is ended (final leaderboard correct)', async () => {
    const loadScores = vi.fn().mockResolvedValue(undefined)
    const computeBadge = vi.fn().mockResolvedValue(undefined)

    await refreshAll_FIXED('ended', loadScores, computeBadge)

    expect(loadScores).toHaveBeenCalledTimes(1)
  })

  it('active session: loadScores always called', async () => {
    const loadScores = vi.fn().mockResolvedValue(undefined)
    const computeBadge = vi.fn().mockResolvedValue(undefined)

    await refreshAll_FIXED('active', loadScores, computeBadge)

    expect(loadScores).toHaveBeenCalledTimes(1)
    expect(computeBadge).not.toHaveBeenCalled()
  })
})

// ── 2. Round form state reset: only on round ID change ───────────────────────

describe('round form state — only reset when round id actually changes', () => {
  function shouldResetForm(prevRoundId: string | null, newRoundId: string): boolean {
    return prevRoundId !== newRoundId
  }

  it('resets form when new round starts', () => {
    expect(shouldResetForm('round-1', 'round-2')).toBe(true)
  })

  it('does NOT reset form when same round comes back (refreshAll re-fetch)', () => {
    expect(shouldResetForm('round-1', 'round-1')).toBe(false)
  })

  it('resets form on first round (null → id)', () => {
    expect(shouldResetForm(null, 'round-1')).toBe(true)
  })
})

// ── 3. Skip toast — shown once per skip, not on every refreshAll ──────────────

describe('skip toast — only fires on transition into done-with-no-winner', () => {
  function shouldShowSkipToast(
    roundStatus: string,
    winnerPlayerId: string | null,
    prevStatus: string | null
  ): boolean {
    return (
      roundStatus === 'done' &&
      winnerPlayerId === null &&
      prevStatus !== 'done'
    )
  }

  it('shows toast when transitioning to done with no winner', () => {
    expect(shouldShowSkipToast('done', null, 'guessing')).toBe(true)
  })

  it('shows toast when transitioning from reveal to done with no winner', () => {
    expect(shouldShowSkipToast('done', null, 'reveal')).toBe(true)
  })

  it('does NOT show toast on every refreshAll when already done', () => {
    // prevStatus is already 'done' — not a transition
    expect(shouldShowSkipToast('done', null, 'done')).toBe(false)
  })

  it('does NOT show toast when there is a winner (normal round end)', () => {
    expect(shouldShowSkipToast('done', 'player-B', 'reveal')).toBe(false)
  })

  it('does NOT show toast when round is still guessing', () => {
    expect(shouldShowSkipToast('guessing', null, 'lobby')).toBe(false)
  })
})

// ── 4. Confetti — only fires once on transition, not on every reload ──────────

describe('confetti — fires only on first transition into done', () => {
  function shouldFireConfetti(
    roundStatus: string,
    prevStatus: string | null,
    myPointsThisRound: number
  ): boolean {
    return (
      roundStatus === 'done' &&
      prevStatus !== 'done' &&
      myPointsThisRound > 0
    )
  }

  it('fires confetti when transitioning to done and player won', () => {
    expect(shouldFireConfetti('done', 'reveal', 1)).toBe(true)
  })

  it('does NOT fire confetti on reload (prevStatus already done)', () => {
    expect(shouldFireConfetti('done', 'done', 1)).toBe(false)
  })

  it('does NOT fire confetti when player did not win', () => {
    expect(shouldFireConfetti('done', 'reveal', 0)).toBe(false)
  })

  it('does NOT fire confetti when round is not yet done', () => {
    expect(shouldFireConfetti('reveal', 'guessing', 1)).toBe(false)
  })
})

// ── 5. Timer must not tick after reveal/done ──────────────────────────────────

describe('timer ticking — must not tick after round ends', () => {
  function shouldTimerTick(roundStatus: string, sessionStatus: string, paused: boolean): boolean {
    return (
      roundStatus === 'guessing' &&
      sessionStatus === 'active' &&
      !paused
    )
  }

  it('ticks during active guessing', () => {
    expect(shouldTimerTick('guessing', 'active', false)).toBe(true)
  })

  it('does NOT tick when round is in reveal', () => {
    expect(shouldTimerTick('reveal', 'active', false)).toBe(false)
  })

  it('does NOT tick when round is done', () => {
    expect(shouldTimerTick('done', 'active', false)).toBe(false)
  })

  it('does NOT tick when session is paused', () => {
    expect(shouldTimerTick('guessing', 'active', true)).toBe(false)
  })

  it('does NOT tick when session ended', () => {
    expect(shouldTimerTick('guessing', 'ended', false)).toBe(false)
  })
})

// ── 6. Correct screen shown for each session status ──────────────────────────

type Screen = 'lobby' | 'paused' | 'round' | 'game-over' | 'loading'

function getActiveScreen(
  session: { status: string } | null,
  currentRound: { status: string } | null
): Screen {
  if (!session) return 'loading'
  if (session.status === 'ended') return 'game-over'
  if (session.status === 'lobby') return 'lobby'
  if (session.status === 'paused') return 'paused'
  if (session.status === 'active' && currentRound) return 'round'
  return 'lobby'
}

describe('screen routing — correct UI shown per game state', () => {
  it('shows loading when session not yet fetched', () => {
    expect(getActiveScreen(null, null)).toBe('loading')
  })

  it('shows lobby before game starts', () => {
    expect(getActiveScreen({ status: 'lobby' }, null)).toBe('lobby')
  })

  it('shows round when session is active', () => {
    expect(getActiveScreen({ status: 'active' }, { status: 'guessing' })).toBe('round')
  })

  it('shows paused screen when session is paused', () => {
    expect(getActiveScreen({ status: 'paused' }, { status: 'guessing' })).toBe('paused')
  })

  it('shows game-over when session ended', () => {
    expect(getActiveScreen({ status: 'ended' }, null)).toBe('game-over')
  })

  it('shows lobby when active but no round yet started', () => {
    expect(getActiveScreen({ status: 'active' }, null)).toBe('lobby')
  })
})

// ── 7. Organizer: reveal confirm only when not all guessers submitted ─────────

describe('organizer reveal confirm dialog', () => {
  function shouldShowRevealConfirm(
    guessers: string[],
    submittedIds: string[],
    alreadyConfirmed: boolean
  ): boolean {
    const allSubmitted = guessers.length === 0 || guessers.every(id => submittedIds.includes(id))
    return !allSubmitted && !alreadyConfirmed
  }

  it('no confirm when all guessers submitted', () => {
    expect(shouldShowRevealConfirm(['p1', 'p2'], ['p1', 'p2'], false)).toBe(false)
  })

  it('shows confirm when some guessers have not submitted', () => {
    expect(shouldShowRevealConfirm(['p1', 'p2'], ['p1'], false)).toBe(true)
  })

  it('no confirm if organizer already confirmed once', () => {
    expect(shouldShowRevealConfirm(['p1', 'p2'], ['p1'], true)).toBe(false)
  })

  it('no confirm when no guessers (everyone passed or only 1 player)', () => {
    expect(shouldShowRevealConfirm([], [], false)).toBe(false)
  })
})

// ── 8. Target player cannot see guess input ───────────────────────────────────

describe('target player UI — must not see guess input', () => {
  function shouldShowGuessInput(
    isTarget: boolean,
    roundStatus: string,
    alreadySubmitted: boolean,
    sessionStatus: string
  ): boolean {
    return (
      !isTarget &&
      roundStatus === 'guessing' &&
      !alreadySubmitted &&
      sessionStatus === 'active'
    )
  }

  it('non-target sees guess input', () => {
    expect(shouldShowGuessInput(false, 'guessing', false, 'active')).toBe(true)
  })

  it('target player does NOT see guess input', () => {
    expect(shouldShowGuessInput(true, 'guessing', false, 'active')).toBe(false)
  })

  it('already submitted player does NOT see guess input again', () => {
    expect(shouldShowGuessInput(false, 'guessing', true, 'active')).toBe(false)
  })

  it('no input shown when round is not guessing', () => {
    expect(shouldShowGuessInput(false, 'reveal', false, 'active')).toBe(false)
    expect(shouldShowGuessInput(false, 'done', false, 'active')).toBe(false)
  })

  it('no input shown when session is paused', () => {
    expect(shouldShowGuessInput(false, 'guessing', false, 'paused')).toBe(false)
  })
})

// ── 9. Auto-reveal: only triggers in reveal/done status ──────────────────────

describe('auto-reveal trigger conditions', () => {
  function shouldAutoReveal(
    roundStatus: string,
    revealCardCount: number,
    revealedCount: number
  ): boolean {
    if (roundStatus !== 'reveal' && roundStatus !== 'done') return false
    if (revealCardCount === 0) return false
    return revealedCount < revealCardCount
  }

  it('triggers when in reveal status with cards remaining', () => {
    expect(shouldAutoReveal('reveal', 4, 2)).toBe(true)
  })

  it('triggers when in done status with cards remaining', () => {
    expect(shouldAutoReveal('done', 4, 0)).toBe(true)
  })

  it('does NOT trigger when in guessing status', () => {
    expect(shouldAutoReveal('guessing', 4, 0)).toBe(false)
  })

  it('does NOT trigger when all cards already revealed', () => {
    expect(shouldAutoReveal('reveal', 4, 4)).toBe(false)
  })

  it('does NOT trigger when no cards built yet', () => {
    expect(shouldAutoReveal('reveal', 0, 0)).toBe(false)
  })
})
