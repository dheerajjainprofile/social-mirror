/**
 * bugfixBatch8.test.ts
 *
 * Regression tests for the pre-party cleanup batch (April 2026 — second round):
 *
 *   A. /start page density — mobile-tight spacing tweaks
 *   B. Organizer guessing screen Skip button overflow (flex min-w-0 + shrink-0 + truncate)
 *   C. Organizer host guess input row (same min-w-0 + shrink-0 pattern)
 *   BUG-1. trigger-reveal auto-pass idempotency guard
 *   BUG-2. Join form double-tap re-entry guard
 *   BUG-3. calculate-winner score insert ordered before round status flip
 *   BUG-4. WinnerReveal onDoneRef pattern — no more stale onDone closure
 *   BUG-5. navigator.share AbortError handling (no cascade into clipboard fallback)
 *
 * These are primarily source-asserting tests that catch the regression patterns
 * directly, plus one pure-logic test for the 3-way exact match invariant.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calculateScores } from '../lib/utils'

const root = resolve(__dirname, '..', '..')
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')

// ─── Fix B — Skip button overflow ────────────────────────────────────────────

describe('#B organizer Reveal/Skip row does not overflow on mobile', () => {
  const src = read('src/app/room/[code]/organizer/page.tsx')

  // handleTriggerReveal is unique (only one call site). The Skip button lives
  // in the same flex row immediately after it. Scan forward from triggerReveal
  // to capture both buttons.
  const rowBlock = src.match(/onClick=\{handleTriggerReveal\}[\s\S]{0,900}handleSkipRound[\s\S]{0,400}<\/button>/)

  it('locates the Reveal+Skip row', () => {
    expect(rowBlock).not.toBeNull()
  })

  it('Reveal button has min-w-0 so flex-1 can actually shrink below content width', () => {
    expect(rowBlock![0]).toMatch(/flex-1 min-w-0/)
  })

  it('Reveal button has truncate to collapse long text gracefully', () => {
    expect(rowBlock![0]).toMatch(/truncate/)
  })

  it('Skip button has shrink-0 so it never gets squished out of the viewport', () => {
    // The Reveal/Skip row should contain `shrink-0 px-4 py-4` on the Skip button.
    expect(rowBlock![0]).toMatch(/shrink-0 px-4 py-4/)
  })

  it('Reveal button text scales text-base on mobile, text-lg on larger screens', () => {
    expect(rowBlock![0]).toMatch(/text-base sm:text-lg/)
  })
})

// ─── Fix C — Host guess input row same pattern ───────────────────────────────

describe('#C organizer host-guess row (input + Submit + Pass) does not overflow on mobile', () => {
  const src = read('src/app/room/[code]/organizer/page.tsx')

  it('host guess input has min-w-0 so flex-1 can shrink', () => {
    // Look for the input's className right after the onChange handler.
    expect(src).toMatch(/onChange=\{\(e\) => setOrgGuessInput[\s\S]{0,400}flex-1 min-w-0/)
  })

  it('host guess Submit button has shrink-0 and px-4 sm:px-5', () => {
    expect(src).toMatch(/shrink-0 px-4 sm:px-5 py-2 bg-purple-600/)
  })

  it('host guess Pass button has shrink-0 and px-3', () => {
    expect(src).toMatch(/shrink-0 px-3 py-2 bg-slate-700/)
  })
})

// ─── Fix A — /start page density tweaks ──────────────────────────────────────

describe('#A /start page uses Social Mirror design', () => {
  const src = read('src/app/start/page.tsx')

  it('uses warm cream background (Wrapped Energy)', () => {
    expect(src).toMatch(/FAF8F5/)
  })

  it('forces party preset automatically', () => {
    expect(src).toMatch(/setPreset\('party'\)/)
  })

  it('routes to mirror page', () => {
    expect(src).toMatch(/\/mirror\//)
  })

  it('stores mirror token for room', () => {
    expect(src).toMatch(/sm-token-/)
  })
})

// ─── BUG-1 — trigger-reveal idempotency guard ────────────────────────────────

describe('BUG-1 trigger-reveal is idempotent on rapid double-tap', () => {
  const src = read('src/app/api/trigger-reveal/route.ts')

  it('fetches rounds.status in the initial select', () => {
    expect(src).toMatch(/\.select\('session_id, target_player_id, status'\)/)
  })

  it('returns early if status is not "guessing" (round already revealed)', () => {
    expect(src).toMatch(/if \(roundCheck\.status !== 'guessing'\)/)
  })

  it('documents WHY the guard exists (comment mentions double-tap / duplicate)', () => {
    expect(src).toMatch(/Idempotency guard[\s\S]{0,400}double-tapped/)
  })

  it('fetches and returns the existing round row when guard trips (not re-running the insert)', () => {
    // Use a large fixed-length window instead of non-greedy `*?\}` because the
    // destructuring `{ data: existing }` inside the block contains braces.
    const guardBlock = src.match(/if \(roundCheck\.status !== 'guessing'\) \{[\s\S]{0,400}Response\.json\(\{ round: existing \}\)/)
    expect(guardBlock).not.toBeNull()
    expect(guardBlock![0]).toMatch(/\.from\('rounds'\)\.select\('\*'\)\.eq\('id', round_id\)/)
  })
})

// ─── BUG-2 — Join form double-tap re-entry guard ─────────────────────────────

describe('BUG-2 join form blocks re-entry while a submit is in flight', () => {
  const src = read('src/app/join/page.tsx')

  it('declares a submitInFlightRef', () => {
    expect(src).toMatch(/const submitInFlightRef = useRef\(false\)/)
  })

  it('handleSubmit bails immediately if ref is true', () => {
    expect(src).toMatch(/if \(submitInFlightRef\.current\) return/)
  })

  it('handleSubmit sets the ref to true before any async work', () => {
    // The ref.current = true assignment must come BEFORE `try {` so a re-entry can't sneak in.
    const handler = src.match(/const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?try \{/)
    expect(handler).not.toBeNull()
    expect(handler![0]).toMatch(/submitInFlightRef\.current = true/)
  })

  it('handleSubmit clears the ref in finally when not navigated away', () => {
    expect(src).toMatch(/if \(!navigated\) \{[\s\S]{0,100}submitInFlightRef\.current = false/)
  })
})

// ─── BUG-3 — calculate-winner score insert ordered before round status flip ──

describe('BUG-3 calculate-winner inserts scores before flipping round to done', () => {
  const src = read('src/app/api/calculate-winner/route.ts')

  it('scores insert block appears BEFORE the rounds status update', () => {
    const scoreInsertIdx = src.indexOf(".from('scores').insert(scoreInserts)")
    const doneUpdateIdx = src.search(/\.update\(\{ status: 'done', winner_player_id: winnerId \}\)/)
    expect(scoreInsertIdx).toBeGreaterThan(-1)
    expect(doneUpdateIdx).toBeGreaterThan(-1)
    expect(scoreInsertIdx).toBeLessThan(doneUpdateIdx)
  })

  it('comment documents the ordering requirement so nobody re-reverses it', () => {
    expect(src).toMatch(/Insert scores FIRST, then flip round status/)
  })
})

// ─── BUG-4 — WinnerReveal onDoneRef pattern ──────────────────────────────────

describe('BUG-4 WinnerReveal uses onDoneRef to avoid stale closure', () => {
  const src = read('src/components/WinnerReveal.tsx')

  it('declares an onDoneRef', () => {
    expect(src).toMatch(/const onDoneRef = useRef\(onDone\)/)
  })

  it('syncs onDoneRef.current on every onDone change', () => {
    expect(src).toMatch(/useEffect\(\(\) => \{ onDoneRef\.current = onDone \}, \[onDone\]\)/)
  })

  it('scheduled timeout invokes onDoneRef.current() not onDone directly', () => {
    expect(src).toMatch(/setTimeout\(\(\) => onDoneRef\.current\(\), 600\)/)
    expect(src).not.toMatch(/setTimeout\(onDone, 600\)/)
  })

  it('main useEffect no longer disables exhaustive-deps rule', () => {
    // With onDoneRef, the effect legitimately only depends on [visible].
    const effectBlock = src.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[visible\]\)/)
    expect(effectBlock).not.toBeNull()
    // Find the line with the visible dep array — should NOT have the disable comment above it
    expect(src).not.toMatch(/eslint-disable-next-line react-hooks\/exhaustive-deps[\s\S]{0,60}\[visible\]/)
  })
})

// ─── BUG-5 — navigator.share AbortError cascade fix ──────────────────────────

describe('BUG-5 organizer share button distinguishes AbortError from real failures', () => {
  const src = read('src/app/room/[code]/organizer/page.tsx')

  it('catch block around navigator.share checks for AbortError and returns', () => {
    expect(src).toMatch(/\(err as Error\)\?\.name === 'AbortError'\) return/)
  })

  it('comment explains why: user cancelled, don\'t cascade into clipboard fallback', () => {
    expect(src).toMatch(/User dismissed the share sheet/)
  })
})

// ─── Pure logic — 3-way exact match tie (new invariant test) ─────────────────

describe('scoring invariant: 3-way exact match tie all get max points', () => {
  it('rich mode — three players all exact-matching target get 3 pts each', () => {
    const result = calculateScores(
      [
        { playerId: 'A', answer: 42, submittedAt: '' },
        { playerId: 'B', answer: 42, submittedAt: '' },
        { playerId: 'C', answer: 42, submittedAt: '' },
      ],
      42,
      'rich'
    )
    expect(result).toHaveLength(3)
    for (const r of result) expect(r.points).toBe(3)
  })

  it('simple mode — three players all exact-matching get 1 pt each', () => {
    const result = calculateScores(
      [
        { playerId: 'A', answer: 42, submittedAt: '' },
        { playerId: 'B', answer: 42, submittedAt: '' },
        { playerId: 'C', answer: 42, submittedAt: '' },
      ],
      42,
      'simple'
    )
    expect(result).toHaveLength(3)
    for (const r of result) expect(r.points).toBe(1)
  })

  it('rich mode — 4 players where 3 are tied at exact match and 1 is off by 5', () => {
    const result = calculateScores(
      [
        { playerId: 'A', answer: 10, submittedAt: '' },
        { playerId: 'B', answer: 10, submittedAt: '' },
        { playerId: 'C', answer: 10, submittedAt: '' },
        { playerId: 'D', answer: 15, submittedAt: '' },
      ],
      10,
      'rich'
    )
    // A, B, C all tied at rank 0 → 3 pts
    // D at rank 1 → 2 pts
    expect(result.find((r) => r.playerId === 'A')?.points).toBe(3)
    expect(result.find((r) => r.playerId === 'B')?.points).toBe(3)
    expect(result.find((r) => r.playerId === 'C')?.points).toBe(3)
    expect(result.find((r) => r.playerId === 'D')?.points).toBe(2)
  })
})

// ─── General mobile-safety guards — catch future flex overflow regressions ───

describe('general mobile safety — flex rows with >1 child must guard against overflow', () => {
  it('organizer page has at least two `flex-1 min-w-0` usages (Reveal button + host input)', () => {
    const src = read('src/app/room/[code]/organizer/page.tsx')
    const matches = src.match(/flex-1 min-w-0/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  it('organizer page has at least three `shrink-0` usages on fixed-width flex children', () => {
    const src = read('src/app/room/[code]/organizer/page.tsx')
    const matches = src.match(/shrink-0 px-/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(3)
  })
})
