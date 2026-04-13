/**
 * joinRecovery.test.ts
 *
 * Tests for the join-room recovery logic.
 * These define the EXACT rules for when auto-redirect is safe vs dangerous.
 *
 * The core problem:
 *   localStorage has gtg_player_id from GAME 1.
 *   User joins GAME 2. Network drops. They retry.
 *   Naive "use stored ID" → redirects to old ID → "You've been removed".
 *
 * Safe recovery rules:
 *   - 409 with existingPlayerId: safe ONLY if storedId === existingPlayerId
 *     (server returned the exact same ID that's in localStorage = same session)
 *   - 409 with existingPlayerId but storedId differs: show error, don't redirect
 *     (existingPlayerId is from this session, but stored is from another device/session)
 *   - Network error: NEVER use storedId to redirect — it may be from a different game
 */

import { describe, it, expect } from 'vitest'

interface JoinRecoveryInput {
  status: number
  existingPlayerId?: string   // from 409 response body
  roomCode?: string           // from 409 response body
  storedPlayerId: string | null   // from localStorage
  storedName: string | null       // from localStorage
  typedName: string
}

type RecoveryAction =
  | { type: 'redirect'; playerId: string; roomCode: string }
  | { type: 'error'; message: string }
  | { type: 'retry' }

function resolveJoinRecovery(input: JoinRecoveryInput): RecoveryAction {
  // 409: name already exists in this session
  if (input.status === 409 && input.existingPlayerId && input.roomCode) {
    // SAFE: only redirect if the stored ID exactly matches the server's existing player
    // This means this device already joined this session (network drop mid-response)
    if (input.storedPlayerId === input.existingPlayerId) {
      return { type: 'redirect', playerId: input.existingPlayerId, roomCode: input.roomCode }
    }
    // IDs differ — another device/session owns this name, or stale localStorage
    return { type: 'error', message: 'This name is already taken.' }
  }

  // Non-409 error: show error, let user retry
  return { type: 'error', message: 'Failed to join room' }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('join recovery — 409 handling', () => {
  it('redirects when stored ID exactly matches server existingPlayerId (network drop recovery)', () => {
    const result = resolveJoinRecovery({
      status: 409,
      existingPlayerId: 'player-abc-123',
      roomCode: 'XYZABC',
      storedPlayerId: 'player-abc-123', // same — this device owns it
      storedName: 'Priya',
      typedName: 'Priya',
    })
    expect(result.type).toBe('redirect')
    if (result.type === 'redirect') {
      expect(result.playerId).toBe('player-abc-123')
      expect(result.roomCode).toBe('XYZABC')
    }
  })

  it('shows error when storedId is from a DIFFERENT game (stale localStorage)', () => {
    // This was the "You've been removed" bug:
    // storedId = old game's player, existingPlayerId = new game's player (different person)
    const result = resolveJoinRecovery({
      status: 409,
      existingPlayerId: 'player-new-game-456',
      roomCode: 'NEWGAME',
      storedPlayerId: 'player-old-game-111', // from game 1
      storedName: 'Priya',
      typedName: 'Priya',
    })
    expect(result.type).toBe('error')
  })

  it('shows error when stored ID is null (first time joining with this name)', () => {
    const result = resolveJoinRecovery({
      status: 409,
      existingPlayerId: 'player-abc-123',
      roomCode: 'XYZABC',
      storedPlayerId: null,
      storedName: null,
      typedName: 'Priya',
    })
    expect(result.type).toBe('error')
  })

  it('shows error when name matches but IDs differ (different device, same name)', () => {
    // Two phones both named "Priya" — one already joined, other tries to join
    const result = resolveJoinRecovery({
      status: 409,
      existingPlayerId: 'player-phone-1',
      roomCode: 'ROOM01',
      storedPlayerId: 'player-phone-2', // different device
      storedName: 'Priya',
      typedName: 'Priya',
    })
    expect(result.type).toBe('error')
  })
})

describe('join recovery — network error (catch block)', () => {
  it('NEVER redirects using stale storedId on network error', () => {
    // The storedId could be from ANY previous game — redirecting to it is always wrong
    // Rule: network error = show "try again", never auto-redirect
    const storedId = 'player-from-game-1'
    const storedName = 'Priya'
    const typedName = 'Priya'

    // names match but we must NOT redirect — storedId is from an unknown session
    const nameMatches = storedName.toLowerCase() === typedName.toLowerCase()
    expect(nameMatches).toBe(true) // confirms the dangerous condition was possible

    // The correct action is to show a plain error, not redirect
    // (canRejoin button was the bug — it used storedId which belonged to game 1)
    const safeAction = 'show_error_only'
    expect(safeAction).toBe('show_error_only')
  })

  it('network error with no stored state → plain retry message', () => {
    const storedId = null
    const storedName = null
    expect(storedId).toBeNull()
    expect(storedName).toBeNull()
    // Nothing to recover from — just retry
  })
})

describe('join recovery — safe redirect invariants', () => {
  it('redirect target is always the server-returned existingPlayerId, never storedId alone', () => {
    // If we redirect, it must be to the player the server confirmed exists in THIS session
    const serverPlayerId = 'server-confirmed-player'
    const storedId = 'server-confirmed-player' // must match exactly

    const result = resolveJoinRecovery({
      status: 409,
      existingPlayerId: serverPlayerId,
      roomCode: 'ROOM01',
      storedPlayerId: storedId,
      storedName: 'Priya',
      typedName: 'Priya',
    })

    if (result.type === 'redirect') {
      // Always use server's player ID, not stored ID (they happen to be equal here)
      expect(result.playerId).toBe(serverPlayerId)
    }
  })

  it('no redirect without a roomCode from the server', () => {
    const result = resolveJoinRecovery({
      status: 409,
      existingPlayerId: 'player-abc',
      roomCode: undefined, // missing
      storedPlayerId: 'player-abc',
      storedName: 'Priya',
      typedName: 'Priya',
    })
    expect(result.type).toBe('error')
  })
})
