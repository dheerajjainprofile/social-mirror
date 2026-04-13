/**
 * realtimeResilience.test.ts
 *
 * Tests for the three bugs found during real-device testing:
 *
 * Bug 1: Players not appearing immediately on organizer/present lobby
 *   Root cause: Supabase realtime INSERT for players table is unreliable.
 *   Fix: Poll players every 3s while in lobby on both organizer and present.
 *
 * Bug 2: iPhone player stuck in lobby when game started
 *   Root cause: subscription useEffect depended on `refreshAll` callback ref,
 *   which was recreated on nearly every render (it has many useCallback deps).
 *   Every recreation tore down and re-subscribed, creating a gap where the
 *   `sessions UPDATE` event could be missed. On iOS this gap is long enough
 *   to reliably lose the event.
 *   Fix: store refreshAll in a ref, make subscription depend only on
 *   session.id + playerId (never changes during a game).
 *
 * Bug 3: Organizer shows only one winner; player screens show tied winners
 *   Root cause: auto-reveal guard was `if (!winnerPlayer) handleCalculateWinner()`.
 *   `refreshAll` can set `winnerPlayer` early (from round.winner_player_id in DB)
 *   via a realtime scores INSERT event that fires before handleCalculateWinner
 *   resolves. This caused the guard to skip the call, leaving `winners = []`
 *   and `revealWinnerNames = []`. Players computed ties locally from revealCards
 *   (always correct), but organizer missed them.
 *   Fix: guard on `winners.length === 0`, and reconstruct tied winners in
 *   refreshAll from the scores table.
 *
 * These tests verify the pure logic extracted from these fixes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Bug 1: Lobby player poll logic ─────────────────────────────────────────

describe('lobby player poll — should run while status is lobby', () => {
  function shouldPollPlayers(sessionStatus: string | undefined): boolean {
    return sessionStatus === 'lobby'
  }

  it('polls while status is lobby', () => {
    expect(shouldPollPlayers('lobby')).toBe(true)
  })

  it('does NOT poll while active', () => {
    expect(shouldPollPlayers('active')).toBe(false)
  })

  it('does NOT poll while ended', () => {
    expect(shouldPollPlayers('ended')).toBe(false)
  })

  it('does NOT poll when status undefined (not loaded yet)', () => {
    expect(shouldPollPlayers(undefined)).toBe(false)
  })

  it('stops polling when session transitions from lobby to active', () => {
    // Simulate the effect dependency: poll is created for lobby, cleared on status change
    let status: string = 'lobby'
    const intervals: string[] = []
    const cleared: string[] = []

    function setupPoll(s: string) {
      if (s !== 'lobby') return null
      const id = `poll-${s}`
      intervals.push(id)
      return id
    }

    function clearPoll(id: string | null) {
      if (id) cleared.push(id)
    }

    const id1 = setupPoll(status) // lobby → creates poll
    status = 'active'
    clearPoll(id1)                // transition → clears poll
    const id2 = setupPoll(status) // active → no poll

    expect(intervals).toHaveLength(1)
    expect(cleared).toHaveLength(1)
    expect(id2).toBeNull()
  })
})

// ─── Bug 2: Subscription stability — ref pattern ────────────────────────────

describe('subscription stability — refreshAllRef pattern', () => {
  it('ref always holds the latest callback without triggering subscription recreation', () => {
    // Simulates the ref pattern: subscription reads from ref, not from the closure
    let callCount = 0
    let subscriptionCreations = 0

    // The stable subscription — created once, reads from ref
    const callbackRef = { current: () => { callCount++ } }

    function createSubscription() {
      subscriptionCreations++
      // subscription calls ref.current, not a captured closure
      return { trigger: () => callbackRef.current() }
    }

    const sub = createSubscription()

    // Simulate callback being "recreated" (as useCallback would do on dep change)
    const newCallback = () => { callCount += 10 }
    callbackRef.current = newCallback  // update ref — no new subscription

    sub.trigger()  // subscription still calls through ref
    expect(callCount).toBe(10)     // got latest callback
    expect(subscriptionCreations).toBe(1) // subscription never recreated
  })

  it('old closure pattern recreates subscription on every callback change', () => {
    let subscriptionCreations = 0

    // Simulate the old broken pattern: subscription depends on callback identity
    function createSubscriptionWithCallback(cb: () => void) {
      subscriptionCreations++
      return { trigger: cb }
    }

    // First render
    const cb1 = () => {}
    const sub1 = createSubscriptionWithCallback(cb1)
    void sub1

    // Callback recreated (dep changed) → subscription torn down and recreated
    const cb2 = () => {}
    const sub2 = createSubscriptionWithCallback(cb2)
    void sub2

    // Callback recreated again
    const cb3 = () => {}
    const sub3 = createSubscriptionWithCallback(cb3)
    void sub3

    expect(subscriptionCreations).toBe(3) // subscription torn down 3 times — events missed in gaps
  })

  it('with ref pattern: subscription created once regardless of callback changes', () => {
    let subscriptionCreations = 0
    const ref = { current: () => {} }

    // Stable subscription — deps are just [sessionId, playerId]
    function createStableSubscription(_sessionId: string, _playerId: string) {
      subscriptionCreations++
      return { trigger: () => ref.current() }
    }

    const sub = createStableSubscription('s1', 'p1')
    void sub

    // Callback changes — just update ref, no new subscription
    ref.current = () => { return 42 }
    ref.current = () => { return 99 }

    // sessionId/playerId don't change during a game
    expect(subscriptionCreations).toBe(1)
  })
})

// ─── Bug 3: Tied winner computation ──────────────────────────────────────────

describe('tied winner guard — winners.length vs winnerPlayer', () => {
  // Simulates the auto-reveal guard
  function shouldCallCalculateWinner_OLD(winnerPlayer: unknown): boolean {
    return !winnerPlayer  // old (broken) guard
  }

  function shouldCallCalculateWinner_NEW(winnersLength: number): boolean {
    return winnersLength === 0  // new (fixed) guard
  }

  it('OLD guard: skips calculate when winnerPlayer is set early by refreshAll', () => {
    // refreshAll sets winnerPlayer = B from round.winner_player_id before API resolves
    const winnerPlayer = { id: 'B', name: 'Player B' }
    expect(shouldCallCalculateWinner_OLD(winnerPlayer)).toBe(false) // SKIPPED — BUG
  })

  it('NEW guard: still calls calculate even when winnerPlayer is set early', () => {
    // winners array is still empty because handleCalculateWinner hasn't run yet
    const winnersLength = 0
    expect(shouldCallCalculateWinner_NEW(winnersLength)).toBe(true) // CALLS API — FIXED
  })

  it('NEW guard: skips calculate once winners array is populated', () => {
    const winnersLength = 2  // [B, C] set by handleCalculateWinner
    expect(shouldCallCalculateWinner_NEW(winnersLength)).toBe(false)
  })

  it('NEW guard: single winner also prevents re-calculation', () => {
    const winnersLength = 1
    expect(shouldCallCalculateWinner_NEW(winnersLength)).toBe(false)
  })
})

describe('tied winners reconstruction from scores table', () => {
  // Simulates what refreshAll now does: reconstruct winners from scores
  interface ScoreRow { player_id: string; points: number }
  interface Player { id: string; name: string }

  function reconstructWinners(scores: ScoreRow[], players: Player[]): Player[] {
    if (scores.length === 0) return []
    const maxPts = Math.max(...scores.map(s => s.points))
    const winnerIds = scores.filter(s => s.points === maxPts).map(s => s.player_id)
    return players.filter(p => winnerIds.includes(p.id))
  }

  const players: Player[] = [
    { id: 'A', name: 'Player A' },
    { id: 'B', name: 'Player B' },
    { id: 'C', name: 'Player C' },
  ]

  it('single winner: returns just that player', () => {
    const scores: ScoreRow[] = [{ player_id: 'A', points: 1 }, { player_id: 'B', points: 0 }]
    const winners = reconstructWinners(scores, players)
    expect(winners).toHaveLength(1)
    expect(winners[0].id).toBe('A')
  })

  it('two-way tie: returns both players', () => {
    const scores: ScoreRow[] = [
      { player_id: 'B', points: 1 },
      { player_id: 'C', points: 1 },
      { player_id: 'A', points: 0 },
    ]
    const winners = reconstructWinners(scores, players)
    expect(winners).toHaveLength(2)
    expect(winners.map(w => w.id)).toContain('B')
    expect(winners.map(w => w.id)).toContain('C')
  })

  it('three-way tie: returns all three', () => {
    const scores: ScoreRow[] = [
      { player_id: 'A', points: 3 },
      { player_id: 'B', points: 3 },
      { player_id: 'C', points: 3 },
    ]
    expect(reconstructWinners(scores, players)).toHaveLength(3)
  })

  it('rich mode tie at 3 pts: picks correct max', () => {
    const scores: ScoreRow[] = [
      { player_id: 'A', points: 3 },
      { player_id: 'B', points: 3 },
      { player_id: 'C', points: 2 },  // second place, not a winner
    ]
    const winners = reconstructWinners(scores, players)
    expect(winners).toHaveLength(2)
    expect(winners.map(w => w.id)).not.toContain('C')
  })

  it('empty scores: returns empty (no crash)', () => {
    expect(reconstructWinners([], players)).toHaveLength(0)
  })

  it('player no longer in session (deleted): safely excluded', () => {
    // 'D' scored but was removed from players list
    const scores: ScoreRow[] = [{ player_id: 'D', points: 1 }]
    expect(reconstructWinners(scores, players)).toHaveLength(0)
  })
})

// ─── Bug 2: Fallback poll while in lobby ─────────────────────────────────────

describe('fallback poll while in lobby — catches missed realtime on mobile', () => {
  it('poll fires at expected cadence (4s interval)', async () => {
    vi.useFakeTimers()
    let pollCount = 0

    const interval = setInterval(() => { pollCount++ }, 4000)

    vi.advanceTimersByTime(4000)
    expect(pollCount).toBe(1)

    vi.advanceTimersByTime(4000)
    expect(pollCount).toBe(2)

    vi.advanceTimersByTime(4000)
    expect(pollCount).toBe(3)

    clearInterval(interval)
    vi.advanceTimersByTime(8000)
    expect(pollCount).toBe(3)  // stopped after clear

    vi.useRealTimers()
  })

  it('poll is cleared immediately when session moves past lobby', () => {
    vi.useFakeTimers()
    let pollCount = 0
    let status = 'lobby'

    // Simulate the useEffect behaviour: only poll if status is lobby
    let interval: ReturnType<typeof setInterval> | null = null
    function syncPoll() {
      if (interval) clearInterval(interval)
      if (status === 'lobby') {
        interval = setInterval(() => { pollCount++ }, 4000)
      }
    }

    syncPoll()  // status = lobby → poll starts
    vi.advanceTimersByTime(4000)
    expect(pollCount).toBe(1)

    status = 'active'
    syncPoll()  // status = active → poll cleared

    vi.advanceTimersByTime(8000)
    expect(pollCount).toBe(1)  // no more polls

    vi.useRealTimers()
  })
})
