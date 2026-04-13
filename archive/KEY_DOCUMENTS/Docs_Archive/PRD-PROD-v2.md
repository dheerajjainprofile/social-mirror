# PRD-PROD-v2 — Guessing the Guess
## Production-Accurate Requirements Document — Version 2

**Version:** 2.0
**Date:** 2026-04-01
**Status:** Built — deployed on v2 branch, pending merge to main
**Branch:** v2
**Baseline:** PRD-PROD-v1 (read that first — this document only describes what is NEW or CHANGING in v2)
**Backlog items covered:** B04, B05, B07, B08, B09, B10, B13, B14, B18, B19, B20, B21, B22, B23, B24, B26, B27

---

## 1. What's New in v2

v2 is focused on three themes:

1. **Polish and identity** — Space Grotesk font, sounds, animations, player colours, round flash, LinkedIn branding.
2. **Player experience** — per-round rankings, new questions tray, feedback collection, shareable PNG export.
3. **Data quality + reliability** — duplicate name prevention, name standardisation, session cleanup, file-based questions, unit tests, CI.

Everything in PRD-PROD-v1 remains unchanged unless explicitly described below.

---

## 2. Backlog Items Delivered

| Backlog ID | Item | Priority | Status |
|-----------|------|----------|--------|
| B05 | Per-round ranking display | P1 | done |
| B07 | New questions tray for organizer | P1 | done |
| B09 | End-of-session feedback | P1 | done |
| B10 | Unit tests + CI + regression checklist | P1 | done |
| B18 | Duplicate player join prevention | P1 | done |
| B21 | Question bank DB cleanup (one-time task) | P1 | done |
| B22 | Delete player-submitted questions | P2 | done |
| B23 | Tie scoring test scenarios | P1 | done |
| B24 | File-based question management | P1 | done |
| B27 | Full visual identity overhaul | P1 | done |
| B04 | Shareable PNG export image | P2 | done |
| B08 | Landing page improvements | P2 | done |
| B13 | Workflow diagram (Mermaid) | P2 | done |
| B14 | Technical architecture diagram (Mermaid) | P2 | done |
| B19 | Player name standardisation | P2 | done |
| B20 | Abandoned session cleanup | P2 | done |
| B26 | Vercel Analytics | P2 | done (dashboard enable) |

---

## 3. Feature Specifications (as built)

---

### 3.1 Per-Round Ranking Display (B05)

**Component:** `src/components/RoundRanking.tsx`

After all reveal cards animate in, a ranked summary appears on all screens (player, organizer, present).

- Rows animate in 350ms apart, **worst first / winner last** for maximum drama
- Target player excluded (they answered, not guessed)
- Each row: medal (🥇🥈🥉 top 3), player name, fun label, distance number, +N pts
- Tied players share the same medal (dense ranking — two 🥇 for tied 1st)
- 🎪 Biggest miss badge on the player furthest from target (only shown if 2+ non-passed players)
- Passed players shown at bottom with "Passed" label

**Fun labels:**

| Distance | Label |
|----------|-------|
| 0 | 🎯 EXACT! |
| ≤ 5 | So close! |
| ≤ 20 | Not bad |
| ≤ 50 | Off track |
| > 50 | Way off 😬 |

**Scoring used:** `calculateScores()` from `src/lib/utils.ts` — dense ranking (tied players skip ranks, next player gets next available rank).

---

### 3.2 New Questions Tray for Organizer (B07)

**Component:** `src/components/QuestionBank.tsx`

A "New This Session" tray pinned above the main question list in the Question Bank panel.

- Shows approved questions added **after** the organizer's page loaded (tracked via `initialQuestionIds` snapshot taken at page load)
- Pulsing amber left-border accent + `●` indicator to catch the eye
- Questions appear within 5 seconds via existing 5s poll
- Click → selects question for next round (same as main list)
- ✕ button → dismisses from tray, moves to main list
- Tray hidden when empty

---

### 3.3 End-of-Session Feedback (B09)

**Component:** `src/components/FeedbackWidget.tsx`
**API:** `POST /api/submit-feedback`

Feedback widget on game-over screen for both players and organizer.

- Emoji rating: 😭 😐 😊 🤩 — required before submit
- Optional free-text textarea
- "Submit anonymously" checkbox — if checked, `player_name` stored as null
- Submit → "Thanks! 🙌" confirmation
- Always dismissible (✕ button, never blocking)
- Device type (mobile/desktop) and browser (Chrome/Firefox/Safari/Edge) parsed from user-agent server-side

**`feedback` table columns:** `id, emoji_rating, feedback_text, player_name (nullable), role, device_type, browser, room_code, scoring_mode, rounds_played, player_count, submitted_at`

---

### 3.4 Unit Tests + CI + Regression Checklist (B10)

**Test runner:** Vitest (`vitest.config.ts`)
**Test file:** `src/tests/utils.test.ts` — 18 tests

Covered:
- `generateRoomCode` — always 6 chars, no I/O/1/0, only uppercase + digits
- `calculateHotCold` — hot (<20%), warm (20–50%), cold (>50%), exact match, target=0 edge case
- `calculateScores` simple — basic, 2-way tie (both get 1pt), empty
- `calculateScores` rich — 3/2/1pts, 2-way tie for 1st (both 3pts), 3-way tie, partial tie for 2nd, all-same (all 3pts), single player, empty

**Bug found and fixed:** `calculateScores` rich mode used standard competition ranking (`rank = i`) instead of dense ranking (`rank++`). Fixed — tied 1st correctly gives next player 2pts not 1pt.

**CI:** `.github/workflows/test.yml` — runs on every push to v2 and main branches.

**Regression checklist:** `docs/regression-checklist.md` — 10 sections, ~5-10 min manual run.

---

### 3.5 Duplicate Player Join Prevention (B18)

**File:** `src/app/api/join-room/route.ts`

Fetches all existing players in the session in the same query as the max-12 count check. Compares `standardizedName.toLowerCase()` against each existing player name (case-insensitive).

Error returned: `"This name is already taken in this room. Please pick another."` (HTTP 400)

---

### 3.6 Delete Player-Submitted Questions (B22)

**Component:** `src/components/QuestionBank.tsx` — ✕ button on non-preloaded questions
**API:** `POST /api/delete-question`

- Delete button shown on both pending and approved questions where `source !== 'preloaded'`
- Server validates `source !== 'preloaded'` before deleting (returns 403 otherwise)
- Nulls out `rounds.question_id` FK references before deleting
- Browser confirm dialog before delete

---

### 3.7 File-Based Question Management (B24)

**File:** `data/questions.json` — 25 questions, 5 categories

```json
[{ "text": "...", "category": "habits" }, ...]
```

**Categories:** `habits` (12), `social` (8), `work` (2), `food` (1), `fun` (2)

**DB change:** `questions` table has new `category text` column (nullable, added via migration).

**Seed behaviour (wipe-and-reseed):**
- Nulls out `rounds.question_id` for any rounds referencing pre-loaded questions
- Deletes all rows where `source = 'preloaded'`
- Inserts fresh from `data/questions.json` with `source = 'preloaded'`, `approved = true`

**Editing questions:** Edit `data/questions.json` → commit → push → click "📦 Sample Qs" → fresh questions loaded.

---

### 3.8 Full Visual Identity Overhaul (B27)

**3.8.1 Typography**
- **Font:** Space Grotesk (Google Fonts) — replaces Geist. Applied globally in `layout.tsx`.

**3.8.2 Sound Design**
All sounds synthesized via Web Audio API in `src/lib/sounds.ts` — zero asset files.

| Sound | Trigger | Function |
|-------|---------|----------|
| Card reveal pop | Each reveal card animates in | `soundCardReveal()` |
| Guess submit ding | Player submits guess or target answer | `soundGuessSubmit()` |
| Winner chime | 4-note ascending (C5–E5–G5–C6) | `soundWinner()` |
| Crowd cheer | Bandpass white noise burst with confetti | `soundCrowd()` |
| Timer tick | Last 5 seconds of countdown | `soundTick()` |

**3.8.3 Player Colour Identity**
- `src/lib/playerColors.ts` — `getPlayerColor(playerId)` hashes player ID deterministically → one of 10 colours
- Applied as left-border accent on leaderboard rows

**3.8.4 Animated Leaderboard**
- Rows slide in with 80ms stagger on each update (`animate-lb-slide`)
- ↑N green / ↓N red position change indicators (fade after 2s)
- Leader gets 👑 instead of 🥇

**3.8.5 Round Start Flash**
- **Component:** `src/components/RoundStartFlash.tsx`
- Full-screen "ROUND N — LET'S GO! 🎯" overlay, 1.25s total (0.45s in + 0.35s out)
- Organizer: fires when round starts
- Players: fires when realtime detects a new round ID (not on initial page load)

**3.8.6 Micro-Animations (globals.css)**
- `button:active:not(:disabled)` → scale(0.96) bounce
- `animate-float` — floating background numbers (landing page)
- `animate-round-in/out` — round start flash
- `animate-lb-slide` — leaderboard row entrance
- `animate-winner-pop`, `animate-pos-up/down`, `animate-score-pulse`, `dot-pulse`

**3.8.7 Confetti duration extended to 5s** (was 4s)

---

### 3.9 Shareable PNG Export Image (B04)

**Route:** `GET /api/export-image/[code]` (edge runtime, `next/og`)
**Image:** 1200 × 630px

Layout:
- Header: game title + room code + date + stats (rounds, mode, players)
- Winner banner: "👑 [Name] knows their friends best!"
- Leaderboard: top 6 with medals + pts (purple accent on 1st)
- Callouts: 🎯 best guess (name + distance + label) + 😬 biggest miss (name + distance)
- "Can your group beat this?" + site URL
- Footer: Built by Dheeraj Jain · linkedin.com/in/dheerajjainprofile

**Organizer game-over screen:** "📸 Save Image" (primary button, opens in new tab) + "Export full results (.txt)" (text link, demoted)

---

### 3.10 Landing Page Improvements (B08)

Built as part of B27 session.

- **Floating numbers:** 8 numbers (42, 7, 100, 23, ½, 99, ∞, 13) drift in background via `animate-float` CSS — low opacity, purely decorative
- **Tagline:** "How well do you know your friends?" (replaces previous description)
- **Inline How-to-Play:** 5 emoji cards in horizontal scroll row, snap scrolling on mobile
- **Footer:** "Built by Dheeraj Jain" + LinkedIn link + "This site uses analytics"
- **Full rules overlay** kept for in-game reference

---

### 3.11 Player Name Standardisation (B19)

**Helper:** `toTitleCase(name)` in `src/lib/utils.ts`

Applied in both `create-room` and `join-room` API routes on save.
`"  dheeraj jain  "` → `"Dheeraj Jain"`

Duplicate check (B18) runs on the standardised name.

---

### 3.12 Abandoned Session Cleanup (B20)

**File:** `src/app/api/create-room/route.ts`

On every new session creation, marks sessions older than 24h with `status = 'active'` as `status = 'expired'`. Runs silently before the new session is created.

---

### 3.13 Vercel Analytics (B26)

Zero code change — enable from Vercel dashboard → Project → Analytics → Enable.

Landing page footer already contains "This site uses analytics" disclosure.

---

### 3.14 Workflow + Architecture Diagrams (B13, B14)

- `docs/workflow.md` — Mermaid session + round state machine, who-sees-what table, who-triggers-what table
- `docs/architecture.md` — Mermaid component diagram (pages → API routes → Supabase), key decisions table, data flow walkthrough

Both render automatically on GitHub.

---

## 4. Database Changes

### New table: `feedback`

```sql
CREATE TABLE feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  emoji_rating text NOT NULL,
  feedback_text text,
  player_name text,
  role text,
  device_type text,
  browser text,
  room_code text,
  scoring_mode text,
  rounds_played integer,
  player_count integer,
  submitted_at timestamptz DEFAULT now()
);
```

### Modified table: `questions`

```sql
ALTER TABLE questions ADD COLUMN IF NOT EXISTS category text;
```

---

## 5. New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/submit-feedback` | POST | Save feedback entry |
| `/api/export-image/[code]` | GET | Generate session PNG (edge runtime) |
| `/api/delete-question` | POST | Hard delete player-submitted question |

---

## 6. New Files

| Path | Purpose |
|------|---------|
| `data/questions.json` | Source of truth for pre-loaded questions |
| `src/lib/sounds.ts` | Web Audio API sound utilities |
| `src/lib/playerColors.ts` | Deterministic player colour assignment |
| `src/components/RoundRanking.tsx` | Per-round animated ranking display |
| `src/components/RoundStartFlash.tsx` | Full-screen round start overlay |
| `src/components/FeedbackWidget.tsx` | End-of-session feedback form |
| `src/app/api/submit-feedback/route.ts` | Feedback API |
| `src/app/api/delete-question/route.ts` | Question delete API |
| `src/app/api/export-image/[code]/route.tsx` | PNG export API |
| `src/tests/utils.test.ts` | 18 unit tests |
| `vitest.config.ts` | Vitest configuration |
| `.github/workflows/test.yml` | GitHub Actions CI |
| `docs/workflow.md` | State machine diagram |
| `docs/architecture.md` | Architecture diagram |
| `docs/regression-checklist.md` | Manual QA checklist |
| `docs/CHATGPT-suggestions.md` | Strategic product review for v3 planning |

---

## 7. Known Limitations (not fixed in v2)

- Timer is still visual-only — organizer can reveal at any time once target submits (B01 deferred to future)
- Reveal button still hard-requires target answer — no confirm-and-reveal-anyway option (B03 deferred)
- No audience/spectator mode for rooms > 12 players
- No quick-start presets — organizer still configures 5 fields at room creation
- No prompt-level analytics (see CHATGPT-suggestions.md for v3 thinking)
- `os` field in feedback table not populated (user-agent parsing limited to device + browser)

---

## 8. Definition of Done — v2

- [x] All P1 backlog items built and committed to v2 branch
- [x] Unit tests passing (18/18) in CI
- [x] Regression checklist written
- [x] B23 tie scenarios documented in regression checklist
- [ ] B23 tie scenarios manually verified on real devices
- [x] DB migrations run (category column + feedback table)
- [ ] Vercel Analytics enabled in dashboard
- [ ] v2 branch merged to main
- [ ] Vercel deploys successfully
- [ ] "📸 Save Image" verified on game-over screen
