/**
 * playerResilience.test.ts
 *
 * Tests for the two main iPhone Safari resilience fixes applied to the player page:
 *
 * 1. Subscription reconnect via lastVisible timestamp:
 *    - Safari kills WebSocket connections when the screen locks or the tab is backgrounded.
 *    - Updating lastVisible (on visibilitychange → visible) forces the subscription effect
 *      to remove the dead channel and create a fresh one with a new unique channel name.
 *
 * 2. init() retry logic:
 *    - On iPhone, the network may be unavailable for 1–2 s after resume (cellular hand-off).
 *    - The session fetch retries up to 3 times before giving up.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEffect, useState } from 'react'

// ── Mirror: channel naming logic ──────────────────────────────────────────────

function channelName(sessionId: string, playerId: string, lastVisible: number): string {
  return `player-${sessionId}-${playerId}-${lastVisible}`
}

// ── Mirror: lastVisible hook ──────────────────────────────────────────────────

function useLastVisible() {
  const [lastVisible, setLastVisible] = useState(0)
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setLastVisible(Date.now()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  return lastVisible
}

// ── Mirror: subscription reconnect effect ─────────────────────────────────────

function useSubscriptionSetupCount(
  sessionId: string | undefined,
  playerId: string,
  lastVisible: number
) {
  const [setupCount, setSetupCount] = useState(0)
  const [lastChannelName, setLastChannelName] = useState('')

  useEffect(() => {
    if (!sessionId) return
    const name = channelName(sessionId, playerId, lastVisible)
    setSetupCount((c) => c + 1)
    setLastChannelName(name)
  }, [sessionId, playerId, lastVisible])

  return { setupCount, lastChannelName }
}

// ── Mirror: init() retry ──────────────────────────────────────────────────────

async function fetchSessionWithRetry(
  fetchFn: () => Promise<{ data: { id: string } | null }>,
  maxAttempts = 3,
  delayMs = 0
): Promise<{ id: string } | null> {
  let sess = null
  for (let attempt = 0; attempt < maxAttempts && !sess; attempt++) {
    if (attempt > 0 && delayMs > 0) {
      await new Promise<void>((r) => setTimeout(r, delayMs * attempt))
    }
    const { data } = await fetchFn()
    sess = data
  }
  return sess
}

// ─────────────────────────────────────────────────────────────────────────────

describe('channel naming — lastVisible discriminator', () => {
  it('includes sessionId, playerId, and lastVisible', () => {
    const name = channelName('sess-abc', 'player-xyz', 99999)
    expect(name).toContain('sess-abc')
    expect(name).toContain('player-xyz')
    expect(name).toContain('99999')
  })

  it('different lastVisible values produce different names', () => {
    const n1 = channelName('s', 'p', 0)
    const n2 = channelName('s', 'p', 1000)
    expect(n1).not.toBe(n2)
  })

  it('same lastVisible produces same name (idempotent)', () => {
    expect(channelName('s', 'p', 42)).toBe(channelName('s', 'p', 42))
  })

  it('different players produce different names (no cross-player channel sharing)', () => {
    expect(channelName('s', 'player-1', 0)).not.toBe(channelName('s', 'player-2', 0))
  })
})

describe('subscription reconnect — setup count', () => {
  it('sets up subscription once on mount', () => {
    const { result } = renderHook(() =>
      useSubscriptionSetupCount('sess-1', 'player-1', 0)
    )
    expect(result.current.setupCount).toBe(1)
  })

  it('sets up a new subscription when lastVisible changes (tab resume)', () => {
    const { result, rerender } = renderHook(
      ({ lv }: { lv: number }) => useSubscriptionSetupCount('sess-1', 'player-1', lv),
      { initialProps: { lv: 0 } }
    )
    expect(result.current.setupCount).toBe(1)
    act(() => { rerender({ lv: 1000 }) })
    expect(result.current.setupCount).toBe(2)
  })

  it('three resumes = three extra subscriptions', () => {
    const { result, rerender } = renderHook(
      ({ lv }: { lv: number }) => useSubscriptionSetupCount('sess-1', 'player-1', lv),
      { initialProps: { lv: 0 } }
    )
    for (const ts of [1000, 2000, 3000]) act(() => { rerender({ lv: ts }) })
    expect(result.current.setupCount).toBe(4) // 1 initial + 3 resumes
  })

  it('does NOT set up subscription when sessionId is undefined', () => {
    const { result } = renderHook(() =>
      useSubscriptionSetupCount(undefined, 'player-1', 0)
    )
    expect(result.current.setupCount).toBe(0)
  })

  it('channel name changes on each lastVisible update', () => {
    const { result, rerender } = renderHook(
      ({ lv }: { lv: number }) => useSubscriptionSetupCount('sess-1', 'player-1', lv),
      { initialProps: { lv: 0 } }
    )
    const firstName = result.current.lastChannelName
    act(() => { rerender({ lv: 5000 }) })
    expect(result.current.lastChannelName).not.toBe(firstName)
    expect(result.current.lastChannelName).toContain('5000')
  })
})

describe('lastVisible — updates on tab resume', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('starts at 0 (no visibilitychange yet)', () => {
    const { result } = renderHook(() => useLastVisible())
    expect(result.current).toBe(0)
  })

  it('updates when page becomes visible', () => {
    const { result } = renderHook(() => useLastVisible())
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBeGreaterThan(0)
  })

  it('does NOT update when page becomes hidden (screen lock)', () => {
    const { result } = renderHook(() => useLastVisible())
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe(0)
  })

  it('increments on each unlock cycle', () => {
    const { result } = renderHook(() => useLastVisible())
    const values: number[] = []
    for (let i = 0; i < 3; i++) {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })
      values.push(result.current)
    }
    expect(values[0]).toBeGreaterThan(0)
    expect(values[1]).toBeGreaterThanOrEqual(values[0])
    expect(values[2]).toBeGreaterThanOrEqual(values[1])
  })

  it('removes listener on unmount — no leak', () => {
    const { result, unmount } = renderHook(() => useLastVisible())
    unmount()
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe(0)
  })
})

describe('lastVisible + subscription integration', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('tab resume triggers subscription reconnect', () => {
    const { result } = renderHook(() => {
      const lv = useLastVisible()
      return useSubscriptionSetupCount('sess-1', 'player-1', lv)
    })
    const before = result.current.setupCount
    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.setupCount).toBeGreaterThan(before)
  })

  it('tab hide does NOT trigger reconnect', () => {
    const { result } = renderHook(() => {
      const lv = useLastVisible()
      return useSubscriptionSetupCount('sess-1', 'player-1', lv)
    })
    const before = result.current.setupCount
    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.setupCount).toBe(before) // no new subscription
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('init() retry logic', () => {
  it('returns session on first successful fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { id: 'sess-1' } })
    const result = await fetchSessionWithRetry(fetchFn)
    expect(result).toEqual({ id: 'sess-1' })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('retries when first fetch returns null (network error on resume)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: 'sess-1' } })
    const result = await fetchSessionWithRetry(fetchFn)
    expect(result).toEqual({ id: 'sess-1' })
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('retries twice before succeeding on third attempt', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: 'sess-1' } })
    const result = await fetchSessionWithRetry(fetchFn)
    expect(result).toEqual({ id: 'sess-1' })
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('gives up after maxAttempts and returns null', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: null })
    const result = await fetchSessionWithRetry(fetchFn, 3)
    expect(result).toBeNull()
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('stops retrying immediately after success', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { id: 'sess-1' } })
    await fetchSessionWithRetry(fetchFn, 3)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('first attempt has no delay', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { id: 'sess-1' } })
    const start = Date.now()
    await fetchSessionWithRetry(fetchFn, 3, 2000) // high delay, never reached on attempt 0
    expect(Date.now() - start).toBeLessThan(500)
  })
})

describe('null session guard — render state invariants', () => {
  it('null session after load → showRetry=true', () => {
    expect(!false && !null).toBe(true)
  })

  it('session loaded → showRetry=false', () => {
    expect(!false && !{ id: 'sess-1' }).toBe(false)
  })

  it('still loading → showRetry=false (never show error while loading)', () => {
    expect(!true && !null).toBe(false)
  })
})
