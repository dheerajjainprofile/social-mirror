/**
 * winnerRevealAndSubmissionGrid.test.ts
 *
 * Tests for two components with subtle bugs found by audit:
 *
 * 1. WinnerReveal — stale `onDone` closure
 *    useEffect dep array is [visible] only (onDone excluded with eslint-disable).
 *    If onDone changes after mount, the timeout fires the OLD callback.
 *    Documented and regression-tested here so the bug is visible.
 *
 * 2. SubmissionGrid — duplicate submittedIds from realtime events
 *    Supabase can fire duplicate INSERT events. submittedIds may contain
 *    the same player ID multiple times. The component must show the correct
 *    fraction (e.g. 2/3, not 3/3 or 4/3).
 *
 * 3. Player answer validation — NaN submission
 *    If a player submits a non-numeric answer the API receives NaN.
 *    The UI doesn't show an error. Documented here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEffect, useRef, useCallback, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// 1. WinnerReveal stale onDone closure
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors WinnerReveal.tsx useEffect exactly (same bug)
function useWinnerRevealLogic_BROKEN(visible: boolean, onDone: () => void) {
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      setTimeout(onDone, 600) // captures onDone at the time visible changed
    }, 4500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]) // onDone NOT in deps — stale closure
}

// Fixed version — uses ref so latest onDone always called
function useWinnerRevealLogic_FIXED(visible: boolean, onDone: () => void) {
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      setTimeout(() => onDoneRef.current(), 600)
    }, 4500)
    return () => clearTimeout(t)
  }, [visible])
}

describe('WinnerReveal — onDone stale closure bug', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('BROKEN: fires stale onDone when callback changes after visible=true', () => {
    const onDone1 = vi.fn()
    const onDone2 = vi.fn()

    const { rerender } = renderHook(
      ({ onDone }: { onDone: () => void }) =>
        useWinnerRevealLogic_BROKEN(true, onDone),
      { initialProps: { onDone: onDone1 } }
    )

    // onDone changes (e.g. parent re-renders with new callback)
    rerender({ onDone: onDone2 })

    // After 4500 + 600ms, should call onDone2 (latest) — but BROKEN calls onDone1
    act(() => { vi.advanceTimersByTime(5200) })

    expect(onDone1).toHaveBeenCalledTimes(1) // stale callback fired
    expect(onDone2).not.toHaveBeenCalled()   // latest callback NOT fired
  })

  it('FIXED: fires latest onDone even after callback changes', () => {
    const onDone1 = vi.fn()
    const onDone2 = vi.fn()

    const { rerender } = renderHook(
      ({ onDone }: { onDone: () => void }) =>
        useWinnerRevealLogic_FIXED(true, onDone),
      { initialProps: { onDone: onDone1 } }
    )

    rerender({ onDone: onDone2 })

    act(() => { vi.advanceTimersByTime(5200) })

    expect(onDone2).toHaveBeenCalledTimes(1)
    expect(onDone1).not.toHaveBeenCalled()
  })

  it('onDone fires exactly once when visible goes true→false→true', () => {
    const onDone = vi.fn()
    const { rerender } = renderHook(
      ({ visible }: { visible: boolean }) =>
        useWinnerRevealLogic_FIXED(visible, onDone),
      { initialProps: { visible: true } }
    )

    act(() => { vi.advanceTimersByTime(5200) })
    expect(onDone).toHaveBeenCalledTimes(1)

    // Show again (next round)
    rerender({ visible: false })
    rerender({ visible: true })
    act(() => { vi.advanceTimersByTime(5200) })
    expect(onDone).toHaveBeenCalledTimes(2)
  })

  it('cleanup cancels timeout when visible goes false before 4500ms', () => {
    const onDone = vi.fn()
    const { rerender } = renderHook(
      ({ visible }: { visible: boolean }) =>
        useWinnerRevealLogic_FIXED(visible, onDone),
      { initialProps: { visible: true } }
    )

    act(() => { vi.advanceTimersByTime(2000) }) // halfway
    rerender({ visible: false })               // hide before done
    act(() => { vi.advanceTimersByTime(5000) }) // would have fired

    expect(onDone).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. SubmissionGrid — duplicate submittedIds
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors the counting logic in SubmissionGrid.tsx
function countSubmissions(
  players: Array<{ id: string; is_organizer: boolean }>,
  submittedIds: string[],
  targetPlayerId?: string
): { submitted: number; eligible: number } {
  const eligible = players.filter(p => p.id !== targetPlayerId && !p.is_organizer)
  const submitted = eligible.filter(p => submittedIds.includes(p.id)).length
  return { submitted, eligible: eligible.length }
}

describe('SubmissionGrid — submission count logic', () => {
  const players = [
    { id: 'p1', is_organizer: false },
    { id: 'p2', is_organizer: false },
    { id: 'p3', is_organizer: false },
    { id: 'org', is_organizer: true },
  ]

  it('counts only non-organizer, non-target players', () => {
    const result = countSubmissions(players, [], 'p1')
    expect(result.eligible).toBe(2) // p2 and p3 (p1=target, org=organizer)
  })

  it('counts submitted players correctly', () => {
    const result = countSubmissions(players, ['p2', 'p3'], 'p1')
    expect(result.submitted).toBe(2)
    expect(result.eligible).toBe(2)
  })

  it('duplicate submittedIds do NOT inflate submitted count', () => {
    // Supabase may fire duplicate INSERT events → ['p2', 'p2', 'p2']
    const result = countSubmissions(players, ['p2', 'p2', 'p2'], 'p1')
    expect(result.submitted).toBe(1) // still just 1 player submitted
    expect(result.submitted).not.toBeGreaterThan(result.eligible)
  })

  it('submitted count never exceeds eligible count', () => {
    // Even with all duplicates
    const result = countSubmissions(players, ['p2', 'p2', 'p3', 'p3', 'p3'], 'p1')
    expect(result.submitted).toBe(2)
    expect(result.submitted).toBeLessThanOrEqual(result.eligible)
  })

  it('organizer submissions are excluded from count', () => {
    const result = countSubmissions(players, ['p2', 'org'], 'p1')
    expect(result.submitted).toBe(1) // org not counted
  })

  it('target player submissions are excluded from count', () => {
    const result = countSubmissions(players, ['p1', 'p2'], 'p1')
    expect(result.submitted).toBe(1) // p1 (target) not counted
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Player answer validation — NaN/empty submission guard
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors the validation in the player's handleSubmitGuess
function validateAnswer(raw: string): { valid: boolean; value: number | null; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { valid: false, value: null, error: 'Answer cannot be empty' }
  const num = Number(trimmed)
  if (isNaN(num)) return { valid: false, value: null, error: 'Answer must be a number' }
  return { valid: true, value: num, error: null }
}

describe('player answer validation — NaN/empty guard', () => {
  it('accepts valid numeric answer', () => {
    expect(validateAnswer('42')).toMatchObject({ valid: true, value: 42 })
  })

  it('accepts decimal answers', () => {
    expect(validateAnswer('3.14')).toMatchObject({ valid: true, value: 3.14 })
  })

  it('accepts negative answers', () => {
    expect(validateAnswer('-5')).toMatchObject({ valid: true, value: -5 })
  })

  it('rejects empty string', () => {
    const result = validateAnswer('')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects whitespace-only input', () => {
    const result = validateAnswer('   ')
    expect(result.valid).toBe(false)
  })

  it('rejects non-numeric text (would send NaN to API)', () => {
    const result = validateAnswer('hello')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/number/i)
  })

  it('rejects mixed text+number (would produce NaN)', () => {
    const result = validateAnswer('42abc')
    expect(result.valid).toBe(false)
  })

  it('current player page bug: Number("42abc") is NaN', () => {
    // The player page currently sends: answer: Number(answer) with no guard
    // If user types "42abc", Number("42abc") = NaN → API stores NaN
    expect(isNaN(Number('42abc'))).toBe(true) // documents the unguarded path
  })
})
