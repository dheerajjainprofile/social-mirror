/**
 * nameAndCode.test.ts
 *
 * Tests for toTitleCase (used on every player join) and generateRoomCode.
 * Also tests formatNumber (shown in game UI for large numbers).
 *
 * These are used in every single session — regressions here would break
 * names on every game or corrupt room codes.
 */

import { describe, it, expect } from 'vitest'
import { toTitleCase, generateRoomCode, formatNumber } from '../lib/utils'

describe('toTitleCase', () => {
  it('capitalises first letter of each word', () => {
    expect(toTitleCase('dheeraj jain')).toBe('Dheeraj Jain')
  })

  it('lowercases the rest of each word', () => {
    expect(toTitleCase('JOHN DOE')).toBe('John Doe')
  })

  it('handles single word', () => {
    expect(toTitleCase('alice')).toBe('Alice')
  })

  it('trims leading and trailing whitespace', () => {
    expect(toTitleCase('  bob  ')).toBe('Bob')
  })

  it('handles mixed case', () => {
    expect(toTitleCase('dHeErAj')).toBe('Dheeraj')
  })

  it('handles multiple spaces between words (normalised by trim logic)', () => {
    // \S+ splits on non-whitespace, so multiple spaces are skipped
    const result = toTitleCase('john  doe')
    expect(result).toContain('John')
    expect(result).toContain('Doe')
  })

  it('empty string returns empty string', () => {
    expect(toTitleCase('')).toBe('')
  })

  it('single character', () => {
    expect(toTitleCase('a')).toBe('A')
  })

  it('numbers in name stay as-is', () => {
    expect(toTitleCase('player 2')).toBe('Player 2')
  })
})

describe('generateRoomCode', () => {
  it('always returns exactly 6 characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toHaveLength(6)
    }
  })

  it('never contains ambiguous chars I, O, 1, 0', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateRoomCode()).not.toMatch(/[IO10]/)
    }
  })

  it('only uppercase letters and digits', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toMatch(/^[A-Z2-9]+$/)
    }
  })

  it('has randomness — 20 codes are not all identical', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()))
    expect(codes.size).toBeGreaterThan(1)
  })

  it('uses only characters from the allowed set', () => {
    const allowed = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
    for (let i = 0; i < 100; i++) {
      for (const char of generateRoomCode()) {
        expect(allowed.has(char)).toBe(true)
      }
    }
  })
})

describe('formatNumber', () => {
  it('formats integer with no decimals', () => {
    // Intl.NumberFormat locale-dependent but should return a string with the digits
    const result = formatNumber(1000)
    expect(result).toContain('1')
    expect(result).toContain('000')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('returns a string', () => {
    expect(typeof formatNumber(42)).toBe('string')
  })

  it('handles large numbers', () => {
    const result = formatNumber(1000000)
    expect(result).toContain('1')
    expect(result.length).toBeGreaterThan(6) // should have separators
  })

  it('handles negative numbers', () => {
    const result = formatNumber(-500)
    expect(result).toContain('500')
  })
})
