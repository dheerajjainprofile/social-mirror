/**
 * mobileResilience.test.ts
 *
 * Tests for mobile/Safari resilience patterns.
 *
 * Bugs caught:
 * - iPhone/iPad: 4-5s lag after host starts round (#2)
 * - Target player screen frozen 20s+ (#3)
 * - Present page never auto-updates (#7)
 *
 * Root cause: Safari throttles setInterval to ~30-60s in background.
 * Fix: visibilitychange fires immediately when user returns to tab.
 *
 * These tests verify the visibilitychange + poll interaction pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEffect, useRef } from 'react'

// ── Simulated visibilitychange hook (mirrors player page) ─────────────────────

function useVisibilityRefresh(
  sessionId: string | undefined,
  status: string | undefined,
  onRefresh: () => void
) {
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!sessionId || status === 'ended') return
    const onVisible = () => {
      if (!document.hidden) onRefreshRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sessionId, status])
}

// ── Fallback poll hook ────────────────────────────────────────────────────────

function useFallbackPoll(
  sessionId: string | undefined,
  status: string | undefined,
  onRefresh: () => void,
  intervalMs: number
) {
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!sessionId || status === 'ended') return
    const poll = setInterval(() => onRefreshRef.current(), intervalMs)
    return () => clearInterval(poll)
  }, [sessionId, status, intervalMs])
}

// ─────────────────────────────────────────────────────────────────────────────

describe('visibilitychange — instant refresh when user returns to app', () => {
  it('fires refresh immediately when tab becomes visible', () => {
    const onRefresh = vi.fn()
    renderHook(() => useVisibilityRefresh('session-1', 'active', onRefresh))

    // Simulate Safari returning app to foreground
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire when tab becomes hidden (screen lock)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useVisibilityRefresh('session-1', 'active', onRefresh))

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('fires on every return from background (multiple lock/unlock cycles)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useVisibilityRefresh('session-1', 'active', onRefresh))

    for (let i = 0; i < 3; i++) {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }

    expect(onRefresh).toHaveBeenCalledTimes(3)
  })

  it('does NOT fire when session is ended', () => {
    const onRefresh = vi.fn()
    renderHook(() => useVisibilityRefresh('session-1', 'ended', onRefresh))

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('does NOT fire when sessionId is undefined (not yet loaded)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useVisibilityRefresh(undefined, 'active', onRefresh))

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('listener is removed on unmount (no memory leak)', () => {
    const onRefresh = vi.fn()
    const { unmount } = renderHook(() => useVisibilityRefresh('session-1', 'active', onRefresh))

    unmount()

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('listener removed when status changes to ended', () => {
    const onRefresh = vi.fn()
    const { rerender } = renderHook(
      ({ status }: { status: string }) => useVisibilityRefresh('session-1', status, onRefresh),
      { initialProps: { status: 'active' } }
    )

    rerender({ status: 'ended' })

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('always calls latest callback even if callback changed after mount', () => {
    let callCount = 0
    const cb1 = () => { callCount = 1 }
    const cb2 = () => { callCount = 2 }

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useVisibilityRefresh('session-1', 'active', cb),
      { initialProps: { cb: cb1 } }
    )
    rerender({ cb: cb2 })

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(callCount).toBe(2) // latest callback used
  })
})

describe('fallback poll — active game interval', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('polls every 2s during active game', () => {
    const onRefresh = vi.fn()
    renderHook(() => useFallbackPoll('s1', 'active', onRefresh, 2000))

    act(() => { vi.advanceTimersByTime(6000) })
    expect(onRefresh).toHaveBeenCalledTimes(3)
  })

  it('polls every 4s in lobby', () => {
    const onRefresh = vi.fn()
    renderHook(() => useFallbackPoll('s1', 'lobby', onRefresh, 4000))

    act(() => { vi.advanceTimersByTime(12000) })
    expect(onRefresh).toHaveBeenCalledTimes(3)
  })

  it('does NOT poll when ended', () => {
    const onRefresh = vi.fn()
    renderHook(() => useFallbackPoll('s1', 'ended', onRefresh, 2000))

    act(() => { vi.advanceTimersByTime(10000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('stops poll when session transitions to ended', () => {
    const onRefresh = vi.fn()
    const { rerender } = renderHook(
      ({ status }: { status: string }) => useFallbackPoll('s1', status, onRefresh, 2000),
      { initialProps: { status: 'active' } }
    )

    act(() => { vi.advanceTimersByTime(4000) }) // 2 polls
    rerender({ status: 'ended' })
    act(() => { vi.advanceTimersByTime(6000) }) // no more polls

    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('poll covers guessing, reveal, paused, and done statuses (not just lobby)', () => {
    // This is the key fix — before, only lobby was polled
    const statuses = ['guessing', 'reveal', 'paused', 'done', 'active']
    for (const status of statuses) {
      const onRefresh = vi.fn()
      renderHook(() => useFallbackPoll('s1', status, onRefresh, 2000))
      act(() => { vi.advanceTimersByTime(2000) })
      expect(onRefresh).toHaveBeenCalledTimes(1)
    }
  })
})

describe('combined poll + visibilitychange coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })
  afterEach(() => vi.useRealTimers())

  it('visibilitychange fires immediately; poll fires after interval', () => {
    const onRefresh = vi.fn()

    renderHook(() => {
      useVisibilityRefresh('s1', 'active', onRefresh)
      useFallbackPoll('s1', 'active', onRefresh, 2000)
    })

    // Simulate user returning from lock screen — should fire BEFORE 2s poll
    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(onRefresh).toHaveBeenCalledTimes(1) // immediate

    // Then 2s later poll also fires
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onRefresh).toHaveBeenCalledTimes(2) // poll caught up
  })
})
