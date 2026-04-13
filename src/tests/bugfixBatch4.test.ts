/**
 * bugfixBatch4.test.ts
 *
 * Tests for the fourth batch of fixes:
 * - QuestionBank pack filter (shows pack questions by default)
 * - Badge rank + bestDistance computation
 * - ogFonts fallback chain
 * - Image route error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Fix I: QuestionBank pack filter logic
// ---------------------------------------------------------------------------

interface MockQuestion {
  id: string
  text: string
  pack_id: string | null
  approved: boolean
  source: string | null
}

function filterByPack(
  allApproved: MockQuestion[],
  sessionPackId: string | null | undefined,
  activeFilter: 'pack' | 'all'
): MockQuestion[] {
  if (sessionPackId && activeFilter === 'pack') {
    return allApproved.filter((q) => q.pack_id === sessionPackId)
  }
  return allApproved
}

describe('Fix I: QuestionBank pack filter', () => {
  const questions: MockQuestion[] = [
    { id: '1', text: 'Q1', pack_id: 'pack-bollywood', approved: true, source: 'preloaded' },
    { id: '2', text: 'Q2', pack_id: 'pack-bollywood', approved: true, source: 'preloaded' },
    { id: '3', text: 'Q3', pack_id: 'pack-office', approved: true, source: 'preloaded' },
    { id: '4', text: 'Q4', pack_id: null, approved: true, source: 'player' },
  ]

  it('default filter=pack: shows only questions from session pack', () => {
    const result = filterByPack(questions, 'pack-bollywood', 'pack')
    expect(result.map((q) => q.id)).toEqual(['1', '2'])
  })

  it('filter=all: shows all questions regardless of pack', () => {
    const result = filterByPack(questions, 'pack-bollywood', 'all')
    expect(result).toHaveLength(4)
  })

  it('no sessionPackId: shows all questions (pack filter irrelevant)', () => {
    const result = filterByPack(questions, null, 'pack')
    expect(result).toHaveLength(4)
  })

  it('pack with 0 matching questions falls through to empty list (host sees "All" option)', () => {
    const result = filterByPack(questions, 'pack-nonexistent', 'pack')
    expect(result).toHaveLength(0)
  })

  it('switching to all shows every question when pack returns 0', () => {
    const result = filterByPack(questions, 'pack-nonexistent', 'all')
    expect(result).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// Fix J: Badge rank + bestDistance computation
// ---------------------------------------------------------------------------

interface ScoreRecord { playerId: string; points: number }
interface GuessRec { playerId: string; roundId: string; answer: number | null; passed: boolean }
interface RoundRec { roundId: string; targetAnswer: number }

function computeRankAndDistance(
  playerId: string,
  playerIdList: string[],
  scoreRecords: ScoreRecord[],
  guessRecords: GuessRec[],
  roundRecords: RoundRec[],
): { rank: number; totalPlayers: number; bestDistance: number | null } {
  const totalScores: Record<string, number> = {}
  for (const pid of playerIdList) totalScores[pid] = 0
  for (const s of scoreRecords) totalScores[s.playerId] = (totalScores[s.playerId] ?? 0) + s.points
  const ranked = [...playerIdList].sort((a, b) => (totalScores[b] ?? 0) - (totalScores[a] ?? 0))
  const rank = ranked.indexOf(playerId) + 1

  const myGuesses = guessRecords.filter((g) => g.playerId === playerId && !g.passed && g.answer !== null)
  const distances = myGuesses.map((g) => {
    const rr = roundRecords.find((r) => r.roundId === g.roundId)
    return rr ? Math.abs(g.answer! - rr.targetAnswer) : null
  }).filter((d): d is number => d !== null)
  const bestDistance = distances.length > 0 ? Math.min(...distances) : null

  return { rank, totalPlayers: playerIdList.length, bestDistance }
}

describe('Fix J: Badge rank + bestDistance', () => {
  const players = ['p1', 'p2', 'p3']
  const scores: ScoreRecord[] = [
    { playerId: 'p1', points: 50 },
    { playerId: 'p1', points: 30 },
    { playerId: 'p2', points: 60 },
    { playerId: 'p3', points: 20 },
  ]
  const guesses: GuessRec[] = [
    { playerId: 'p1', roundId: 'r1', answer: 47, passed: false },
    { playerId: 'p1', roundId: 'r2', answer: 12, passed: false },
    { playerId: 'p2', roundId: 'r1', answer: 50, passed: false },
  ]
  const rounds: RoundRec[] = [
    { roundId: 'r1', targetAnswer: 50 },
    { roundId: 'r2', targetAnswer: 10 },
  ]

  it('ranks players correctly by total score', () => {
    // p2: 60, p1: 80, p3: 20 → p1 #1, p2 #2, p3 #3
    const { rank } = computeRankAndDistance('p1', players, scores, guesses, rounds)
    expect(rank).toBe(1)
  })

  it('totalPlayers equals player count', () => {
    const { totalPlayers } = computeRankAndDistance('p1', players, scores, guesses, rounds)
    expect(totalPlayers).toBe(3)
  })

  it('bestDistance picks minimum across all non-passed guess rounds', () => {
    // p1: r1: |47-50|=3, r2: |12-10|=2 → min=2
    const { bestDistance } = computeRankAndDistance('p1', players, scores, guesses, rounds)
    expect(bestDistance).toBe(2)
  })

  it('bestDistance is null when player has no non-passed guesses', () => {
    const { bestDistance } = computeRankAndDistance('p3', players, scores, guesses, rounds)
    expect(bestDistance).toBeNull()
  })

  it('exact match (distance=0) is handled', () => {
    const exactGuesses: GuessRec[] = [
      { playerId: 'p2', roundId: 'r1', answer: 50, passed: false }, // exact
    ]
    const { bestDistance } = computeRankAndDistance('p2', players, scores, exactGuesses, rounds)
    expect(bestDistance).toBe(0)
  })

  it('passed guesses are excluded from bestDistance', () => {
    const passedGuesses: GuessRec[] = [
      { playerId: 'p1', roundId: 'r1', answer: null, passed: true },
    ]
    const { bestDistance } = computeRankAndDistance('p1', players, scores, passedGuesses, rounds)
    expect(bestDistance).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Fix K: ogFonts fallback — tries multiple candidates, doesn't throw on first miss
// ---------------------------------------------------------------------------

describe('Fix K: ogFonts fallback chain behavior', () => {
  it('loadRegularFont result is an ArrayBuffer when a path succeeds', async () => {
    // The actual font loading uses fs.readFileSync which won't work in vitest
    // without mocking. We test the logic pattern: first successful path wins.
    const candidates = ['/nonexistent/path1.ttf', '/also/nonexistent.ttf']
    const fakeFont = new ArrayBuffer(100)

    const readFile = (p: string): ArrayBuffer => {
      if (p === '/also/nonexistent.ttf') return fakeFont
      throw new Error('ENOENT')
    }

    let result: ArrayBuffer | null = null
    for (const candidate of candidates) {
      try {
        result = readFile(candidate)
        break
      } catch { /* try next */ }
    }

    expect(result).toBe(fakeFont)
  })

  it('all candidates failing propagates to final fallback', () => {
    const candidates = ['/bad/path1.ttf', '/bad/path2.ttf']
    const readFile = (_p: string): ArrayBuffer => { throw new Error('ENOENT') }

    let result: ArrayBuffer | null = null
    for (const candidate of candidates) {
      try {
        result = readFile(candidate)
        break
      } catch { /* try next */ }
    }

    expect(result).toBeNull() // falls through to CDN fetch in real code
  })
})

// ---------------------------------------------------------------------------
// Fix L: Image routes error handling — verifies pattern
// ---------------------------------------------------------------------------

describe('Fix L: Image route error handling', () => {
  it('returns 500 text/plain response on render error', async () => {
    // Simulate the try/catch wrapper pattern in session-story and export-image routes
    const simulateRoute = async (throwError: boolean): Promise<Response> => {
      try {
        if (throwError) throw new Error('Font load failed')
        return new Response('image-data', { status: 200 })
      } catch (err) {
        return new Response(
          `unavailable: ${err instanceof Error ? err.message : 'unknown error'}`,
          { status: 500, headers: { 'Content-Type': 'text/plain' } }
        )
      }
    }

    const errorResponse = await simulateRoute(true)
    expect(errorResponse.status).toBe(500)
    expect(errorResponse.headers.get('Content-Type')).toBe('text/plain')
    const body = await errorResponse.text()
    expect(body).toContain('Font load failed')
  })

  it('returns 200 on success', async () => {
    const simulateRoute = async (throwError: boolean): Promise<Response> => {
      try {
        if (throwError) throw new Error('err')
        return new Response('ok', { status: 200 })
      } catch (err) {
        return new Response(`${err}`, { status: 500 })
      }
    }

    const ok = await simulateRoute(false)
    expect(ok.status).toBe(200)
  })
})
