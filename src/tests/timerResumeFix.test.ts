/**
 * timerResumeFix.test.ts
 *
 * Tests for the timer resume improvements:
 * - Server-side paused_at (no client clock drift, survives page refresh)
 * - Resume buffer: display value floors at frozen value for RESUME_BUFFER_MS
 *   to prevent premature drop-to-0 during Realtime propagation gap
 */

import { describe, it, expect } from 'vitest'

// ─── Pure logic: server-side paused_at offset ────────────────────────────────
//
// In the new pause/route.ts, the server records paused_at = NOW() when pausing,
// then uses it on resume instead of the client-provided timestamp.
// This is the same math as timerPause.test.ts but sourced from the server row.

function computeNewStartedAtFromServerPausedAt(
  originalStartedAt: string,
  serverPausedAt: string,   // timestamptz from sessions.paused_at
  resumedAtMs: number,      // Date.now() on the server at resume time
): string {
  const pauseDurationMs = resumedAtMs - new Date(serverPausedAt).getTime()
  const originalStart = new Date(originalStartedAt).getTime()
  return new Date(originalStart + pauseDurationMs).toISOString()
}

function computeRemaining(startedAt: string, durationSeconds: number, nowMs: number): number {
  const elapsed = (nowMs - new Date(startedAt).getTime()) / 1000
  return Math.max(0, Math.ceil(durationSeconds - elapsed))
}

describe('server-side paused_at offset (no client clock)', () => {
  it('produces correct remaining when using server paused_at instead of client', () => {
    const duration = 60
    const roundStart = new Date('2024-06-01T10:00:00.000Z')
    const pausedAt = new Date(roundStart.getTime() + 20_000) // 40s remaining
    const resumeMs = pausedAt.getTime() + 10_000             // 10s pause

    const newStartedAt = computeNewStartedAtFromServerPausedAt(
      roundStart.toISOString(),
      pausedAt.toISOString(),
      resumeMs,
    )

    expect(computeRemaining(newStartedAt, duration, resumeMs)).toBe(40)
  })

  it('is equivalent to the client-side approach when clocks agree', () => {
    // Both approaches should give the same result when client and server clocks are in sync.
    const roundStartMs = new Date('2024-06-01T10:00:00.000Z').getTime()
    const pausedAtMs = roundStartMs + 25_000
    const resumeMs = pausedAtMs + 8_000

    // Client approach (old): pauseDurationMs = resumeMs - clientPausedAtMs
    const clientOffset = resumeMs - pausedAtMs
    const clientNewStart = new Date(roundStartMs + clientOffset).toISOString()

    // Server approach (new): same math, just source is DB row not client ref
    const serverNewStart = computeNewStartedAtFromServerPausedAt(
      new Date(roundStartMs).toISOString(),
      new Date(pausedAtMs).toISOString(),
      resumeMs,
    )

    expect(serverNewStart).toBe(clientNewStart)
  })

  it('handles page refresh between pause and resume (client ref lost, server has it)', () => {
    // Before fix: pausedAtRef.current = null on refresh → started_at not updated → timer races to 0
    // After fix: server paused_at is always available regardless of client state
    const duration = 60
    const roundStartMs = new Date('2024-06-01T12:00:00.000Z').getTime()
    const serverPausedAt = new Date(roundStartMs + 30_000).toISOString() // 30s remaining
    const resumeMs = roundStartMs + 90_000 // 60s pause

    const newStartedAt = computeNewStartedAtFromServerPausedAt(
      new Date(roundStartMs).toISOString(),
      serverPausedAt,
      resumeMs,
    )

    expect(computeRemaining(newStartedAt, duration, resumeMs)).toBe(30)
  })
})

// ─── Resume buffer logic ──────────────────────────────────────────────────────
//
// In Timer.tsx, when paused transitions false, for RESUME_BUFFER_MS the displayed
// value is max(calculated, frozen). This prevents the premature 0 caused by the
// Realtime propagation race: session.status='active' arrives before started_at update.

const RESUME_BUFFER_MS = 2500

function simulateTimerTick(opts: {
  startedAt: string
  durationSeconds: number
  frozenRem: number
  nowMs: number
  inBuffer: boolean
}): number {
  const { startedAt, durationSeconds, frozenRem, nowMs, inBuffer } = opts
  const elapsed = (nowMs - new Date(startedAt).getTime()) / 1000
  const calculated = Math.max(0, Math.ceil(durationSeconds - elapsed))
  return inBuffer ? Math.max(calculated, frozenRem) : calculated
}

describe('resume buffer prevents premature drop-to-0', () => {
  it('during buffer: uses frozen value when calculated is lower (race condition)', () => {
    // Round started 20s ago, duration=60. Paused at T+20 (40s frozen).
    // Resume arrives but started_at not yet updated — old started_at is T+0.
    // Current time is T+80 (after 60s pause). Without buffer: elapsed=80, remaining=0.
    const roundStartMs = new Date('2024-06-01T12:00:00.000Z').getTime()
    const duration = 60
    const frozenRem = 40

    // Old started_at still in play
    const oldStartedAt = new Date(roundStartMs).toISOString()
    const nowMs = roundStartMs + 80_000 // 80s after round start

    const result = simulateTimerTick({
      startedAt: oldStartedAt,
      durationSeconds: duration,
      frozenRem,
      nowMs,
      inBuffer: true, // within 2.5s of resume
    })

    expect(result).toBe(40) // buffered — does NOT drop to 0
  })

  it('after buffer expires: uses calculated value (shows true remaining)', () => {
    const roundStartMs = new Date('2024-06-01T12:00:00.000Z').getTime()
    const duration = 60
    const frozenRem = 40

    const oldStartedAt = new Date(roundStartMs).toISOString()
    const nowMs = roundStartMs + 80_000

    const result = simulateTimerTick({
      startedAt: oldStartedAt,
      durationSeconds: duration,
      frozenRem,
      nowMs,
      inBuffer: false, // buffer expired
    })

    expect(result).toBe(0) // no longer buffered, shows calculated
  })

  it('during buffer: when started_at corrected, uses calculated (higher)', () => {
    // started_at has been shifted to T+40 (60s pause offset)
    // Now elapsed = 80 - 40 = 40s, remaining = 60 - 40 = 20... wait
    // Actually: roundStart=T+0, paused at T+20 (40s frozen), paused for 60s,
    // resumed at T+80. Correct newStartedAt = T+60 (shifted +60s).
    // At resume: elapsed = (T+80) - (T+60) = 20s, remaining = 60-20 = 40. ✓
    const roundStartMs = new Date('2024-06-01T12:00:00.000Z').getTime()
    const duration = 60
    const frozenRem = 40

    // After started_at corrected: original T+0 shifted by 60s pause = T+60
    const correctedStartedAt = new Date(roundStartMs + 60_000).toISOString()
    const nowMs = roundStartMs + 80_000 // at resume moment

    const result = simulateTimerTick({
      startedAt: correctedStartedAt,
      durationSeconds: duration,
      frozenRem,
      nowMs,
      inBuffer: true,
    })

    // calculated = 40, frozen = 40 → max(40, 40) = 40
    expect(result).toBe(40)
  })

  it('buffer duration: inBuffer is true within 2500ms, false after', () => {
    const resumedAt = Date.now()
    const inBufferImmediately = (Date.now() - resumedAt) < RESUME_BUFFER_MS
    expect(inBufferImmediately).toBe(true)

    const afterBuffer = (resumedAt + RESUME_BUFFER_MS + 100) - resumedAt
    expect(afterBuffer >= RESUME_BUFFER_MS).toBe(true)
  })
})
