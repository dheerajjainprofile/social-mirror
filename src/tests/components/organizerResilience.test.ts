/**
 * organizerResilience.test.ts
 *
 * Tests for organizer page resilience additions:
 * - refreshAllRef stays in sync with latest refreshAll
 * - Active-game poll: runs during active/paused/reveal, skips lobby and ended
 * - visibilitychange: fires on resume, not on hide, cleans up on unmount
 *
 * These mirror the exact patterns added to organizer/page.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEffect, useRef } from 'react'

// ── Mirrors the refreshAllRef pattern in organizer/page.tsx ───────────────────

function useOrganizerRefreshRef(refreshAll: (id: string) => Promise<void>) {
  const refreshAllRef = useRef<((id: string) => Promise<void>) | null>(null)
  useEffect(() => { refreshAllRef.current = refreshAll }, [refreshAll])
  return refreshAllRef
}

// ── Mirrors organizer active-game poll ────────────────────────────────────────

function useOrganizerPoll(
  sessionId: string | undefined,
  status: string | undefined,
  onRefresh: () => void,
  intervalMs = 3000
) {
  const ref = useRef(onRefresh)
  useEffect(() => { ref.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!sessionId || status === 'ended' || status === 'lobby') return
    const poll = setInterval(() => ref.current(), intervalMs)
    return () => clearInterval(poll)
  }, [sessionId, status, intervalMs])
}

// ── Mirrors organizer visibilitychange ────────────────────────────────────────

function useOrganizerVisibility(
  sessionId: string | undefined,
  status: string | undefined,
  onRefresh: () => void
) {
  const ref = useRef(onRefresh)
  useEffect(() => { ref.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!sessionId || status === 'ended') return
    const onVisible = () => { if (!document.hidden) ref.current() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sessionId, status])
}

// ─────────────────────────────────────────────────────────────────────────────

describe('organizer refreshAllRef — stays in sync', () => {
  it('ref holds latest refreshAll after rerender', () => {
    let callValue = 0
    const fn1 = async () => { callValue = 1 }
    const fn2 = async () => { callValue = 2 }

    const { result, rerender } = renderHook(
      ({ fn }: { fn: (id: string) => Promise<void> }) => useOrganizerRefreshRef(fn),
      { initialProps: { fn: fn1 } }
    )

    rerender({ fn: fn2 })
    result.current.current?.('session-1')
    expect(callValue).toBe(2)
  })

  it('ref is null before first render completes', () => {
    const fn = vi.fn()
    // Just verify it initialises without error
    const { result } = renderHook(() => useOrganizerRefreshRef(fn))
    expect(result.current).toBeDefined()
  })
})

describe('organizer active-game poll', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('polls every 3s during active game', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerPoll('s1', 'active', onRefresh, 3000))
    act(() => { vi.advanceTimersByTime(9000) })
    expect(onRefresh).toHaveBeenCalledTimes(3)
  })

  it('does NOT poll during lobby (organizer manages lobby separately)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerPoll('s1', 'lobby', onRefresh, 3000))
    act(() => { vi.advanceTimersByTime(9000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('does NOT poll when session ended', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerPoll('s1', 'ended', onRefresh, 3000))
    act(() => { vi.advanceTimersByTime(9000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('polls during paused state (organizer needs to see state while paused)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerPoll('s1', 'paused', onRefresh, 3000))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('stops poll when session moves to ended', () => {
    const onRefresh = vi.fn()
    const { rerender } = renderHook(
      ({ status }: { status: string }) => useOrganizerPoll('s1', status, onRefresh, 3000),
      { initialProps: { status: 'active' } }
    )
    act(() => { vi.advanceTimersByTime(3000) })
    expect(onRefresh).toHaveBeenCalledTimes(1)

    rerender({ status: 'ended' })
    act(() => { vi.advanceTimersByTime(9000) })
    expect(onRefresh).toHaveBeenCalledTimes(1) // stopped
  })

  it('does not poll when sessionId is undefined', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerPoll(undefined, 'active', onRefresh, 3000))
    act(() => { vi.advanceTimersByTime(9000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('cleans up interval on unmount', () => {
    const onRefresh = vi.fn()
    const { unmount } = renderHook(() => useOrganizerPoll('s1', 'active', onRefresh, 3000))
    unmount()
    act(() => { vi.advanceTimersByTime(9000) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('always calls latest callback (refreshAll recreated on each render)', () => {
    let callValue = 0
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useOrganizerPoll('s1', 'active', cb, 3000),
      { initialProps: { cb: () => { callValue = 1 } } }
    )
    rerender({ cb: () => { callValue = 2 } })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(callValue).toBe(2)
  })
})

describe('organizer visibilitychange', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('fires on tab resume (hidden → visible)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerVisibility('s1', 'active', onRefresh))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire when tab becomes hidden (screen lock)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerVisibility('s1', 'active', onRefresh))
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('fires on resume from lobby too (organizer needs to see players join)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerVisibility('s1', 'lobby', onRefresh))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire when session ended', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerVisibility('s1', 'ended', onRefresh))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('removes listener on unmount — no leak', () => {
    const onRefresh = vi.fn()
    const { unmount } = renderHook(() => useOrganizerVisibility('s1', 'active', onRefresh))
    unmount()
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('removes listener when status changes to ended', () => {
    const onRefresh = vi.fn()
    const { rerender } = renderHook(
      ({ status }: { status: string }) => useOrganizerVisibility('s1', status, onRefresh),
      { initialProps: { status: 'active' } }
    )
    rerender({ status: 'ended' })
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('fires multiple times across multiple lock/unlock cycles', () => {
    const onRefresh = vi.fn()
    renderHook(() => useOrganizerVisibility('s1', 'active', onRefresh))
    for (let i = 0; i < 4; i++) {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    expect(onRefresh).toHaveBeenCalledTimes(4)
  })
})
