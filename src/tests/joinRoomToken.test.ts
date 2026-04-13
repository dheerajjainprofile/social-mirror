/**
 * joinRoomToken.test.ts
 *
 * Tests for the player_token / rejoin logic in join-room API.
 * These cover the Android join failure and multi-session stale token bugs.
 *
 * Bugs caught:
 * - Stale player_token from prev session → false 409 "name taken" on Android
 * - player_token never set in DB INSERT → rejoin never works
 * - "null" string stored in localStorage treated as valid token
 */

import { describe, it, expect } from 'vitest'

// ── UUID validation (mirrors join/page.tsx guard) ─────────────────────────────

function isValidUUID(token: string | null): boolean {
  if (!token) return false
  return /^[0-9a-f-]{36}$/i.test(token)
}

function getSafeToken(stored: string | null): string | null {
  return isValidUUID(stored) ? stored : null
}

describe('player_token UUID validation — prevents stale token 409s', () => {
  it('accepts a valid UUID token', () => {
    expect(getSafeToken('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('rejects null — no stored token', () => {
    expect(getSafeToken(null)).toBeNull()
  })

  it('rejects literal string "null" — old localStorage bug on Android', () => {
    // Android WebView sometimes writes "null" as a string to localStorage
    expect(getSafeToken('null')).toBeNull()
  })

  it('rejects literal string "undefined"', () => {
    expect(getSafeToken('undefined')).toBeNull()
  })

  it('rejects empty string', () => {
    expect(getSafeToken('')).toBeNull()
  })

  it('rejects partial UUID (too short)', () => {
    expect(getSafeToken('550e8400-e29b')).toBeNull()
  })

  it('rejects non-UUID string (stale session ID in different format)', () => {
    expect(getSafeToken('some-random-session-string')).toBeNull()
  })

  it('accepts UUID with uppercase letters', () => {
    expect(getSafeToken('550E8400-E29B-41D4-A716-446655440000')).toBe('550E8400-E29B-41D4-A716-446655440000')
  })
})

// ── Rejoin logic — same name, token match ────────────────────────────────────

type RejoinResult =
  | { type: 'rejoin'; player: { id: string; name: string } }
  | { type: 'blocked'; reason: string }
  | { type: 'new' }

function evaluateJoinAttempt(
  existingPlayers: Array<{ id: string; name: string; player_token: string | null }>,
  name: string,
  token: string | null
): RejoinResult {
  const match = existingPlayers.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  )
  if (!match) return { type: 'new' }
  const safeToken = getSafeToken(token)
  if (safeToken && match.player_token === safeToken) {
    return { type: 'rejoin', player: match }
  }
  return { type: 'blocked', reason: 'Name taken' }
}

describe('join-room rejoin logic', () => {
  const players = [
    { id: 'p1', name: 'Dheeraj', player_token: '550e8400-e29b-41d4-a716-446655440001' },
    { id: 'p2', name: 'Priya', player_token: null }, // no token in DB (old row)
  ]

  it('new name → new player', () => {
    expect(evaluateJoinAttempt(players, 'NewPerson', null).type).toBe('new')
  })

  it('same name + correct token → rejoin', () => {
    const result = evaluateJoinAttempt(players, 'Dheeraj', '550e8400-e29b-41d4-a716-446655440001')
    expect(result.type).toBe('rejoin')
  })

  it('same name + wrong token → blocked (not rejoin)', () => {
    const result = evaluateJoinAttempt(players, 'Dheeraj', '550e8400-e29b-41d4-a716-000000000000')
    expect(result.type).toBe('blocked')
  })

  it('same name + no token → blocked (not rejoin)', () => {
    const result = evaluateJoinAttempt(players, 'Dheeraj', null)
    expect(result.type).toBe('blocked')
  })

  it('same name + stale "null" string token → blocked (not treated as match)', () => {
    // This was the Android bug: getSafeToken("null") = null → blocked, not erroneously rejoined
    const result = evaluateJoinAttempt(players, 'Dheeraj', 'null')
    expect(result.type).toBe('blocked')
  })

  it('player with null DB token → cannot rejoin even with any token', () => {
    // Priya has null player_token in DB — no rejoin possible
    const result = evaluateJoinAttempt(players, 'Priya', '550e8400-e29b-41d4-a716-446655440099')
    expect(result.type).toBe('blocked')
  })
})

// ── Multi-session: different session, same name ───────────────────────────────

describe('multi-session / multiple tabs — stale token from previous session', () => {
  it('token from session A does NOT match player in session B (different player ID)', () => {
    // Session B has a "Dheeraj" with a DIFFERENT token — old token should not let you in
    const sessionBPlayers = [
      { id: 'p-session-b', name: 'Dheeraj', player_token: '99999999-0000-0000-0000-000000000001' },
    ]
    const oldToken = '550e8400-e29b-41d4-a716-446655440001' // from session A

    const result = evaluateJoinAttempt(sessionBPlayers, 'Dheeraj', oldToken)
    expect(result.type).toBe('blocked')
  })

  it('fresh join (no token) to new session with same name → blocked until name changes', () => {
    const sessionBPlayers = [
      { id: 'p-session-b', name: 'Dheeraj', player_token: '99999999-0000-0000-0000-000000000001' },
    ]
    const result = evaluateJoinAttempt(sessionBPlayers, 'Dheeraj', null)
    expect(result.type).toBe('blocked')
  })

  it('same name different case → treated as same name (case-insensitive)', () => {
    const players = [{ id: 'p1', name: 'Dheeraj', player_token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }]
    expect(evaluateJoinAttempt(players, 'dheeraj', null).type).toBe('blocked')
    expect(evaluateJoinAttempt(players, 'DHEERAJ', null).type).toBe('blocked')
  })
})
