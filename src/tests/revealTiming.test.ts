/**
 * revealTiming.test.ts
 *
 * Tests for adaptive reveal timing.
 * Key concern: for small groups (2-3 players) all cards may fall into
 * the "last 3" category — timing should still be correct and not crash.
 */

import { describe, it, expect } from 'vitest'
import { getAdaptiveRevealDelay } from '../lib/revealTiming'

describe('getAdaptiveRevealDelay', () => {
  it('last card always gets 2500ms', () => {
    expect(getAdaptiveRevealDelay(4, 5)).toBe(2500)   // index 4 = last of 5
    expect(getAdaptiveRevealDelay(9, 10)).toBe(2500)  // index 9 = last of 10
    expect(getAdaptiveRevealDelay(1, 2)).toBe(2500)   // index 1 = last of 2
    expect(getAdaptiveRevealDelay(0, 1)).toBe(2500)   // only card
  })

  it('second-to-last card gets 1500ms', () => {
    expect(getAdaptiveRevealDelay(3, 5)).toBe(1500)   // index 3 = 2nd last of 5
    expect(getAdaptiveRevealDelay(8, 10)).toBe(1500)
  })

  it('third-to-last card gets 1500ms', () => {
    expect(getAdaptiveRevealDelay(2, 5)).toBe(1500)   // index 2 = 3rd last of 5
    expect(getAdaptiveRevealDelay(7, 10)).toBe(1500)
  })

  it('early cards get 800ms', () => {
    expect(getAdaptiveRevealDelay(0, 10)).toBe(800)
    expect(getAdaptiveRevealDelay(1, 10)).toBe(800)
    expect(getAdaptiveRevealDelay(5, 10)).toBe(800)
    expect(getAdaptiveRevealDelay(6, 10)).toBe(800)
  })

  it('2-player game: first card (index 0) is 2nd-to-last → 1500ms', () => {
    // 2 total cards: index 0 = 2nd last, index 1 = last
    expect(getAdaptiveRevealDelay(0, 2)).toBe(1500)
    expect(getAdaptiveRevealDelay(1, 2)).toBe(2500)
  })

  it('3-player game: all 3 cards fall in last-3 category', () => {
    // 3 cards: index 0 = 3rd last → 1500ms, index 1 = 2nd last → 1500ms, index 2 = last → 2500ms
    expect(getAdaptiveRevealDelay(0, 3)).toBe(1500)
    expect(getAdaptiveRevealDelay(1, 3)).toBe(1500)
    expect(getAdaptiveRevealDelay(2, 3)).toBe(2500)
  })

  it('never returns 0 or negative', () => {
    for (let total = 1; total <= 12; total++) {
      for (let i = 0; i < total; i++) {
        expect(getAdaptiveRevealDelay(i, total)).toBeGreaterThan(0)
      }
    }
  })
})
