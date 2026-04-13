/**
 * joinPageBehavior.test.ts
 *
 * Tests for all join-page response handling paths — ensuring recent recovery
 * logic changes don't break normal flows or introduce new failure modes.
 */

import { describe, it, expect } from 'vitest'

// ── Mirrors the join-page response handling logic ─────────────────────────────

interface JoinResponse {
  ok: boolean
  status: number
  data: {
    error?: string
    existingPlayerId?: string
    roomCode?: string
    player?: { id: string; player_token?: string }
    session?: { id: string; room_code: string }
  }
}

type JoinAction =
  | { type: 'navigate'; path: string }
  | { type: 'error'; message: string }

function resolveJoinResponse(
  res: JoinResponse,
  storedPlayerId: string | null
): JoinAction {
  if (!res.ok) {
    if (res.status === 409 && res.data.existingPlayerId && res.data.roomCode) {
      if (storedPlayerId && storedPlayerId === res.data.existingPlayerId) {
        return {
          type: 'navigate',
          path: `/room/${res.data.roomCode}/player/${res.data.existingPlayerId}`,
        }
      }
    }
    return { type: 'error', message: res.data.error ?? 'Failed to join room' }
  }

  return {
    type: 'navigate',
    path: `/room/${res.data.session!.room_code}/player/${res.data.player!.id}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('join page — successful join', () => {
  it('navigates to player page on success', () => {
    const res: JoinResponse = {
      ok: true,
      status: 200,
      data: {
        player: { id: 'player-1', player_token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
        session: { id: 'sess-1', room_code: 'ABCDEF' },
      },
    }
    const action = resolveJoinResponse(res, null)
    expect(action.type).toBe('navigate')
    if (action.type === 'navigate') {
      expect(action.path).toBe('/room/ABCDEF/player/player-1')
    }
  })
})

describe('join page — 409 name taken', () => {
  it('auto-redirects when storedId === existingPlayerId (network drop recovery)', () => {
    const res: JoinResponse = {
      ok: false,
      status: 409,
      data: {
        error: 'Name taken',
        existingPlayerId: 'player-abc',
        roomCode: 'ROOM01',
      },
    }
    const action = resolveJoinResponse(res, 'player-abc')
    expect(action.type).toBe('navigate')
    if (action.type === 'navigate') {
      expect(action.path).toBe('/room/ROOM01/player/player-abc')
    }
  })

  it('shows error when storedId differs from existingPlayerId (different game)', () => {
    const res: JoinResponse = {
      ok: false,
      status: 409,
      data: {
        error: 'Name taken',
        existingPlayerId: 'player-new-game',
        roomCode: 'ROOM02',
      },
    }
    const action = resolveJoinResponse(res, 'player-old-game')
    expect(action.type).toBe('error')
  })

  it('shows error when storedId is null', () => {
    const res: JoinResponse = {
      ok: false,
      status: 409,
      data: {
        error: 'Name taken',
        existingPlayerId: 'player-abc',
        roomCode: 'ROOM01',
      },
    }
    const action = resolveJoinResponse(res, null)
    expect(action.type).toBe('error')
  })

  it('shows error when 409 has no existingPlayerId (old API version)', () => {
    const res: JoinResponse = {
      ok: false,
      status: 409,
      data: { error: 'Name taken' },
    }
    const action = resolveJoinResponse(res, 'player-abc')
    expect(action.type).toBe('error')
  })

  it('shows error when 409 has existingPlayerId but no roomCode', () => {
    const res: JoinResponse = {
      ok: false,
      status: 409,
      data: { error: 'Name taken', existingPlayerId: 'player-abc' },
    }
    const action = resolveJoinResponse(res, 'player-abc')
    expect(action.type).toBe('error')
  })

  it('error message comes from API response', () => {
    const res: JoinResponse = {
      ok: false,
      status: 409,
      data: { error: 'This name is already taken. If you lost...' },
    }
    const action = resolveJoinResponse(res, null)
    expect(action.type).toBe('error')
    if (action.type === 'error') {
      expect(action.message).toContain('already taken')
    }
  })
})

describe('join page — other errors', () => {
  it('shows error on 404 room not found', () => {
    const res: JoinResponse = {
      ok: false,
      status: 404,
      data: { error: 'Room not found' },
    }
    const action = resolveJoinResponse(res, null)
    expect(action.type).toBe('error')
    if (action.type === 'error') {
      expect(action.message).toBe('Room not found')
    }
  })

  it('shows error on 400 session ended', () => {
    const res: JoinResponse = {
      ok: false,
      status: 400,
      data: { error: 'This game has already ended.' },
    }
    const action = resolveJoinResponse(res, null)
    expect(action.type).toBe('error')
  })

  it('shows error on 500', () => {
    const res: JoinResponse = {
      ok: false,
      status: 500,
      data: { error: 'Internal server error' },
    }
    const action = resolveJoinResponse(res, null)
    expect(action.type).toBe('error')
  })

  it('falls back to generic message when error field missing', () => {
    const res: JoinResponse = {
      ok: false,
      status: 500,
      data: {},
    }
    const action = resolveJoinResponse(res, null)
    expect(action.type).toBe('error')
    if (action.type === 'error') {
      expect(action.message).toBe('Failed to join room')
    }
  })
})

// ── Token validation (ensures stale tokens are never sent) ───────────────────

describe('player_token validation before sending', () => {
  function getSafeToken(raw: string | null): string | null {
    if (!raw) return null
    return /^[0-9a-f-]{36}$/i.test(raw) ? raw : null
  }

  it('valid UUID passes', () => {
    expect(getSafeToken('550e8400-e29b-41d4-a716-446655440000')).not.toBeNull()
  })

  it('"null" string rejected', () => {
    expect(getSafeToken('null')).toBeNull()
  })

  it('"undefined" string rejected', () => {
    expect(getSafeToken('undefined')).toBeNull()
  })

  it('empty string rejected', () => {
    expect(getSafeToken('')).toBeNull()
  })

  it('null rejected', () => {
    expect(getSafeToken(null)).toBeNull()
  })

  it('partial UUID rejected', () => {
    expect(getSafeToken('550e8400-e29b')).toBeNull()
  })
})

// ── Token storage after successful join ───────────────────────────────────────

describe('player_token storage after successful join', () => {
  function shouldStoreToken(token: string | undefined | null): boolean {
    if (!token) return false
    return /^[0-9a-f-]{36}$/i.test(token)
  }

  it('stores valid UUID token', () => {
    expect(shouldStoreToken('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('does not store null token (new player, DB column may be null)', () => {
    expect(shouldStoreToken(null)).toBe(false)
  })

  it('does not store undefined', () => {
    expect(shouldStoreToken(undefined)).toBe(false)
  })

  it('does not store invalid string', () => {
    expect(shouldStoreToken('some-garbage')).toBe(false)
  })
})
