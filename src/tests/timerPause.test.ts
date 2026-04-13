/**
 * timerPause.test.ts
 *
 * Tests for the pause/resume timer offset logic.
 * The bug: on resume, started_at was not adjusted for pause duration,
 * so the timer jumped backward by however many seconds the game was paused.
 *
 * The fix in pause/route.ts:
 *   newStartedAt = originalStart + pauseDurationMs
 *
 * These tests verify that math is correct and covers edge cases.
 */

import { describe, it, expect } from 'vitest'

// ─── Pure logic extracted from pause route ───────────────────────────────────

function computeNewStartedAt(
  originalStartedAt: string,
  pausedAt: number,
  resumedAt: number
): string {
  const pauseDurationMs = resumedAt - pausedAt
  const originalStart = new Date(originalStartedAt).getTime()
  return new Date(originalStart + pauseDurationMs).toISOString()
}

function computeRemainingAfterResume(
  newStartedAt: string,
  durationSeconds: number,
  checkAtMs: number
): number {
  const elapsed = (checkAtMs - new Date(newStartedAt).getTime()) / 1000
  return Math.max(0, Math.ceil(durationSeconds - elapsed))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('pause/resume timer offset', () => {
  it('timer resumes from same value after a pause', () => {
    const durationSeconds = 60
    const roundStart = new Date('2024-01-01T00:00:00.000Z').getTime()

    // Player pauses at T+20s (40s remaining)
    const pausedAt = roundStart + 20_000
    // Player resumes 15s later
    const resumedAt = pausedAt + 15_000

    const newStartedAt = computeNewStartedAt(
      new Date(roundStart).toISOString(),
      pausedAt,
      resumedAt
    )

    // Immediately after resume, remaining should still be ~40s
    const remaining = computeRemainingAfterResume(newStartedAt, durationSeconds, resumedAt)
    expect(remaining).toBe(40)
  })

  it('timer continues correctly after resume — 5s later shows 35s', () => {
    const durationSeconds = 60
    const roundStart = new Date('2024-01-01T00:00:00.000Z').getTime()
    const pausedAt = roundStart + 20_000
    const resumedAt = pausedAt + 15_000

    const newStartedAt = computeNewStartedAt(
      new Date(roundStart).toISOString(),
      pausedAt,
      resumedAt
    )

    // 5 seconds after resume
    const remaining = computeRemainingAfterResume(newStartedAt, durationSeconds, resumedAt + 5_000)
    expect(remaining).toBe(35)
  })

  it('long pause (5 min) still resumes from correct value', () => {
    const durationSeconds = 60
    const roundStart = new Date('2024-01-01T00:00:00.000Z').getTime()
    const pausedAt = roundStart + 30_000   // 30s elapsed, 30s remaining
    const resumedAt = pausedAt + 300_000   // paused for 5 minutes

    const newStartedAt = computeNewStartedAt(
      new Date(roundStart).toISOString(),
      pausedAt,
      resumedAt
    )

    const remaining = computeRemainingAfterResume(newStartedAt, durationSeconds, resumedAt)
    expect(remaining).toBe(30)
  })

  it('pause duration of 0ms (immediate resume) changes nothing', () => {
    const durationSeconds = 60
    const roundStart = new Date('2024-01-01T00:00:00.000Z').getTime()
    const pausedAt = roundStart + 20_000
    const resumedAt = pausedAt // immediate

    const newStartedAt = computeNewStartedAt(
      new Date(roundStart).toISOString(),
      pausedAt,
      resumedAt
    )

    // started_at should be unchanged
    expect(new Date(newStartedAt).getTime()).toBe(roundStart)
  })

  it('newStartedAt is always after originalStartedAt when paused > 0', () => {
    const roundStart = new Date('2024-01-01T00:00:00.000Z').getTime()
    const pausedAt = roundStart + 10_000
    const resumedAt = pausedAt + 5_000

    const newStartedAt = computeNewStartedAt(
      new Date(roundStart).toISOString(),
      pausedAt,
      resumedAt
    )
    expect(new Date(newStartedAt).getTime()).toBeGreaterThan(roundStart)
  })
})
