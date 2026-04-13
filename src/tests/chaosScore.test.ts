import { describe, it, expect } from 'vitest'
import { calculateChaosScore } from '../lib/chaosScore'

describe('calculateChaosScore', () => {
  it('returns zero score and "No guesses" label when no valid guesses', () => {
    const result = calculateChaosScore([])
    expect(result.score).toBe(0)
    expect(result.label).toBe('No guesses')
    expect(result.totalGuesses).toBe(0)
  })

  it('ignores passed guesses', () => {
    const result = calculateChaosScore([
      { answer: null, passed: true, targetAnswer: 50 },
      { answer: null, passed: true, targetAnswer: 50 },
    ])
    expect(result.score).toBe(0)
    expect(result.totalGuesses).toBe(0)
  })

  it('calculates exact score correctly (avg distance = 0)', () => {
    const result = calculateChaosScore([
      { answer: 10, passed: false, targetAnswer: 10 },
      { answer: 10, passed: false, targetAnswer: 10 },
    ])
    expect(result.score).toBe(0)
    expect(result.label).toBe('Eerily accurate group')
    expect(result.emoji).toBe('🎯')
  })

  it('calculates average distance correctly', () => {
    // distances: |30-10|=20, |50-10|=40 → avg = 30
    const result = calculateChaosScore([
      { answer: 30, passed: false, targetAnswer: 10 },
      { answer: 50, passed: false, targetAnswer: 10 },
    ])
    expect(result.score).toBe(30)
    expect(result.label).toBe('Pretty good reads')
    expect(result.emoji).toBe('😊')
    expect(result.totalGuesses).toBe(2)
  })

  it('labels ≤20 as eerily accurate', () => {
    const result = calculateChaosScore([
      { answer: 10, passed: false, targetAnswer: 0 },
    ])
    expect(result.score).toBe(10)
    expect(result.label).toBe('Eerily accurate group')
  })

  it('labels 21-50 as pretty good reads', () => {
    const result = calculateChaosScore([
      { answer: 35, passed: false, targetAnswer: 0 },
    ])
    expect(result.score).toBe(35)
    expect(result.label).toBe('Pretty good reads')
  })

  it('labels 51-100 as respectably chaotic', () => {
    const result = calculateChaosScore([
      { answer: 75, passed: false, targetAnswer: 0 },
    ])
    expect(result.score).toBe(75)
    expect(result.label).toBe('Respectably chaotic')
    expect(result.emoji).toBe('😂')
  })

  it('labels >100 as absolute chaos', () => {
    const result = calculateChaosScore([
      { answer: 200, passed: false, targetAnswer: 0 },
    ])
    expect(result.score).toBe(200)
    expect(result.label).toBe('Absolute chaos')
    expect(result.emoji).toBe('💀')
  })

  it('mixes valid and passed guesses correctly', () => {
    // Only the non-passed guess counts: |20-10|=10
    const result = calculateChaosScore([
      { answer: 20, passed: false, targetAnswer: 10 },
      { answer: null, passed: true, targetAnswer: 10 },
    ])
    expect(result.score).toBe(10)
    expect(result.totalGuesses).toBe(1)
  })

  it('rounds the score to nearest integer', () => {
    // distances: 1, 2 → avg = 1.5 → rounds to 2
    const result = calculateChaosScore([
      { answer: 1, passed: false, targetAnswer: 0 },
      { answer: 2, passed: false, targetAnswer: 0 },
    ])
    expect(result.score).toBe(2)
  })
})
