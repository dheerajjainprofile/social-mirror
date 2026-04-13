# Product Requirements Document
# "Guessing the Guess" — Web App

**Version:** 2.0 (Post-Build, Reflects Actual Code)
**Date:** 2026-03-31
**Status:** Built & Deployed
**Original PRD:** guessing-the-guess-PRD.md (v1.0)

---

## 1. Overview

**Guessing the Guess** is a multiplayer social estimation game played on personal devices (phones/laptops) in a shared physical space. Players earn points not by knowing the correct answer, but by correctly predicting *how a specific person* would answer a question. It rewards social intelligence, humor, and knowing your friends.

---

## 2. Core Game Loop (as built)

1. **Organizer** creates a game room → gets a shareable **6-character room code**
2. **Players** join via `/join` using room code + enter their name (with "Remember my name" checkbox backed by localStorage)
3. **Any player** can submit questions to the question bank at any time — questions appear immediately (auto-approved) and are visible in the organizer's Question Bank with a 💬 player-submitted badge
4. **Only the Organizer** selects which question is used each round and picks the target player
5. **Target Player** secretly submits their real numeric answer (locked, not visible to others)
6. **All other players** secretly submit their best guess + optional reasoning; can also Pass
7. **Submission indicators** show green ✓ per player without revealing answers; organizer sees a private submission grid
8. **Organizer triggers reveal** — cards animate in one by one; target's answer drops in last
9. **Winner announced** — player numerically closest to Target's answer wins (ties: both receive equal points)
10. **Number line visualization** appears after all cards are revealed, showing every guess and the target on a distribution chart
11. **Scores updated**, next round begins

---

## 3. Player Roles (as built)

### Regular Player
- Join room via code (max 12 players per room)
- Submit secret numeric answer or Pass
- Add optional reasoning (shown during reveal if organizer has enabled it)
- View animated reveal on their own screen (real-time synced)
- Submit questions to the question bank from their player screen at any time
- See Hot/Cold hints during reveal (if organizer has enabled them)
- See winner trophy + number line after each round

### Organizer (Super Access)
- All player capabilities +
- Create room and configure all settings before game start:
  - Scoring mode (Simple / Rich)
  - Reveal mode (Organizer controls / Auto reveal)
  - Show/hide reasoning
  - Hot/Cold hints toggle (also toggleable mid-game)
  - Countdown timer per phase
- Choose which question to use each round (from bank or type custom)
- Designate target player per round
- Trigger reveal (manual pacing)
- **Toggle Hot/Cold hints on/off mid-game** — syncs in real-time to all player screens and the presentation view
- Skip a round (no points awarded)
- Remove a player from lobby
- Load 25 pre-loaded sample questions ("📦 Sample Qs" button)
- Approve player-submitted questions (pending → approved)
- Add/manage questions in the Question Bank
- Export full session summary (round-by-round, every guess, winner per round, final leaderboard)
- Open presentation screen (separate URL `/room/[code]/present`) to cast to TV/projector

---

## 4. Features (as built)

### 4.1 Room & Session Management
- Organizer creates room → 6-character alphanumeric code (e.g. `MANGO42`)
- Players join at `/join` or via shared link with `?code=XXXXXX` pre-filled
- Room persists until organizer explicitly ends the session
- **Max 12 players** enforced at join time (returns error if full)
- Player name entry with **"Remember my name"** checkbox (localStorage)
- Organizer can **remove players** from the lobby before game starts

### 4.2 Timer System
- Configurable countdown timer set by organizer during room creation (15s–180s slider)
- Visual countdown with progress bar shown on all screens during guessing phase
- Last 10 seconds: pulsing red animation + audio beep (Web Audio API)
- Timer stops displaying once player submits their answer

### 4.3 Anonymous Submission Indicator
- All screens show a grid of participant names with green ✓ when submitted
- Organizer's private view shows real-time submission count and per-player status
- Pass option: player can skip a round (shown as "Passed" during reveal, no points)
- Organizer sees "Waiting for [target name] to submit their answer" before reveal is enabled

### 4.4 Hot / Cold Hints
- Shows proximity bands during reveal phase (before target's answer drops):
  - 🧊 Cold — >50% off target
  - ☀️ Warm — 20–50% off target
  - 🔥 Hot — within 20% of target
- **Mid-game toggle**: organizer can turn Hot/Cold on/off with a button in the round view
- Toggle syncs in **real-time to all player screens and presentation view** via Supabase session update
- Configurable at room creation; also togglable during any active round

### 4.5 Reveal Animation
- Organizer manually triggers reveal
- Cards animate in one by one (slide-up + fade, 1.5s between each, 2s for last)
- Each card shows player name, answer, and reasoning (if enabled)
- Target player's answer always drops last
- **Winner badge (🏆)** and green border highlighted on the closest guess card
- **Number line visualization** appears after all cards are revealed — shows all guesses and target answer distributed on a horizontal axis with player labels, color-coded by role (winner = green, target = yellow, others = purple)
- Confetti blast fires for the winning player on their own device

### 4.6 Scoring System

**Simple Mode:**
- Closest guess wins 1 point
- Running tally shown after each round

**Rich Mode:**
- 1st closest → 3 points
- 2nd closest → 2 points
- 3rd closest → 1 point

**Tie-breaking (v2 change from PRD v1):**
- In case of a tie (two or more players submit the exact same guess), **all tied players receive equal points**
- Example: two players both guess 47 when target is 47 → both get 3 points in Rich mode
- The winner banner shows "X & Y tie this round!" for multi-winner rounds

### 4.7 Organizer: Two-Screen Mode
- **Private View** (`/room/[code]/organizer`): All controls, submission status, real-time data
- **Public/Presentation View** (`/room/[code]/present`): Clean display safe to cast to TV/projector
  - Shows room code prominently in lobby
  - Shows question, target player, submission progress during guessing
  - Shows animated reveal, winner banner, number line, and leaderboard
  - Reacts in real-time to organizer's actions (reveal trigger, hot/cold toggle, etc.)

### 4.8 Question Bank
- **25 pre-loaded questions** available via "📦 Sample Qs" button (funny, social estimation questions — phone habits, daily behaviors, social facts)
- **Living bank:** Any player can submit questions from their player screen at any time using the "📝 Add to Question Bank" form at the bottom of their screen
- Player-submitted questions are **auto-approved** and appear immediately in the organizer's bank with a `💬 submitted by [name]` badge so the organizer can identify the source
- Organizer can also add questions via the Question Bank panel (always auto-approved)
- A "Pending Approval" section exists for questions where `approved = false` (future workflow support)
- Questions persist globally in DB across all sessions
- Organizer selects questions from the bank OR types a custom question per round

### 4.9 Reasoning Field
- Optional text field shown when players submit their guess
- Toggled on/off by organizer during room creation (`show_reasoning` setting)
- Displayed on reveal cards during reveal phase
- Max ~150 chars (enforced by input length)

### 4.10 Skip Round
- Organizer can skip any round during the guessing phase
- Confirms before skipping
- Round is marked done with no winner and no points awarded
- Exported summary shows "Winner: None (skipped)"

### 4.11 Export & Session History
- End-of-game export button produces a `.txt` file with:
  - Session metadata (room code, date, organizer, scoring mode)
  - Final leaderboard with total points
  - **Round-by-round breakdown**: question, target player, every player's guess + reasoning, target's actual answer, round winner
- All session data persisted in Supabase for future analysis

### 4.12 How to Play
- 5-step "How to Play" overlay accessible from every player screen
- Covers room creation → joining → target/guessing → reveal → scoring
- Close by clicking overlay or "Got it" button

---

## 5. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React) + App Router |
| Realtime sync | Supabase Realtime (postgres_changes subscriptions) |
| Backend/DB | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Styling | Tailwind CSS v4 |
| Confetti | canvas-confetti |

---

## 6. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/create-room` | POST | Create session, organizer player |
| `/api/join-room` | POST | Join session as player (max 12 enforced) |
| `/api/start-round` | POST | Start a new round |
| `/api/submit-answer` | POST | Target player submits real answer |
| `/api/submit-guess` | POST | Player submits guess (or passes) |
| `/api/trigger-reveal` | POST | Organizer triggers reveal phase |
| `/api/calculate-winner` | POST | Auto-called after last card reveals |
| `/api/skip-round` | POST | Skip round with no winner |
| `/api/add-question` | POST | Add question to bank |
| `/api/approve-question` | POST | Mark pending question as approved |
| `/api/seed-questions` | POST | Insert 25 pre-loaded sample questions |
| `/api/update-session` | POST | Update session settings (hot/cold toggle, etc.) |
| `/api/remove-player` | POST | Remove player from lobby |
| `/api/end-game` | POST | End the session |

---

## 7. Data Captured

- Player names + session participation
- Questions asked (source: Pre-loaded / player-submitted / custom)
- All answers submitted per round (numeric values + reasoning text)
- Time taken to submit (`submitted_at` timestamp)
- Round winners, scores, scoring mode
- Session metadata (room code, date, player count, organizer name)
- Player IP address (via request headers, server-side)
- Device user-agent (via request headers, server-side)

---

## 8. Known Deviations from PRD v1

| Feature | PRD v1 | v2 Actual |
|---------|--------|-----------|
| Tie-breaking | Earliest submission wins | All tied players receive equal points |
| Question approval | Players → pending → organizer approves | Player submissions auto-approve (visible immediately with submitter badge) |
| Pre-loaded questions | 20–30 questions auto-seeded | 25 questions loaded via "📦 Sample Qs" button on demand |
| Remove player | Any time during game | Lobby only (removing mid-game would break round state) |
| Pause/resume game | Mentioned as organizer capability | Not built in v2 |
| Force-reveal any answer | Mentioned as organizer capability | Not built in v2 |
| Organizer push "How to Play" to all screens | Listed as feature | Not built (players open it themselves) |

---

## 9. Out of Scope (v2, same as v1)

- Accounts / login
- Voice/video integration
- Question categories
- Mobile native app
- Monetization
- Pause/resume game mid-round
- Force-reveal individual answers
- Organizer push "How to Play" to all screens

---

## 10. Success Metrics

- Session completion rate (% of games that reach the reveal phase)
- Average rounds per session
- Question bank growth (custom + player-submitted questions)
- Return sessions (same player name joining again)
- Tie frequency (tracks fairness of scoring)
