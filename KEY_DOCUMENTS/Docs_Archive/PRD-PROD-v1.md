# PRD-PROD-v1 — Guessing the Guess
## Production-Accurate Requirements Document

**Version:** 1.0 (Production)
**Date:** 2026-04-01
**Status:** Live — deployed on Vercel
**Branch:** main
**Describes:** Exactly what is built and deployed. Nothing more, nothing less.

---

## 1. What the App Does

Guessing the Guess is a multiplayer social estimation game played in a shared physical space (living room, party, office) on personal devices. Each round, one player (the Target) answers a numeric question secretly. Everyone else guesses what the Target's answer will be. Points go to whoever guesses closest. The game rewards knowing your friends.

---

## 2. Pages and URLs

| URL | Who uses it | Purpose |
|-----|-------------|---------|
| `/` | Anyone | Landing page |
| `/create` | Organizer | Configure and create a game room |
| `/join` | Players | Join a room using a room code |
| `/room/[code]/organizer` | Organizer | Run the game (private view, all controls) |
| `/room/[code]/player/[playerId]` | Players | Play the game |
| `/room/[code]/present` | Organizer (cast to TV) | Clean display-only view for projector/TV |

---

## 3. Create Room (`/create`)

Organizer fills in a form to configure the session before it starts.

**Fields:**

| Field | Type | Options / Range | Default |
|-------|------|----------------|---------|
| Your Name (Organizer) | Text input | Max 30 chars | — |
| Scoring Mode | Toggle buttons | Simple (1pt) / Rich (3/2/1pts) | Simple |
| Reveal Mode | Toggle buttons | Organizer controls / Auto reveal | Organizer controls |
| Show Reasoning | On/Off toggle | — | ON |
| Hot/Cold Hints | On/Off toggle | — | ON |
| Timer | Slider | 15s–180s, step 15 | 60s |

On submit: organizer name, player ID, and session ID are saved to `localStorage` (`gtg_name`, `gtg_player_id`, `gtg_session_id`). Redirects to `/room/[code]/organizer`.

---

## 4. Join Room (`/join`)

**Fields:**

| Field | Behaviour |
|-------|-----------|
| Room Code | Uppercase only, max 6 chars, auto-uppercased as typed, pre-filled from `?code=` URL param |
| Your Name | Max 30 chars, pre-filled from localStorage (`gtg_name`) if previously saved |
| Remember my name | Checkbox (default checked). If checked, saves name to localStorage on join |

On submit: redirects to `/room/[code]/player/[playerId]`. Player ID and session ID saved to localStorage.

**Error states:** room not found, room full (max 12 players), other server errors shown inline.

---

## 5. Session States

A session moves through these states in order:

```
lobby → active → ended
```

A round moves through these states:

```
guessing → reveal → done
```

---

## 6. Organizer Screen (`/room/[code]/organizer`)

### 6.1 Header (sticky)
- Room code (yellow, large)
- "Organizer View" label + current status (Lobby / Round N / Game Ended)
- **"📺 Present"** button — opens `/room/[code]/present` in a new tab
- **"End Game"** button — requires confirm dialog, sets session to `ended`

### 6.2 Lobby State

- List of joined players with × remove button on each (not shown for organizer)
- Player count shown
- **First Question** picker: either type a custom question in a textarea, or click a question from the Question Bank below to select it (shown with × to deselect)
- **Target Player** selector: pill buttons for each non-organizer player
- **"Start Game!"** button — disabled until at least 1 player has joined AND a question and target are selected

### 6.3 Active Round — Guessing Phase

- Question display card with round number, question text, and target player name
- **Hot/Cold toggle button** in the question card header: `🔥 Hot/Cold ON` or `❄️ Hot/Cold OFF` — click to toggle, syncs in real-time to all connected screens via Supabase session update
- **SubmissionGrid** — shows each player's name with a green ✓ when they have submitted (excludes target player from guesser count)
- "⏳ Waiting for [name] to submit their answer..." — shown when target has not yet submitted
- **"Reveal Answers! 🎭"** button — disabled until target player has submitted their answer. When enabled, triggers reveal phase.
- **"Skip"** button — requires confirm dialog ("Skip this round? No points will be awarded."), marks round done with no winner

### 6.4 Active Round — Reveal Phase

- Cards animate in one-by-one automatically (1.5s between each, 2s delay before the last card which is always the target's answer)
- Each card shows player name, their answer, and reasoning (if any)
- Winner banner appears after all cards revealed: `🏆 [Name] wins this round!` or `🏆 [Name] & [Name] tie this round!` (for tied scores)
- Confetti blast fires when winner is determined
- **Number line** appears after all cards are revealed — horizontal axis showing all guesses and target answer, color-coded (green = winner, yellow = target, purple = others)

### 6.5 Active Round — Done Phase

After reveal completes:
- Leaderboard shown (always visible in the main scroll area)
- **"Start Next Round"** panel appears: question picker (custom textarea or from bank) + target player selector + **"Next Round →"** button

### 6.6 Game Ended State

- "Game Over!" message
- **"Export Full Results"** button — downloads a `.txt` file named `guessing-the-guess-[code].txt`

**Export file contents:**
```
Guessing the Guess — Room [code]
Date: [date]
Organizer: [name]
Scoring Mode: [simple/rich]

=== FINAL SCORES ===
1. [Player]: N pts
...

--- ROUND 1: [Question text] ---
Target: [name]
Target's answer: [number]
  [Player]: Guessed: [number] ("reasoning text")
  [Player]: Passed
Winner: [name]

--- ROUND 2: ...
```

### 6.7 Leaderboard

- Always visible below the active round section
- Shows all non-organizer players with their running total points
- Sorted highest to lowest

### 6.8 Question Bank Panel

Always visible below the leaderboard.

- Lists all questions from the global questions table, sorted: approved questions first
- **New-this-session badge** (`💬 submitted by [name]`): shown on questions that were added after the organizer's page loaded (not on questions that were already in the bank when the session started)
- Click any question to select it for the current/next round
- **"📦 Sample Qs"** button — loads 25 pre-loaded sample questions (idempotent: does nothing if already loaded)
- **Add question form** — organizer can type and submit a new question (auto-approved, appears immediately)
- **Pending approval section** — questions with `approved = false` shown separately, with an Approve button
- Questions refresh every **5 seconds** via polling (questions table has no Supabase realtime replication)

### 6.9 Players Panel

Always visible at the bottom of the page.

- Lists all players (including organizer) with name, HOST badge (organizer), TARGET badge (current round's target), green online dot
- × remove button on each non-organizer player — available during lobby AND during active game. Requires confirm dialog.

---

## 7. Player Screen (`/room/[code]/player/[playerId]`)

### 7.1 Header (sticky)

- Room code (yellow)
- Player's own name + round number or "In Lobby"
- **"How to Play"** button (opens overlay)
- **Background colour changes when player is the Target:** `bg-rose-950` (main), `bg-rose-900` (header) during the guessing phase

### 7.2 Lobby State

- "Waiting for game to start..." message with hourglass
- List of all joined players as pills; own name highlighted in purple with "(you)"
- Player count shown

### 7.3 Active Round — Target Player

Shown when this player is the designated target:

- Pulsing red banner: `🎯 YOU ARE THE TARGET THIS ROUND! 🎯`
- Question card (rose-tinted gradient)
- Timer (if configured and not yet submitted)
- **Submit answer form**: large numeric input (type=number, centered, large font), "Submit My Answer 🔒" button
- Validation: must be a valid number; error shown inline if not
- After submission: green "Answer locked in!" confirmation, waiting message

### 7.4 Active Round — Guesser (non-target player)

- Question card with purple gradient, showing target player's name
- Timer (if configured and not yet submitted)
- **Submit guess form**: large numeric input, optional reasoning textarea (only shown if `show_reasoning` is ON for the session), "Submit Guess!" + "Pass" buttons
- Pass: submits with no answer; shown as "Passed" during reveal, no points
- Validation: must be a valid number (unless passing); error shown inline
- After submission: green "Guess submitted!" confirmation, waiting message

### 7.5 Reveal Phase

Cards animate in automatically at the same pace as the organizer/present view:
- 1.5s between each card, 2s for the last card (target's answer)
- Each card visible once its turn arrives
- **Hot/Cold badge** shown on each card during reveal phase (before round is `done`) if hot/cold is enabled on the session
- Winner banner: `🏆 You win this round!` (if this player won) or `🏆 [Name] wins this round!`
- "+N points!" shown if this player earned points
- **Confetti blast** fires on own device only if this player is the winner — fires only on the transition to `done` (not on page reload)
- **Number line** appears after all cards are revealed
- **Leaderboard** appears after round is done

### 7.6 Game Over State

- "Game Over!" heading with 🏁
- Final leaderboard

### 7.7 Removed State

If the organizer removes this player:
- Full-screen "You've been removed" message (🚫)
- "The organizer removed you from this game."

### 7.8 Suggest a Question (always visible, collapsible)

- Collapsed by default, labelled "📝 Suggest a question" with ▼ open
- Expand to show text input + "Add" button
- Enter key submits
- On success: "✅ Added to the question bank!" message for 3 seconds, input clears
- Question is auto-approved and visible to organizer immediately (within 5s polling cycle)

### 7.9 How to Play Overlay

- Accessible from "How to Play" button in header
- 5-step explanation of the game flow
- Close by clicking overlay background or "Got it" button

---

## 8. Presentation Screen (`/room/[code]/present`)

Designed to be cast to a TV or projector. No controls — display only.

### Lobby
- Large 🎯 icon + "Guessing the Guess" title (text-5xl)
- "Join with code:" + room code (text-8xl yellow)
- Player count

### Active Round
- Question (text-4xl, purple gradient card)
- Target player name
- Timer (if configured, shown until round is `done`)
- **Guessing phase**: "Guesses submitted" counter (X/Y) with animated progress bar
- **Answering state**: "[Name] is answering..." with 🤫
- **Reveal phase**: animated cards (same timing as other screens), winner banner, number line
- **Leaderboard**: always visible at the bottom with 🥇🥈🥉 medals for top 3

### Game Ended
- "Game Over!" with 🎉
- "Final results above" (pointing to leaderboard which stays visible)

---

## 9. Scoring

### Simple Mode
- Player(s) closest to the target answer each receive **1 point**
- Ties: all tied players receive 1 point each

### Rich Mode
- 1st closest → **3 points**
- 2nd closest → **2 points**
- 3rd closest → **1 point**
- Ties: tied players share the same rank and same points (e.g. two players tied for 1st both get 3 points; next player gets 2 points for 3rd place)
- No time-based tiebreaker — only distance from target matters

### Passes
- Players who Pass receive 0 points regardless of mode

---

## 10. Hot / Cold Hints

Shown on reveal cards during the **reveal phase only** (not on done cards). Calculated per guess against the target answer:

| Rating | Condition | Display |
|--------|-----------|---------|
| 🔥 Hot! | Guess within 20% of target | Red text |
| ☀️ Warm | Guess 20–50% off target | Yellow text |
| 🧊 Cold | Guess >50% off target | Blue text |

Special case when target = 0: uses absolute difference (<1 = hot, <5 = warm, else cold).

Can be toggled on/off by the organizer at any time during a round. Toggle syncs in real-time to all player screens and the presentation view.

---

## 11. Room Code Format

6-character alphanumeric code. Character set excludes I, O, 1, 0 to avoid visual ambiguity:
```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

---

## 12. Player Limits

Maximum **12 players** per room enforced at the `/api/join-room` API level. Returns an error if the room is full.

---

## 13. API Routes

| Route | Method | What it does |
|-------|--------|-------------|
| `/api/create-room` | POST | Creates session + organizer player record |
| `/api/join-room` | POST | Joins session as player; enforces max 12 |
| `/api/start-round` | POST | Creates a new round record in `guessing` status |
| `/api/submit-answer` | POST | Target player submits their real numeric answer |
| `/api/submit-guess` | POST | Player submits a guess or Pass |
| `/api/trigger-reveal` | POST | Moves round to `reveal` status |
| `/api/calculate-winner` | POST | Calculates scores, writes to `scores` table, updates round winner |
| `/api/skip-round` | POST | Marks round done with no winner, no scores |
| `/api/add-question` | POST | Adds a question to the global question bank |
| `/api/approve-question` | POST | Sets `approved = true` on a pending question |
| `/api/seed-questions` | POST | Inserts 25 pre-loaded questions (idempotent — does nothing if already seeded) |
| `/api/update-session` | POST | Updates session fields (used for hot/cold toggle) |
| `/api/remove-player` | POST | Deletes player record by ID |
| `/api/end-game` | POST | Sets session status to `ended` |

---

## 14. Database Tables

| Table | Key columns |
|-------|-------------|
| `sessions` | id, room_code, organizer_name, scoring_mode, reveal_mode, show_reasoning, hot_cold_enabled, timer_seconds, status |
| `players` | id, session_id, name, is_organizer |
| `rounds` | id, session_id, question_text, target_player_id, round_number, status, winner_player_id, started_at |
| `guesses` | id, round_id, player_id, answer, reasoning, passed, submitted_at |
| `target_answers` | id, round_id, player_id, answer, submitted_at |
| `scores` | id, session_id, round_id, player_id, points |
| `questions` | id, text, source, approved, submitted_by |

**Supabase Realtime:** enabled on sessions, players, rounds, guesses, target_answers, scores tables. The `questions` table does **not** have realtime replication — the organizer screen uses 5-second polling instead.

---

## 15. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (postgres_changes) |
| Hosting | Vercel |
| Confetti | canvas-confetti |

---

## 16. Not Built in v1

The following were considered but not built:

- User accounts / login / authentication
- Organizer as a player (organizer cannot guess or earn points)
- Pause / resume mid-round
- Force-reveal individual answers
- Per-round ranking display (showing all guessers ranked 1st/2nd/3rd after each round)
- Fancy export image (current export is plain .txt)
- Duplicate player name prevention
- Auto-expiry for abandoned sessions
- Question moderation / delete by organizer
- Player feedback at game end
- Timer enforcement (timer is visual only — organizer can reveal at any time once target submits)
