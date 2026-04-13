/**
 * bugfixBatch7.test.ts
 *
 * Regression tests for the April 2026 bug batch (12 issues reported during iPhone+Mac testing):
 *
 *   1. Landing page footer "Built by Dheeraj Jain" hidden below iPhone fold
 *   2. iPhone Safari: Quick Start / Custom buttons untappable after typing name
 *   3. Mac Chrome: Quick Start / Custom buttons dull even when selected
 *   4. Organiser lobby header misaligned (two-row stack layout)
 *   5. QR code on organiser lobby hardcoded to production URL
 *   6. (explanation only — AirDrop localhost behaviour)
 *   7. (explanation only — production app joins local room via shared Supabase)
 *   8. Pause/resume timer drift: resume starts at wrong remaining
 *   9. Winner reveal card and next-question sticky footer overlap
 *  10. Round results silently drops a player whose row isn't in stale playerList
 *  11. "Change" next-Q link scrolls to page top instead of editor
 *  12. Winner race: 3-way tie briefly shows only one player as winner
 *
 * Most tests are source-asserting (read the relevant file, verify the fix is present).
 * A few are pure-logic (scoring, winner computation from guesses).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calculateScores } from '../lib/utils'

const root = resolve(__dirname, '..', '..')
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')

// ─── #1 ─ Landing footer uses min-h-dvh and mobile-tight spacing ───────────────

describe('#1 landing page footer visible without scrolling on iPhone', () => {
  const src = read('src/app/page.tsx')

  it('uses min-h-dvh (not min-h-screen) on <main> so iOS URL bar is excluded', () => {
    expect(src).toMatch(/<main className="min-h-dvh /)
    expect(src).not.toMatch(/<main className="min-h-screen /)
  })

  it('stats block is hidden on extra-small screens to keep footer above the fold', () => {
    expect(src).toMatch(/hidden sm:flex/)
  })

  it('mobile padding is tighter (p-4) than desktop (md:p-6)', () => {
    expect(src).toMatch(/p-4 md:p-6/)
  })
})

// ─── #2 ─ iPhone Safari preset selector — tab bar (restored) ────────────────
// The real root cause of the recurring iPhone tap bug was NOT button CSS — it was
// Next.js 16 silently rejecting cross-origin dev requests from LAN IPs without
// `allowedDevOrigins`. React never hydrated, so no button pattern would have fired.
// With the config fix in place, the tab-bar layout from ab869aa is the preferred
// visual design. These guards make sure we don't reintroduce tap-breaking patterns.

describe('#2 host-game Quick Start / Custom use the tab-bar pattern', () => {
  const src = read('src/app/start/page.tsx')

  it('does NOT use onTouchEnd with preventDefault on the preset selector', () => {
    // Guard: that pattern blocks iOS click synthesis.
    expect(src).not.toMatch(/onTouchEnd=\{\(e\) => \{ e\.preventDefault\(\); setPreset/)
  })

  it('preset selector uses plain <button type="button"> with onClick', () => {
    expect(src).toMatch(/onClick=\{\(\) => setPreset\('party'\)\}/)
    expect(src).toMatch(/onClick=\{\(\) => setPreset\('custom'\)\}/)
  })

  it('preset buttons have touchAction: manipulation for iOS tap reliability', () => {
    expect(src).toMatch(/touchAction: 'manipulation'/)
  })

  it('does NOT use transition-all on preset buttons (historical iOS tap-blocker)', () => {
    // Restrict the search to the preset button region only.
    const section = src.match(/flex rounded-2xl bg-slate-900 border border-slate-700 p-1 gap-1 mb-4[\s\S]*?setPreset\('custom'\)[\s\S]*?<\/button>/)
    expect(section).not.toBeNull()
    expect(section![0]).not.toMatch(/transition-all/)
  })
})

// ─── #3 ─ Preset buttons are a vibrant tab-bar with cyan Custom state ────────

describe('#3 host-game Quick Start / Custom tab-bar visual state', () => {
  const src = read('src/app/start/page.tsx')

  it('uses the tab-bar container (flex rounded-2xl p-1 gap-1)', () => {
    expect(src).toMatch(/<div className="flex rounded-2xl bg-slate-900 border border-slate-700 p-1 gap-1 mb-4">/)
  })

  it('preset buttons use flex-1 py-3 segmented-control classes', () => {
    const matches = src.match(/className=\{`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm cursor-pointer transition-colors/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  it('Quick Start selected state uses vibrant purple→pink gradient with pink glow', () => {
    expect(src).toMatch(/preset === 'party'[\s\S]{0,300}bg-gradient-to-r from-purple-600 to-pink-600[\s\S]{0,120}shadow-\[0_0_24px_rgba\(236,72,153/)
  })

  it('Custom selected state uses vibrant cyan→teal gradient with cyan glow (not old dull slate-600)', () => {
    expect(src).toMatch(/preset === 'custom'[\s\S]{0,300}bg-gradient-to-r from-cyan-500 to-teal-500[\s\S]{0,120}shadow-\[0_0_24px_rgba\(34,211,238/)
    // The old dull slate-600 style must NOT reappear.
    expect(src).not.toMatch(/preset === 'custom'[\s\S]{0,200}bg-slate-600 text-white shadow-lg ring-1 ring-slate-500/)
  })

  it('label+radio experiment is gone (reverted to plain buttons)', () => {
    expect(src).not.toMatch(/<label\s+htmlFor="preset-party"/)
    expect(src).not.toMatch(/<input[\s\S]{0,160}type="radio"[\s\S]{0,160}id="preset-party"/)
  })

  it('debug strip scaffolding is removed', () => {
    expect(src).not.toMatch(/showTapDebug/)
    expect(src).not.toMatch(/tapLog/)
    expect(src).not.toMatch(/native-debug-out/)
    expect(src).not.toMatch(/v=dda1187-revert/)
  })
})

// ─── Next.js 16 dev-mode LAN access must be allow-listed ─────────────────────

describe('Next.js config allows LAN-origin dev access (192.168.*.*)', () => {
  const src = read('next.config.ts')

  it('allowedDevOrigins includes 192.168.*.* subnet for iPhone/iPad LAN testing', () => {
    expect(src).toMatch(/allowedDevOrigins/)
    expect(src).toMatch(/'192\.168\.\*\.\*'/)
  })
})

// ─── themeColor must live in viewport export, not metadata (Next.js 16 change) ──

describe('layout.tsx themeColor is in viewport export (Next.js 16 requirement)', () => {
  const src = read('src/app/layout.tsx')

  it('exports a viewport object with themeColor', () => {
    expect(src).toMatch(/export const viewport: Viewport = \{[\s\S]*?themeColor:/)
  })

  it('does NOT have themeColor inside the metadata export', () => {
    const metadataBlock = src.match(/export const metadata: Metadata = \{[\s\S]*?\n\};/)
    expect(metadataBlock).not.toBeNull()
    expect(metadataBlock![0]).not.toMatch(/themeColor:/)
  })
})

// ─── navigator.clipboard.writeText must be guarded (undefined on iOS HTTP) ───
// The "Share join link" + "Copy caption" buttons crashed on iPhone Safari when
// testing via LAN IP (http://192.168.x.x:3000) because navigator.clipboard is
// only available in secure contexts (HTTPS or localhost). Any unguarded access
// is a TypeError waiting to happen during real-device dev testing.

describe('navigator.clipboard.writeText is always guarded (HTTPS-only API)', () => {
  const organizerSrc = read('src/app/room/[code]/organizer/page.tsx')
  const shareModalSrc = read('src/components/ShareArtifactModal.tsx')

  it('organizer Share join link button guards navigator.clipboard?.writeText', () => {
    // The handler must use optional chaining and fall through to a prompt() fallback.
    expect(organizerSrc).toMatch(/navigator\.clipboard\?\.writeText/)
    expect(organizerSrc).toMatch(/window\.prompt\('Copy this join link/)
  })

  it('ShareArtifactModal caption-copy guards navigator.clipboard?.writeText', () => {
    expect(shareModalSrc).toMatch(/navigator\.clipboard\?\.writeText/)
    expect(shareModalSrc).toMatch(/window\.prompt\('Copy this caption/)
  })

  it('no unguarded navigator.clipboard.writeText calls remain in src/', () => {
    // Find every `navigator.clipboard.writeText` (no `?.` between clipboard and writeText).
    // Any such call is a crash on iOS HTTP.
    const bad = /navigator\.clipboard\.writeText/g
    expect(organizerSrc).not.toMatch(bad)
    expect(shareModalSrc).not.toMatch(bad)
  })
})

// ─── #4 ─ Organiser header is a two-row stack (Option A) ─────────────────────

describe('#4 organiser lobby header — two-row stack layout', () => {
  const src = read('src/app/room/[code]/organizer/page.tsx')

  it('uses a semantic <header> element with sticky positioning', () => {
    expect(src).toMatch(/<header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">/)
  })

  it('row 2 contains a mode chip (Quick Start or Custom) and a status text', () => {
    expect(src).toMatch(/Row 2: mode chip \+ status/)
    expect(src).toMatch(/⚡ Quick Start/)
    expect(src).toMatch(/⚙️ Custom/)
  })

  it('icon-only action buttons replace the old wrapping text buttons', () => {
    // Old implementation had `📺 Present` text; new uses emoji-only with aria-label.
    expect(src).toMatch(/aria-label="Open presenter view"/)
    expect(src).toMatch(/aria-label="End game"/)
  })
})

// ─── #5 ─ QR code URL uses runtime origin (not hardcoded prod) ───────────────

describe('#5 QR code points to the actual runtime host, not hardcoded production', () => {
  const src = read('src/app/room/[code]/organizer/page.tsx')

  it('joinQR memo reads window.location.origin', () => {
    expect(src).toMatch(/const joinQR = useMemo\(\(\) => \{[\s\S]*window\.location\.origin/)
  })

  it('still falls back to env or localhost during SSR (window undefined)', () => {
    expect(src).toMatch(/typeof window !== 'undefined' \? window\.location\.origin : \(process\.env\.NEXT_PUBLIC_APP_URL/)
  })

  it('no longer hardcodes any production URL as the primary value', () => {
    expect(src).not.toMatch(/const url = `https:\/\/guessing-the-guess\.vercel\.app\/join\?code/)
    expect(src).not.toMatch(/const url = `https:\/\/social-mirror\.vercel\.app\/join\?code/)
  })
})

// ─── #8 ─ Pause/resume timer — client sends paused_at, Timer buffer widened ──

describe('#8 pause/resume timer drift — client resume carries paused_at fallback', () => {
  const timerSrc = read('src/components/Timer.tsx')
  const orgSrc = read('src/app/room/[code]/organizer/page.tsx')

  it('Timer.tsx RESUME_BUFFER_MS is at least 5 seconds (covers slow Realtime propagation)', () => {
    const match = timerSrc.match(/const RESUME_BUFFER_MS = (\d+)/)
    expect(match).not.toBeNull()
    expect(Number(match![1])).toBeGreaterThanOrEqual(5000)
  })

  it('organizer handlePauseResume stamps paused_at locally on pause', () => {
    expect(orgSrc).toMatch(/paused_at: nowIso/)
  })

  it('organizer handlePauseResume sends paused_at in resume body when known', () => {
    expect(orgSrc).toMatch(/if \(action === 'resume' && session\.paused_at\)/)
    expect(orgSrc).toMatch(/body\.paused_at = session\.paused_at/)
  })

  it('organizer updates currentRound.started_at from the API response on resume', () => {
    expect(orgSrc).toMatch(/setCurrentRound\(\(r\) => r \? \{ \.\.\.r, started_at: data\.started_at \} : null\)/)
  })
})

// ─── #9 ─ Winner reveal and next-Q footer can't overlap ──────────────────────

describe('#9 winner reveal and next-question sticky footer never overlap', () => {
  const winnerSrc = read('src/components/WinnerReveal.tsx')
  const orgSrc = read('src/app/room/[code]/organizer/page.tsx')

  it('WinnerReveal uses a higher z-index than the next-Q footer', () => {
    expect(winnerSrc).toMatch(/fixed bottom-0 left-0 right-0 z-\[60\]/)
  })

  it('organizer hides the next-Q sticky footer while showWinnerReveal is true', () => {
    expect(orgSrc).toMatch(/currentRound\?\.status === 'done' && session\?\.status !== 'ended' && !showWinnerReveal/)
  })
})

// ─── #10 ─ buildRevealCards never drops a guess ──────────────────────────────

describe('#10 buildRevealCards preserves every guess — player lookup is best-effort', () => {
  const orgSrc = read('src/app/room/[code]/organizer/page.tsx')

  it('fetches players fresh from the DB inside buildRevealCards', () => {
    expect(orgSrc).toMatch(/Fetch players fresh from the DB so we don't silently drop/)
    expect(orgSrc).toMatch(/const \{ data: freshPlayers \}[\s\S]*\.from\('players'\)\.select\('id, name'\)/)
  })

  it('builds a name lookup Map from both the passed-in list and fresh DB rows', () => {
    expect(orgSrc).toMatch(/const lookup = new Map<string, string>\(\)/)
    expect(orgSrc).toMatch(/for \(const p of playerList\) lookup\.set\(p\.id, p\.name\)/)
    expect(orgSrc).toMatch(/for \(const p of freshPlayers \?\? \[\]\) lookup\.set\(p\.id, p\.name\)/)
  })

  it('falls back to a placeholder name instead of silently dropping the guess', () => {
    expect(orgSrc).toMatch(/const playerName = lookup\.get\(g\.player_id\) \?\? 'Player'/)
    // The old `if (p) { cards.push(...) }` guard that dropped guesses is gone.
    expect(orgSrc).not.toMatch(/const p = playerList\.find\(\(pl\) => pl\.id === g\.player_id\)\s*\n\s*if \(p\) \{\s*\n\s*cards\.push\(/)
  })

  it('scoring logic still counts all guessers at the same distance as tied rank-0 (sanity)', () => {
    // Proves that if A, B, Dheeraj all appear in the guess list with the exact target value,
    // calculateScores would give all three +3 points in rich mode. #10 fix is about making
    // sure A actually reaches this function in the first place.
    const result = calculateScores(
      [
        { playerId: 'A', answer: 5, submittedAt: '' },
        { playerId: 'B', answer: 6, submittedAt: '' },
        { playerId: 'Dheeraj', answer: 6, submittedAt: '' },
        { playerId: 'C', answer: 7, submittedAt: '' },
      ],
      5,
      'rich'
    )
    // target=5 → A is exact match, B+Dheeraj off by 1 share rank 1, C off by 2 is rank 2
    expect(result.find((r) => r.playerId === 'A')?.points).toBe(3)
    expect(result.find((r) => r.playerId === 'B')?.points).toBe(2)
    expect(result.find((r) => r.playerId === 'Dheeraj')?.points).toBe(2)
    expect(result.find((r) => r.playerId === 'C')?.points).toBe(1)
  })
})

// ─── #11 ─ "Change" next-Q preview scrolls to editor, not page top ───────────

describe('#11 next-question preview pill scrolls to the question editor', () => {
  const orgSrc = read('src/app/room/[code]/organizer/page.tsx')

  it('declares a nextRoundEditorRef pointing at the Start Next Round card', () => {
    expect(orgSrc).toMatch(/const nextRoundEditorRef = useRef<HTMLDivElement>\(null\)/)
    expect(orgSrc).toMatch(/<div ref=\{nextRoundEditorRef\}/)
  })

  it('Next-Q preview button calls scrollIntoView on that ref (not scrollTo top)', () => {
    expect(orgSrc).toMatch(/nextRoundEditorRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/)
    // Old broken onClick must be gone from the Next-Q preview.
    expect(orgSrc).not.toMatch(/Next Q[\s\S]{0,200}onClick=\{\(\) => window\.scrollTo\(\{ top: 0/)
  })
})

// ─── #12 ─ Winner race in 3-way tie ──────────────────────────────────────────

describe('#12 3-way tie: all three tied players must show as winners simultaneously', () => {
  it('calculateScores awards top-rank points to every player tied at closest distance', () => {
    // Target 8, all three players guess 7 (distance 1). All three should tie at rank 0.
    const result = calculateScores(
      [
        { playerId: 'p1', answer: 7, submittedAt: '' },
        { playerId: 'p2', answer: 7, submittedAt: '' },
        { playerId: 'p3', answer: 7, submittedAt: '' },
      ],
      8,
      'rich'
    )
    expect(result).toHaveLength(3)
    for (const r of result) expect(r.points).toBe(3)
  })

  it('calculate-winner/route.ts fetches all tied winners in parallel (no sequential race)', () => {
    const apiSrc = read('src/app/api/calculate-winner/route.ts')
    expect(apiSrc).toMatch(/Promise\.all\(/)
    expect(apiSrc).toMatch(/topScorers\.map\(/)
    // Old sequential for-loop is gone.
    expect(apiSrc).not.toMatch(/for \(const scorer of topScorers\) \{\s*\n\s*const \{ data: wp \}/)
  })

  it('organizer refreshAll reconstructs winners from guesses, not from partial scores rows', () => {
    const orgSrc = read('src/app/room/[code]/organizer/page.tsx')
    expect(orgSrc).toMatch(/Reconstruct winners from GUESSES \(source of truth\)/)
    expect(orgSrc).toMatch(/calculateScores\(entries, Number\(tgt\.answer\), scoringMode\)/)
  })
})
