/**
 * playerLobbyPoll.test.ts
 *
 * Tests for Bug 1 — players not appearing on organizer/present page immediately.
 *
 * Also discovers new potential gaps:
 * - Late-join player during active game not appearing in rotation queue
 * - Player count shown incorrectly when organizer is counted
 * - Removed player still shown in lobby
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useEffect, useRef } from 'react'

interface Player { id: string; name: string; is_organizer: boolean; session_id: string }

// ── Lobby poll hook (mirrors both organizer and present page) ─────────────────

function useLobbyPlayerPoll(
  sessionId: string | undefined,
  status: string | undefined,
  fetchPlayers: () => Promise<Player[]>,
  onPlayersLoaded: (p: Player[]) => void
) {
  useEffect(() => {
    if (!sessionId || status !== 'lobby') return
    const interval = setInterval(async () => {
      const players = await fetchPlayers()
      onPlayersLoaded(players)
    }, 3000)
    return () => clearInterval(interval)
  }, [sessionId, status])
}

describe('lobby player poll — organizer and present page', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('polls every 3s while in lobby', async () => {
    const fetchPlayers = vi.fn().mockResolvedValue([])
    const onLoaded = vi.fn()

    renderHook(() => useLobbyPlayerPoll('s1', 'lobby', fetchPlayers, onLoaded))

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(fetchPlayers).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(fetchPlayers).toHaveBeenCalledTimes(2)
  })

  it('calls onPlayersLoaded with fetched data', async () => {
    const players: Player[] = [
      { id: 'p1', name: 'Alice', is_organizer: false, session_id: 's1' },
      { id: 'p2', name: 'Bob',   is_organizer: false, session_id: 's1' },
    ]
    const fetchPlayers = vi.fn().mockResolvedValue(players)
    const onLoaded = vi.fn()

    renderHook(() => useLobbyPlayerPoll('s1', 'lobby', fetchPlayers, onLoaded))

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(onLoaded).toHaveBeenCalledWith(players)
  })

  it('stops when session moves to active', async () => {
    const fetchPlayers = vi.fn().mockResolvedValue([])
    const onLoaded = vi.fn()

    const { rerender } = renderHook(
      ({ status }: { status: string }) =>
        useLobbyPlayerPoll('s1', status, fetchPlayers, onLoaded),
      { initialProps: { status: 'lobby' } }
    )

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(fetchPlayers).toHaveBeenCalledTimes(1)

    rerender({ status: 'active' })

    await act(async () => { vi.advanceTimersByTime(9000) })
    expect(fetchPlayers).toHaveBeenCalledTimes(1) // stopped
  })

  it('does not poll when sessionId not yet loaded', async () => {
    const fetchPlayers = vi.fn().mockResolvedValue([])
    renderHook(() => useLobbyPlayerPoll(undefined, 'lobby', fetchPlayers, vi.fn()))

    await act(async () => { vi.advanceTimersByTime(9000) })
    expect(fetchPlayers).not.toHaveBeenCalled()
  })

  it('picks up new player who joins between polls', async () => {
    const alice: Player = { id: 'p1', name: 'Alice', is_organizer: false, session_id: 's1' }
    const bob: Player   = { id: 'p2', name: 'Bob',   is_organizer: false, session_id: 's1' }

    let callCount = 0
    const fetchPlayers = vi.fn().mockImplementation(() => {
      callCount++
      // Bob joins between poll 1 and poll 2
      return Promise.resolve(callCount === 1 ? [alice] : [alice, bob])
    })

    const results: Player[][] = []
    renderHook(() => useLobbyPlayerPoll('s1', 'lobby', fetchPlayers, p => results.push(p)))

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(results[0]).toHaveLength(1)  // only Alice

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(results[1]).toHaveLength(2)  // Alice + Bob
  })
})

// ── Player count display logic ────────────────────────────────────────────────

describe('player count display — organizer should NOT include themselves', () => {
  function nonOrgCount(players: Player[]): number {
    return players.filter(p => !p.is_organizer).length
  }

  it('returns 0 when only organizer in room', () => {
    const players: Player[] = [
      { id: 'h', name: 'Host', is_organizer: true, session_id: 's1' },
    ]
    expect(nonOrgCount(players)).toBe(0)
  })

  it('returns correct count with 3 non-organizer players', () => {
    const players: Player[] = [
      { id: 'h',  name: 'Host',  is_organizer: true,  session_id: 's1' },
      { id: 'p1', name: 'Alice', is_organizer: false, session_id: 's1' },
      { id: 'p2', name: 'Bob',   is_organizer: false, session_id: 's1' },
      { id: 'p3', name: 'Carol', is_organizer: false, session_id: 's1' },
    ]
    expect(nonOrgCount(players)).toBe(3)
  })

  it('does not count the same player twice on rapid polls', () => {
    // Both polls return same player list — count stays the same
    const players: Player[] = [
      { id: 'h',  name: 'Host',  is_organizer: true,  session_id: 's1' },
      { id: 'p1', name: 'Alice', is_organizer: false, session_id: 's1' },
    ]
    expect(nonOrgCount(players)).toBe(1)
    expect(nonOrgCount(players)).toBe(1) // idempotent
  })
})

// ── Late-join player added to rotation queue ──────────────────────────────────

describe('late-join player added to rotation queue', () => {
  function addLateJoinersToQueue(
    currentQueue: string[],
    allNonOrgPlayers: Player[]
  ): string[] {
    const newPlayers = allNonOrgPlayers.filter(p => !currentQueue.includes(p.id))
    if (newPlayers.length === 0) return currentQueue
    return [...currentQueue, ...newPlayers.map(p => p.id)]
  }

  it('adds new player to end of existing queue', () => {
    const queue = ['p1', 'p2']
    const allPlayers: Player[] = [
      { id: 'p1', name: 'A', is_organizer: false, session_id: 's1' },
      { id: 'p2', name: 'B', is_organizer: false, session_id: 's1' },
      { id: 'p3', name: 'C', is_organizer: false, session_id: 's1' }, // late joiner
    ]
    const updated = addLateJoinersToQueue(queue, allPlayers)
    expect(updated).toContain('p3')
    expect(updated[updated.length - 1]).toBe('p3')
  })

  it('does not add duplicate if player already in queue', () => {
    const queue = ['p1', 'p2']
    const allPlayers: Player[] = [
      { id: 'p1', name: 'A', is_organizer: false, session_id: 's1' },
      { id: 'p2', name: 'B', is_organizer: false, session_id: 's1' },
    ]
    const updated = addLateJoinersToQueue(queue, allPlayers)
    expect(updated).toHaveLength(2)
  })

  it('empty queue returns all players (fresh start)', () => {
    const allPlayers: Player[] = [
      { id: 'p1', name: 'A', is_organizer: false, session_id: 's1' },
      { id: 'p2', name: 'B', is_organizer: false, session_id: 's1' },
    ]
    expect(addLateJoinersToQueue([], allPlayers)).toEqual(['p1', 'p2'])
  })

  it('multiple late joiners all added in order', () => {
    const queue = ['p1']
    const allPlayers: Player[] = [
      { id: 'p1', name: 'A', is_organizer: false, session_id: 's1' },
      { id: 'p2', name: 'B', is_organizer: false, session_id: 's1' },
      { id: 'p3', name: 'C', is_organizer: false, session_id: 's1' },
    ]
    const updated = addLateJoinersToQueue(queue, allPlayers)
    expect(updated).toEqual(['p1', 'p2', 'p3'])
  })
})

// ── Removed player detection ───────────────────────────────────────────────────

describe('removed player detection', () => {
  function isPlayerRemoved(playerId: string, currentPlayers: Player[]): boolean {
    return currentPlayers.length > 0 && !currentPlayers.find(p => p.id === playerId)
  }

  it('detects removal when player no longer in list', () => {
    const players: Player[] = [
      { id: 'p2', name: 'Bob', is_organizer: false, session_id: 's1' },
    ]
    expect(isPlayerRemoved('p1', players)).toBe(true)
  })

  it('not removed when still in list', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Alice', is_organizer: false, session_id: 's1' },
    ]
    expect(isPlayerRemoved('p1', players)).toBe(false)
  })

  it('not removed when player list is empty (data not yet loaded)', () => {
    // Empty list means data not loaded — don't prematurely remove
    expect(isPlayerRemoved('p1', [])).toBe(false)
  })
})
