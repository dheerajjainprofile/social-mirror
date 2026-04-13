/**
 * hotCold.test.ts
 *
 * Tests for hot/cold hint logic — covers every branch including target=0.
 * Also tests the label/color helper functions used in the UI.
 * Hot-cold is shown on player screens during guessing — a wrong classification
 * would mislead players on every single round.
 */

import { describe, it, expect } from 'vitest'
import { calculateHotCold, hotColdColor, hotColdLabel } from '../lib/utils'

describe('calculateHotCold', () => {
  // ── Normal targets ─────────────────────────────────────────────────────────

  it('exact match is hot', () => {
    expect(calculateHotCold(50, 50)).toBe('hot')
  })

  it('within 20% → hot', () => {
    // 10% off — hot
    expect(calculateHotCold(90, 100)).toBe('hot')
    expect(calculateHotCold(110, 100)).toBe('hot')
    expect(calculateHotCold(81, 100)).toBe('hot') // 19% off
  })

  it('exactly 20% off → warm (boundary)', () => {
    // pctDiff = 20 → not < 20 → warm
    expect(calculateHotCold(80, 100)).toBe('warm')
    expect(calculateHotCold(120, 100)).toBe('warm')
  })

  it('between 20% and 50% → warm', () => {
    expect(calculateHotCold(60, 100)).toBe('warm')  // 40% off
    expect(calculateHotCold(140, 100)).toBe('warm') // 40% off
  })

  it('exactly 50% off → cold (boundary)', () => {
    expect(calculateHotCold(50, 100)).toBe('cold')
    expect(calculateHotCold(150, 100)).toBe('cold')
  })

  it('more than 50% off → cold', () => {
    expect(calculateHotCold(10, 100)).toBe('cold')
    expect(calculateHotCold(200, 100)).toBe('cold')
  })

  it('negative guess relative to positive target → uses absolute pctDiff', () => {
    // target=100, guess=-10 → diff=110 → 110% → cold
    expect(calculateHotCold(-10, 100)).toBe('cold')
  })

  it('large numbers work correctly', () => {
    // target=1000000, guess=950000 → 5% off → hot
    expect(calculateHotCold(950000, 1000000)).toBe('hot')
  })

  // ── Target = 0 edge case ──────────────────────────────────────────────────

  it('target=0, guess=0 → hot', () => {
    expect(calculateHotCold(0, 0)).toBe('hot')
  })

  it('target=0, guess within 1 → hot', () => {
    expect(calculateHotCold(0, 0)).toBe('hot')
    // diff < 1 → hot — only 0 satisfies this for integers
  })

  it('target=0, guess=3 → warm (diff < 5)', () => {
    expect(calculateHotCold(3, 0)).toBe('warm')
    expect(calculateHotCold(-3, 0)).toBe('warm')
  })

  it('target=0, guess=5 → cold (diff >= 5)', () => {
    expect(calculateHotCold(5, 0)).toBe('cold')
    expect(calculateHotCold(100, 0)).toBe('cold')
  })

  // ── Symmetry ───────────────────────────────────────────────────────────────

  it('symmetric: guess above and below target same distance → same rating', () => {
    expect(calculateHotCold(130, 100)).toBe(calculateHotCold(70, 100))
    expect(calculateHotCold(160, 100)).toBe(calculateHotCold(40, 100))
  })
})

describe('hotColdColor', () => {
  it('hot → red class', () => {
    expect(hotColdColor('hot')).toContain('red')
  })
  it('warm → yellow class', () => {
    expect(hotColdColor('warm')).toContain('yellow')
  })
  it('cold → blue class', () => {
    expect(hotColdColor('cold')).toContain('blue')
  })
  it('all three ratings return non-empty strings', () => {
    expect(hotColdColor('hot').length).toBeGreaterThan(0)
    expect(hotColdColor('warm').length).toBeGreaterThan(0)
    expect(hotColdColor('cold').length).toBeGreaterThan(0)
  })
})

describe('hotColdLabel', () => {
  it('hot → includes fire emoji', () => {
    expect(hotColdLabel('hot')).toContain('🔥')
  })
  it('warm → includes sun emoji', () => {
    expect(hotColdLabel('warm')).toContain('☀️')
  })
  it('cold → includes ice emoji', () => {
    expect(hotColdLabel('cold')).toContain('🧊')
  })
  it('all three return non-empty strings', () => {
    expect(hotColdLabel('hot').length).toBeGreaterThan(0)
    expect(hotColdLabel('warm').length).toBeGreaterThan(0)
    expect(hotColdLabel('cold').length).toBeGreaterThan(0)
  })
})
