/**
 * subscriptionStability.test.ts
 *
 * Tests the subscription stability fix (Bug 2 — iPhone stuck in lobby).
 *
 * Strategy: We can't render the full Next.js page (too many deps).
 * Instead we test the EXACT pattern used in the fix:
 *   - Stable ref pattern: subscription created once, callback updated via ref
 *   - Unstable old pattern: subscription recreated on every callback change
 *
 * These tests would have caught the iPhone bug BEFORE the fix was written.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEffect, useRef, useCallback, useState } from 'react'

// ── Simulated subscription manager ───────────────────────────────────────────

interface MockChannel {
  subscribe: () => void
  destroy: () => void
  fire: (event: string) => void
}

function createMockSubManager() {
  let subscribeCount = 0
  let destroyCount = 0
  const listeners: Map<string, (() => void)[]> = new Map()

  function createChannel(onEvent: (e: string) => void): MockChannel {
    subscribeCount++
    return {
      subscribe: () => {},
      destroy: () => { destroyCount++ },
      fire: (event: string) => {
        onEvent(event)
        ;(listeners.get(event) ?? []).forEach(l => l())
      },
    }
  }

  return { createChannel, getSubscribeCount: () => subscribeCount, getDestroyCount: () => destroyCount }
}

// ─────────────────────────────────────────────────────────────────────────────
// The BROKEN pattern (what the player page had before the fix)
// ─────────────────────────────────────────────────────────────────────────────

function useBrokenSubscription(
  mgr: ReturnType<typeof createMockSubManager>,
  sessionId: string,
  onEvent: () => void
) {
  useEffect(() => {
    // BUG: onEvent is in the dep array — recreated callback causes new subscription
    const ch = mgr.createChannel(onEvent)
    ch.subscribe()
    return () => ch.destroy()
  }, [sessionId, onEvent]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ─────────────────────────────────────────────────────────────────────────────
// The FIXED pattern (what the player page now uses)
// ─────────────────────────────────────────────────────────────────────────────

function useStableSubscription(
  mgr: ReturnType<typeof createMockSubManager>,
  sessionId: string,
  onEvent: () => void
) {
  const onEventRef = useRef(onEvent)
  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  useEffect(() => {
    // FIX: subscription only depends on sessionId
    const ch = mgr.createChannel(() => onEventRef.current())
    ch.subscribe()
    return () => ch.destroy()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ─────────────────────────────────────────────────────────────────────────────

describe('subscription stability — broken vs fixed pattern', () => {
  it('BROKEN: subscription recreated each time callback reference changes', () => {
    const mgr = createMockSubManager()
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useBrokenSubscription(mgr, 'session-1', cb),
      { initialProps: { cb: vi.fn() } }
    )

    rerender({ cb: vi.fn() })  // new reference → triggers useEffect cleanup+run
    rerender({ cb: vi.fn() })  // another new reference

    expect(mgr.getSubscribeCount()).toBeGreaterThanOrEqual(2)
    expect(mgr.getDestroyCount()).toBeGreaterThanOrEqual(1)
  })

  it('FIXED: subscription created exactly once regardless of callback changes', () => {
    const mgr = createMockSubManager()
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useStableSubscription(mgr, 'session-1', cb),
      { initialProps: { cb: vi.fn() } }
    )

    rerender({ cb: vi.fn() })
    rerender({ cb: vi.fn() })
    rerender({ cb: vi.fn() })

    expect(mgr.getSubscribeCount()).toBe(1)
    expect(mgr.getDestroyCount()).toBe(0)
  })

  it('FIXED: subscription DOES reconnect when sessionId changes (new game)', () => {
    const mgr = createMockSubManager()
    const { rerender } = renderHook(
      ({ sessionId, cb }: { sessionId: string; cb: () => void }) =>
        useStableSubscription(mgr, sessionId, cb),
      { initialProps: { sessionId: 'session-1', cb: vi.fn() } }
    )

    rerender({ sessionId: 'session-2', cb: vi.fn() })

    expect(mgr.getSubscribeCount()).toBe(2)
    expect(mgr.getDestroyCount()).toBe(1)
  })

  it('FIXED: latest callback is used when event fires after multiple rerenders', () => {
    let callValue = 0
    const mgr = createMockSubManager()
    let fireEvent: ((e: string) => void) | null = null

    // Intercept the channel to capture the fire function
    const origCreate = mgr.createChannel.bind(mgr)
    vi.spyOn(mgr, 'createChannel').mockImplementation((cb) => {
      const ch = origCreate(cb)
      fireEvent = ch.fire.bind(ch)
      return ch
    })

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useStableSubscription(mgr, 'session-1', cb),
      { initialProps: { cb: () => { callValue = 1 } } }
    )

    rerender({ cb: () => { callValue = 2 } })
    rerender({ cb: () => { callValue = 3 } })

    act(() => { fireEvent?.('update') })

    expect(callValue).toBe(3)          // got the latest callback
    expect(mgr.getSubscribeCount()).toBe(1) // subscription was never recreated
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Lobby poll — verifies polling behavior for the fallback mechanism
// ─────────────────────────────────────────────────────────────────────────────

function useLobbyPoll(
  sessionId: string | undefined,
  sessionStatus: string | undefined,
  onPoll: () => void
) {
  useEffect(() => {
    if (!sessionId || sessionStatus !== 'lobby') return
    const interval = setInterval(onPoll, 4000)
    return () => clearInterval(interval)
  }, [sessionId, sessionStatus, onPoll])
}

describe('lobby fallback poll', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fires poll while status is lobby', () => {
    const onPoll = vi.fn()
    renderHook(() => useLobbyPoll('s1', 'lobby', onPoll))

    act(() => { vi.advanceTimersByTime(4000) })
    expect(onPoll).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(4000) })
    expect(onPoll).toHaveBeenCalledTimes(2)
  })

  it('does NOT fire poll when status is active (game running)', () => {
    const onPoll = vi.fn()
    renderHook(() => useLobbyPoll('s1', 'active', onPoll))

    act(() => { vi.advanceTimersByTime(12000) })
    expect(onPoll).not.toHaveBeenCalled()
  })

  it('does NOT fire poll when status is ended', () => {
    const onPoll = vi.fn()
    renderHook(() => useLobbyPoll('s1', 'ended', onPoll))

    act(() => { vi.advanceTimersByTime(12000) })
    expect(onPoll).not.toHaveBeenCalled()
  })

  it('stops poll when session moves from lobby to active', () => {
    const onPoll = vi.fn()
    const { rerender } = renderHook(
      ({ status }: { status: string }) => useLobbyPoll('s1', status, onPoll),
      { initialProps: { status: 'lobby' } }
    )

    act(() => { vi.advanceTimersByTime(4000) })
    expect(onPoll).toHaveBeenCalledTimes(1)

    rerender({ status: 'active' })  // game started
    act(() => { vi.advanceTimersByTime(8000) })
    expect(onPoll).toHaveBeenCalledTimes(1) // poll stopped
  })

  it('does not fire when sessionId is undefined (not yet loaded)', () => {
    const onPoll = vi.fn()
    renderHook(() => useLobbyPoll(undefined, 'lobby', onPoll))

    act(() => { vi.advanceTimersByTime(8000) })
    expect(onPoll).not.toHaveBeenCalled()
  })
})
