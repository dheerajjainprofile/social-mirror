# Product Requirements Document
# "Guessing the Guess" — Web App

**Version:** 1.0 (MVP)  
**Date:** 2026-03-31  
**Status:** Ready for Build

---

## 1. Overview

**Guessing the Guess** is a multiplayer social estimation game played on personal devices (phones/laptops) in a shared physical space. Players earn points not by knowing the correct answer, but by correctly predicting *how a specific person* would answer a question. It rewards social intelligence, humor, and knowing your friends.

---

## 2. Core Game Loop

1. **Organizer** creates a game room → gets a shareable **room code** (e.g. `MANGO42`)
2. **Players** join via browser using room code, enter their real name (with optional "remember me")
3. **Any player** can submit a question to the question bank at any time during the session. **Only the Organizer** selects which question is used each round — framed as *"As per [Target Player], how many X...?"*
   - Target player **cannot** be the question asker
4. **Target Player** secretly submits their answer (locked, not visible to others)
5. **All other players** secretly submit their best guess of what Target Player answered + optional brief reasoning
6. **Submission indicators** show who has submitted (green checkmark) without revealing answers
7. **Organizer triggers reveal** — one by one, each player's answer + reasoning is shown on the public screen
8. **Target Player reveals their answer** — config-driven: organizer can set this to either "Target reveals themselves" or "Organizer force-reveals on behalf of Target"
9. **Winner announced** — player numerically closest to Target's answer wins the round
10. **Scores updated**, next round begins

---

## 3. Player Roles

### Regular Player
- Join room via code
- Submit secret answers
- Add optional reasoning (1–2 sentences)
- View public reveal screen
- Submit questions to the question bank

### Organizer (Super Access)
- All player capabilities +
- Create/manage game room
- Configure game settings before start
- Choose which question to use each round
- Designate target player per round
- Control reveal timing (manual trigger)
- Toggle Cold/Warm/Hot hints on/off mid-game
- Toggle reasoning display on/off
- Pause/resume game
- Skip a round
- Remove a player
- Force-reveal any answer
- See all answers in real-time (private view)
- Manage question bank (add/edit/delete)
- Export session summary

---

## 4. Features

### 4.1 Room & Session Management
- Organizer creates room → 4–6 character alphanumeric code generated
- Players join at `[app-url]/join` or via shared link
- Room persists until organizer ends session
- Min 3 players, max 12 players
- Player name entry with optional "Remember my name" checkbox (stored in local storage + synced to DB)

### 4.2 Timer System
- Configurable countdown timer per phase (organizer sets before game):
  - Target Player answer phase
  - Other players' guess phase
- Visual countdown displayed on all screens
- Last **X seconds** (configurable, default 10s): pulsing red animation + buzz/sound alert
- Organizer can pause/extend timer manually

### 4.3 Anonymous Submission Indicator
- All players see a grid of participant names
- Green checkmark appears when a player submits (no answer revealed)
- "Waiting for: [names]" shown to organizer in private view
- Pass option available — player can skip a round (no points, no penalty, shown as "Passed")
- **Organizer-controlled:** toggle is in organizer's private view; state change syncs to all player screens in real-time

### 4.4 Cold / Warm / Hot Hints
- After all guesses submitted, before reveal: organizer can toggle on/off anytime
- Shows relative proximity bands to Target's answer (without revealing it):
  - ❄️ Cold — far off
  - 🌤 Warm — getting closer
  - 🔥 Hot — very close
- Toggle button in organizer's private view; enabling/disabling takes effect **instantly on all player screens in real-time**
- Example: Target answered 47. Player guessed 200 → Cold. Guessed 60 → Warm. Guessed 50 → Hot.

### 4.5 Reveal Animation
- Organizer triggers reveal (manual pacing)
- Each player's answer + reasoning appears one by one (animated card flip or slide-in)
- Target Player's answer drops in last — with a dramatic pause
- A number line / bar visualization shows all guesses and Target's answer
- Closest guess highlighted: confetti burst + "Winner!" badge
- Everyone sees this on their own screen simultaneously (synced)

### 4.6 Scoring System
- **Configurable by organizer** before game starts:

  **Simple Mode:**
  - 1 point to the round winner (closest guess)
  - Running tally shown after each round

  **Rich Mode:**
  - 1st closest → 3 points
  - 2nd closest → 2 points
  - 3rd closest → 1 point
  - Tie-breaking: earliest submission wins

- End-of-game leaderboard shown after organizer ends session
- All sessions and scores stored in database

### 4.7 Organizer: Two-Screen Mode
- **Private View** (organizer's device): All answers visible, all controls accessible
- **Public/Presentation View**: Clean display safe to cast to TV/projector
  - Organizer controls what's shown via toggle reveals
  - Think: poker dealer controlling the flop
  - Accessible via a separate URL/tab (`[room-url]/present`)

### 4.8 Question Bank
- **Pre-loaded questions:** 20–30 funny, absurd, estimation questions to lower entry barrier
  - Examples:
    - "How many times has an average Indian hit the snooze button in their lifetime?"
    - "How many WhatsApp forwards does your dad receive per day?"
    - "How many steps do you think you walked last Monday?"
    - "How many weddings have you attended in the last 5 years?"
    - "How many licks to finish a Magnum ice cream?"
- **Living bank:** Any player OR organizer can submit questions anytime (during lobby or mid-game)
- Questions go into a "pending" pool; organizer reviews and approves before use
- Organizer's private view shows full bank + can add/edit/delete at any time
- Questions persist in DB — bank grows over time across sessions

### 4.9 Reasoning Field
- Optional text field (max ~150 chars) shown when submitting answer
- Placeholder: *"Why do you think this? (optional)"*
- Display controlled by organizer toggle (on = shown during reveal, off = hidden)

### 4.10 Export & History
- End-of-session export:
  - Round-by-round summary
  - Each player's guesses vs Target's answer
  - Winner per round + final leaderboard
  - Exportable as: shareable link, screenshot-friendly view, or JSON
- All data persisted in DB for future analysis

### 4.11 How to Play (In-App)
- Simple, visual "How to Play" overlay/page accessible from any screen
- Max 5 steps, plain language, example question included
- Organizer can push it to all players' screens during lobby

---

## 5. Tech Stack (Recommended)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React) |
| Realtime sync | Supabase Realtime (built-in, free tier) |
| Backend/DB | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Styling | Tailwind CSS |

---

## 6. Data to Capture (for future learning)

- Player names + session history
- Questions asked (source: pre-loaded vs custom)
- All answers submitted per round (for analysis)
- Reasoning text (anonymized for future ML/analysis)
- Time taken to submit per player
- Rounds played, scoring mode used
- Session metadata (date, player count, duration)
- **Player IP address** — captured server-side automatically, no user prompt needed (feasible via request headers)
- **Device type / user agent** — browser/OS/device inferred from user-agent header, no explicit ask needed

---

## 7. Out of Scope (v1)

- Accounts / login (organizer identified by room creation, not auth)
- Voice/video integration
- Question categories (flat bank only in MVP)
- Mobile native app
- Monetization

---

## 8. Decisions Made

1. **Non-numeric answers:** No — all questions must be numeric estimation only
2. **Question bank scope:** Global — shared across all organizers, grows with every session
3. **Player session history:** Out of scope for MVP
4. **Target answer reveal:** Config-driven — organizer sets whether Target reveals themselves or organizer force-reveals
5. **Tech stack:** Next.js + Supabase + Vercel + Tailwind CSS (all free tier, zero cost at this scale)

---

## 9. Success Metrics

- Session completion rate (% of games that reach the reveal phase)
- Average rounds per session
- Question bank growth rate (custom questions added)
- Return sessions (same player joining again)
