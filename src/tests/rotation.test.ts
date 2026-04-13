/**
 * rotation.test.ts
 *
 * Tests for the auto-target rotation queue logic.
 * The bug: advanceRotation used setRotationQueue (async) then immediately
 * read rotationQueueRef.current — which hadn't updated yet. First player
 * kept getting selected every time.
 *
 * The fix: compute the new queue synchronously, update ref directly,
 * return the new queue so callers don't need to read the ref.
 *
 * These tests verify the rotation logic as a pure function.
 */

import { describe, it, expect } from 'vitest'

// ─── Pure rotation logic (mirrors organizer page advanceRotation) ─────────────

function advanceRotation(
  currentQueue: string[],
  completedTargetId: string,
  allPlayerIds: string[]
): string[] {
  let queue = [...currentQueue]
  const idx = queue.indexOf(completedTargetId)
  if (idx !== -1) queue.splice(idx, 1)

  if (queue.length === 0) {
    // Rebuild — exclude just-played target to avoid back-to-back
    queue = allPlayerIds.filter(id => id !== completedTargetId)
    // In real code this is shuffled; for tests keep deterministic
  }
  return queue
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('advanceRotation', () => {
  it('removes completed target from front of queue', () => {
    const queue = ['A', 'B', 'C']
    const result = advanceRotation(queue, 'A', ['A', 'B', 'C'])
    expect(result).toEqual(['B', 'C'])
  })

  it('removes completed target from middle of queue', () => {
    const queue = ['A', 'B', 'C']
    const result = advanceRotation(queue, 'B', ['A', 'B', 'C'])
    expect(result).toEqual(['A', 'C'])
  })

  it('next player in queue is the first element after advance', () => {
    const queue = ['A', 'B', 'C']
    const result = advanceRotation(queue, 'A', ['A', 'B', 'C'])
    expect(result[0]).toBe('B')
  })

  it('when queue empties, rebuilds without just-played player', () => {
    const queue = ['A'] // only A left
    const result = advanceRotation(queue, 'A', ['A', 'B', 'C'])
    expect(result).not.toContain('A')
    expect(result).toContain('B')
    expect(result).toContain('C')
  })

  it('rebuilt queue does not start with same player back-to-back', () => {
    const queue = ['A']
    const result = advanceRotation(queue, 'A', ['A', 'B', 'C'])
    expect(result[0]).not.toBe('A')
  })

  it('single player game — rebuilt queue is empty (no one else to target)', () => {
    const queue = ['A']
    const result = advanceRotation(queue, 'A', ['A'])
    expect(result).toHaveLength(0)
  })

  it('calling advanceRotation is synchronous — result available immediately', () => {
    // This test exists specifically because the original bug was reading
    // rotationQueueRef after a setRotationQueue (async) call.
    // The pure function must return the new queue directly.
    const queue = ['A', 'B', 'C']
    const result = advanceRotation(queue, 'A', ['A', 'B', 'C'])
    // Caller uses result directly, not a ref — no async issue
    expect(result).toBeDefined()
    expect(result[0]).toBe('B')
  })

  it('three rounds of rotation cycle through all players without repeat', () => {
    let queue = ['A', 'B', 'C']
    const allPlayers = ['A', 'B', 'C']
    const targets: string[] = []

    // Round 1: A is target
    targets.push(queue[0])
    queue = advanceRotation(queue, queue[0], allPlayers)

    // Round 2: B is target
    targets.push(queue[0])
    queue = advanceRotation(queue, queue[0], allPlayers)

    // Round 3: C is target
    targets.push(queue[0])
    queue = advanceRotation(queue, queue[0], allPlayers)

    expect(targets).toContain('A')
    expect(targets).toContain('B')
    expect(targets).toContain('C')
    expect(new Set(targets).size).toBe(3) // all unique
  })
})
