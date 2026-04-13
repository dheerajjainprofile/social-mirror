/**
 * chaosScoreExtended.test.ts
 *
 * Extended tests for chaos score — covers getChaosLabel, getChaosEmoji,
 * all boundary values, mixed passed/guessed scenarios, and the full
 * getChaosScoreLabel composite function used in the session-story card.
 */

import { describe, it, expect } from 'vitest'
import { calculateChaosScore, getChaosLabel, getChaosEmoji, getChaosScoreLabel } from '../lib/chaosScore'

describe('getChaosLabel — all thresholds', () => {
  it('score 0 → Eerily accurate', () => {
    expect(getChaosLabel(0)).toBe('Eerily accurate group')
  })
  it('score 20 → Eerily accurate (boundary)', () => {
    expect(getChaosLabel(20)).toBe('Eerily accurate group')
  })
  it('score 21 → Pretty good reads', () => {
    expect(getChaosLabel(21)).toBe('Pretty good reads')
  })
  it('score 50 → Pretty good reads (boundary)', () => {
    expect(getChaosLabel(50)).toBe('Pretty good reads')
  })
  it('score 51 → Respectably chaotic', () => {
    expect(getChaosLabel(51)).toBe('Respectably chaotic')
  })
  it('score 100 → Respectably chaotic (boundary)', () => {
    expect(getChaosLabel(100)).toBe('Respectably chaotic')
  })
  it('score 101 → Absolute chaos', () => {
    expect(getChaosLabel(101)).toBe('Absolute chaos')
  })
  it('score 999 → Absolute chaos', () => {
    expect(getChaosLabel(999)).toBe('Absolute chaos')
  })
})

describe('getChaosEmoji — all thresholds', () => {
  it('score <= 20 → 🎯', () => {
    expect(getChaosEmoji(10)).toBe('🎯')
  })
  it('score 21-50 → 😊', () => {
    expect(getChaosEmoji(35)).toBe('😊')
  })
  it('score 51-100 → 😂', () => {
    expect(getChaosEmoji(75)).toBe('😂')
  })
  it('score > 100 → 💀', () => {
    expect(getChaosEmoji(150)).toBe('💀')
  })
})

describe('getChaosScoreLabel — composite function', () => {
  it('returns object with emoji, label, description', () => {
    const result = getChaosScoreLabel(30)
    expect(result).toHaveProperty('emoji')
    expect(result).toHaveProperty('label')
    expect(result).toHaveProperty('description')
  })

  it('all fields non-empty for every threshold region', () => {
    for (const score of [0, 20, 21, 50, 51, 100, 101, 500]) {
      const result = getChaosScoreLabel(score)
      expect(result.emoji.length).toBeGreaterThan(0)
      expect(result.label.length).toBeGreaterThan(0)
      expect(result.description.length).toBeGreaterThan(0)
    }
  })

  it('score <= 20 → Eerily Accurate label', () => {
    expect(getChaosScoreLabel(10).label).toBe('Eerily Accurate')
  })

  it('score > 100 → Beautiful Chaos label', () => {
    expect(getChaosScoreLabel(200).label).toBe('Beautiful Chaos')
  })
})

describe('calculateChaosScore — extended scenarios', () => {
  it('single valid guess computes correctly', () => {
    const result = calculateChaosScore([
      { answer: 60, passed: false, targetAnswer: 50 },
    ])
    expect(result.score).toBe(10)
    expect(result.totalGuesses).toBe(1)
  })

  it('multiple guesses — average distance', () => {
    const result = calculateChaosScore([
      { answer: 60, passed: false, targetAnswer: 50 },  // off by 10
      { answer: 30, passed: false, targetAnswer: 50 },  // off by 20
    ])
    expect(result.score).toBe(15) // (10+20)/2
  })

  it('passed guesses are excluded from calculation', () => {
    const result = calculateChaosScore([
      { answer: 10, passed: false, targetAnswer: 50 },   // off by 40
      { answer: null, passed: true, targetAnswer: 50 },  // ignored
    ])
    expect(result.score).toBe(40)
    expect(result.totalGuesses).toBe(1)
  })

  it('all passed → score 0, No guesses label', () => {
    const result = calculateChaosScore([
      { answer: null, passed: true, targetAnswer: 50 },
      { answer: null, passed: true, targetAnswer: 50 },
    ])
    expect(result.score).toBe(0)
    expect(result.label).toBe('No guesses')
  })

  it('exact guesses across multiple rounds → score 0', () => {
    const result = calculateChaosScore([
      { answer: 50, passed: false, targetAnswer: 50 },
      { answer: 75, passed: false, targetAnswer: 75 },
      { answer: 30, passed: false, targetAnswer: 30 },
    ])
    expect(result.score).toBe(0)
  })

  it('totalGuesses counts only non-passed entries', () => {
    const result = calculateChaosScore([
      { answer: 40, passed: false, targetAnswer: 50 },
      { answer: null, passed: true, targetAnswer: 50 },
      { answer: 60, passed: false, targetAnswer: 50 },
    ])
    expect(result.totalGuesses).toBe(2)
  })

  it('returns a label from calculateChaosScore result', () => {
    const result = calculateChaosScore([
      { answer: 200, passed: false, targetAnswer: 50 }, // off by 150 → Beautiful Chaos
    ])
    expect(result.label).toBe('Absolute chaos')
  })
})
