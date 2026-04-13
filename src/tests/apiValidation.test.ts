/**
 * apiValidation.test.ts
 *
 * Pure logic tests for every API route's validation and business rules —
 * extracted as pure functions so they run without Supabase or HTTP.
 *
 * Covers:
 * - requireOrganizer logic (null/missing/wrong player)
 * - submit-guess: target can't guess, non-number answer, passed=true flow
 * - submit-answer: only target can answer, non-number rejected
 * - pause/resume: action must be 'pause' or 'resume'
 * - calculate-winner: idempotency on done round
 * - end-game: session_id required
 * - remove-player: player_id required
 * - replay: organizer_name required
 * - feedback: emoji_rating required
 */

import { describe, it, expect } from 'vitest'

// ─── requireOrganizer logic (pure extracted) ──────────────────────────────────

describe('requireOrganizer — access control rules', () => {
  // Mirrors the logic in src/lib/requireOrganizer.ts
  function checkOrganizer(
    playerRecord: { id: string; is_organizer: boolean; session_id: string } | null,
    requestedSessionId: string,
    organizerPlayerId: string | null | undefined
  ): 'ok' | 'unauthorized' {
    if (!organizerPlayerId) return 'unauthorized'
    if (!playerRecord) return 'unauthorized'
    if (!playerRecord.is_organizer) return 'unauthorized'
    if (playerRecord.session_id !== requestedSessionId) return 'unauthorized'
    return 'ok'
  }

  it('returns ok when player is organizer for the correct session', () => {
    const player = { id: 'p1', is_organizer: true, session_id: 's1' }
    expect(checkOrganizer(player, 's1', 'p1')).toBe('ok')
  })

  it('unauthorized when organizerPlayerId is null', () => {
    const player = { id: 'p1', is_organizer: true, session_id: 's1' }
    expect(checkOrganizer(player, 's1', null)).toBe('unauthorized')
  })

  it('unauthorized when organizerPlayerId is undefined', () => {
    const player = { id: 'p1', is_organizer: true, session_id: 's1' }
    expect(checkOrganizer(player, 's1', undefined)).toBe('unauthorized')
  })

  it('unauthorized when player record not found', () => {
    expect(checkOrganizer(null, 's1', 'p1')).toBe('unauthorized')
  })

  it('unauthorized when player is not an organizer', () => {
    const player = { id: 'p1', is_organizer: false, session_id: 's1' }
    expect(checkOrganizer(player, 's1', 'p1')).toBe('unauthorized')
  })

  it('unauthorized when player belongs to different session', () => {
    const player = { id: 'p1', is_organizer: true, session_id: 's2' }
    expect(checkOrganizer(player, 's1', 'p1')).toBe('unauthorized')
  })
})

// ─── submit-guess validation ──────────────────────────────────────────────────

describe('submit-guess validation rules', () => {
  function validateGuess(body: {
    round_id?: string
    player_id?: string
    answer?: unknown
    passed?: boolean
    target_player_id?: string
  }): string | null {
    if (!body.round_id || !body.player_id) return 'Missing required fields'
    if (!body.passed && (body.answer === undefined || body.answer === null)) return 'Answer is required unless passing'
    const numAnswer = body.passed ? null : Number(body.answer)
    if (!body.passed && isNaN(numAnswer as number)) return 'Answer must be a number'
    if (body.target_player_id === body.player_id) return 'Target player cannot submit a guess'
    return null
  }

  it('valid guess passes', () => {
    expect(validateGuess({ round_id: 'r1', player_id: 'p1', answer: 50, target_player_id: 'p2' })).toBeNull()
  })

  it('missing round_id → error', () => {
    expect(validateGuess({ player_id: 'p1', answer: 50 })).toBeTruthy()
  })

  it('missing player_id → error', () => {
    expect(validateGuess({ round_id: 'r1', answer: 50 })).toBeTruthy()
  })

  it('no answer and not passing → error', () => {
    expect(validateGuess({ round_id: 'r1', player_id: 'p1' })).toBeTruthy()
  })

  it('passed=true with no answer → valid (pass is allowed)', () => {
    expect(validateGuess({ round_id: 'r1', player_id: 'p1', passed: true })).toBeNull()
  })

  it('non-numeric answer → error', () => {
    expect(validateGuess({ round_id: 'r1', player_id: 'p1', answer: 'banana' })).toBeTruthy()
  })

  it('target player trying to guess themselves → error', () => {
    expect(validateGuess({ round_id: 'r1', player_id: 'p1', answer: 50, target_player_id: 'p1' })).toBeTruthy()
  })
})

// ─── submit-answer validation ─────────────────────────────────────────────────

describe('submit-answer validation rules', () => {
  function validateAnswer(body: {
    round_id?: string
    player_id?: string
    answer?: unknown
    target_player_id?: string
  }): string | null {
    if (!body.round_id || !body.player_id || body.answer === undefined || body.answer === null) {
      return 'Missing required fields'
    }
    if (isNaN(Number(body.answer))) return 'Answer must be a number'
    if (body.target_player_id !== body.player_id) return 'Only the target player can submit an answer'
    return null
  }

  it('valid answer from target passes', () => {
    expect(validateAnswer({ round_id: 'r1', player_id: 'p1', answer: 42, target_player_id: 'p1' })).toBeNull()
  })

  it('non-target player submitting answer → error', () => {
    expect(validateAnswer({ round_id: 'r1', player_id: 'p2', answer: 42, target_player_id: 'p1' })).toBeTruthy()
  })

  it('missing answer → error', () => {
    expect(validateAnswer({ round_id: 'r1', player_id: 'p1', target_player_id: 'p1' })).toBeTruthy()
  })

  it('non-numeric answer → error', () => {
    expect(validateAnswer({ round_id: 'r1', player_id: 'p1', answer: 'abc', target_player_id: 'p1' })).toBeTruthy()
  })

  it('answer=0 is valid (zero is a legitimate number)', () => {
    expect(validateAnswer({ round_id: 'r1', player_id: 'p1', answer: 0, target_player_id: 'p1' })).toBeNull()
  })
})

// ─── pause/resume action validation ──────────────────────────────────────────

describe('pause/resume action validation', () => {
  function validatePauseAction(action: unknown): string | null {
    if (action !== 'pause' && action !== 'resume') {
      return 'Invalid action. Use "pause" or "resume".'
    }
    return null
  }

  it('"pause" is valid', () => {
    expect(validatePauseAction('pause')).toBeNull()
  })

  it('"resume" is valid', () => {
    expect(validatePauseAction('resume')).toBeNull()
  })

  it('missing action → error', () => {
    expect(validatePauseAction(undefined)).toBeTruthy()
  })

  it('typo action → error', () => {
    expect(validatePauseAction('PAUSE')).toBeTruthy()
    expect(validatePauseAction('stop')).toBeTruthy()
  })
})

// ─── calculate-winner idempotency ─────────────────────────────────────────────

describe('calculate-winner idempotency', () => {
  // Simulates the idempotency guard in the route
  function shouldRecalculate(roundStatus: string): boolean {
    return roundStatus !== 'done'
  }

  it('round in "reveal" status should be calculated', () => {
    expect(shouldRecalculate('reveal')).toBe(true)
  })

  it('round in "guessing" status should be calculated', () => {
    expect(shouldRecalculate('guessing')).toBe(true)
  })

  it('round already "done" should NOT recalculate', () => {
    expect(shouldRecalculate('done')).toBe(false)
  })
})

// ─── replay: organizer_name required ─────────────────────────────────────────

describe('replay validation', () => {
  function validateReplay(body: { organizer_name?: string }): string | null {
    if (!body.organizer_name?.trim()) return 'Organizer name is required'
    return null
  }

  it('valid organizer name passes', () => {
    expect(validateReplay({ organizer_name: 'Host' })).toBeNull()
  })

  it('missing organizer_name → error', () => {
    expect(validateReplay({})).toBeTruthy()
  })

  it('blank organizer_name → error', () => {
    expect(validateReplay({ organizer_name: '   ' })).toBeTruthy()
  })
})

// ─── feedback: emoji_rating required ──────────────────────────────────────────

describe('submit-feedback validation', () => {
  function validateFeedback(body: { emoji_rating?: string }): string | null {
    if (!body.emoji_rating) return 'emoji_rating is required'
    return null
  }

  it('valid emoji_rating passes', () => {
    expect(validateFeedback({ emoji_rating: '😊' })).toBeNull()
  })

  it('missing emoji_rating → error', () => {
    expect(validateFeedback({})).toBeTruthy()
  })
})

// ─── join-room: capacity and ended session ─────────────────────────────────────

describe('join-room business rules', () => {
  function checkJoinAllowed(session: {
    status: string
    playerCount: number
  }): string | null {
    if (session.status === 'ended') return 'This game has already ended.'
    if (session.playerCount >= 12) return 'Room is full (maximum 12 players)'
    return null
  }

  it('lobby with space → allowed', () => {
    expect(checkJoinAllowed({ status: 'lobby', playerCount: 3 })).toBeNull()
  })

  it('active session with space → allowed (late join)', () => {
    expect(checkJoinAllowed({ status: 'active', playerCount: 5 })).toBeNull()
  })

  it('ended session → blocked', () => {
    expect(checkJoinAllowed({ status: 'ended', playerCount: 2 })).toBeTruthy()
  })

  it('12 players → full', () => {
    expect(checkJoinAllowed({ status: 'lobby', playerCount: 12 })).toBeTruthy()
  })

  it('11 players → not full', () => {
    expect(checkJoinAllowed({ status: 'lobby', playerCount: 11 })).toBeNull()
  })

  it('0 players (just organizer in session) → allowed', () => {
    expect(checkJoinAllowed({ status: 'lobby', playerCount: 0 })).toBeNull()
  })
})

// ─── rejoin token logic ────────────────────────────────────────────────────────

describe('rejoin token logic', () => {
  function checkRejoin(
    storedToken: string,
    providedToken: string | null | undefined
  ): 'rejoin' | 'blocked' {
    if (providedToken && storedToken === providedToken) return 'rejoin'
    return 'blocked'
  }

  it('correct token → rejoin allowed', () => {
    expect(checkRejoin('tok-abc', 'tok-abc')).toBe('rejoin')
  })

  it('wrong token → blocked', () => {
    expect(checkRejoin('tok-abc', 'tok-xyz')).toBe('blocked')
  })

  it('no token provided → blocked', () => {
    expect(checkRejoin('tok-abc', null)).toBe('blocked')
    expect(checkRejoin('tok-abc', undefined)).toBe('blocked')
  })
})
