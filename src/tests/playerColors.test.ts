/**
 * playerColors.test.ts
 *
 * Tests for player color assignment by join-order index.
 * Colors are shown on every card in every round — a regression here
 * would cause crashes (undefined.bg) or visual corruption for 10+ player games.
 */

import { describe, it, expect } from 'vitest'
import { getPlayerColorByIndex } from '../lib/playerColors'

describe('getPlayerColorByIndex', () => {
  it('returns an object with bg, border, text, dot keys', () => {
    const color = getPlayerColorByIndex(0)
    expect(color).toHaveProperty('bg')
    expect(color).toHaveProperty('border')
    expect(color).toHaveProperty('text')
    expect(color).toHaveProperty('dot')
  })

  it('returns valid Tailwind class strings for bg, border, text', () => {
    for (let i = 0; i < 10; i++) {
      const c = getPlayerColorByIndex(i)
      expect(c.bg).toMatch(/^bg-/)
      expect(c.border).toMatch(/^border-/)
      expect(c.text).toMatch(/^text-/)
    }
  })

  it('dot is a valid hex color', () => {
    for (let i = 0; i < 10; i++) {
      expect(getPlayerColorByIndex(i).dot).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('first 10 indices return different colors (no duplicates)', () => {
    const dots = Array.from({ length: 10 }, (_, i) => getPlayerColorByIndex(i).dot)
    expect(new Set(dots).size).toBe(10)
  })

  it('index 10 wraps to same color as index 0 (cycling for 11+ players)', () => {
    expect(getPlayerColorByIndex(10).dot).toBe(getPlayerColorByIndex(0).dot)
  })

  it('index 11 wraps to same color as index 1', () => {
    expect(getPlayerColorByIndex(11).dot).toBe(getPlayerColorByIndex(1).dot)
  })

  it('handles large index without throwing', () => {
    expect(() => getPlayerColorByIndex(100)).not.toThrow()
    expect(getPlayerColorByIndex(100)).toBeTruthy()
  })

  it('all 12 players in a max-size game get a valid color object', () => {
    for (let i = 0; i < 12; i++) {
      const c = getPlayerColorByIndex(i)
      expect(c.bg).toBeTruthy()
      expect(c.dot).toBeTruthy()
    }
  })

  it('deterministic — same index always returns same color', () => {
    expect(getPlayerColorByIndex(3).dot).toBe(getPlayerColorByIndex(3).dot)
    expect(getPlayerColorByIndex(7).dot).toBe(getPlayerColorByIndex(7).dot)
  })
})
