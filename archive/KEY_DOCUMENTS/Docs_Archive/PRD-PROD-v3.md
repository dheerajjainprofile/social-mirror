# PRD-PROD-v3 — Guessing the Guess
## Production-Accurate Requirements Document — Version 3

**Version:** 3.1 (revised after ChatGPT review — 2026-04-02)
**Date:** 2026-04-02
**Status:** Planning — not yet built
**Branch:** v3
**Baseline:** PRD-PROD-v2 (shipped to main 2026-04-02 — read that first)
**Backlog items covered:** C1, C2, C4, C6, C7, B01, B03

---

## 1. Strategic Context

### The v2 gap

v2 made GTG feel like a real product. It looks good, sounds good, and runs reliably. But it is still fundamentally a tool — people play it once, have fun, and forget about it. There is no mechanism that converts a great session into the next session.

### The v3 shift

v3 is about one thing: **session propagation.**

Not how good the session feels inside the room — v2 already solved that. But what happens after the session ends. Does anyone share it? Does anyone become a host? Does GTG spread to a new friend group?

v3 is designed around a single growth loop:

> **Play with friends → generate a shareable identity artifact → give the next group instant entry → turn one player into the next host.**

Every feature in v3 exists to serve one or more steps in that loop. If a feature doesn't serve the loop, it's out of scope.

### The white hot center

v3 targets **one audience only: house party friend groups.**

Not work offsites. Not family game nights. Not corporate teams. Those may come later. Right now, every design decision — question tone, preset defaults, badge copy, facilitation pace — is made for a group of friends at a house party who know each other well and are ready to be chaotic, vulnerable, and funny.

### The product identity

GTG is not a trivia game. It is not a general knowledge quiz. It is a **social mirror.**

You don't need to know facts about the world. You need to know how *this specific person* thinks. That distinction should be felt in every question, every badge, every share card. The game is about intimacy and surprise — not intelligence.

---

## 2. What's New in v3

v3 is focused on four themes:

1. **Question packs** — questions become a first-class product, organised by energy type not topic.
2. **Quick start presets** — organizer gets to a live room in under 10 seconds.
3. **Smarter facilitation** — the game runs itself so the organizer can be a host, not an operator.
4. **Social propagation** — every session produces shareable artifacts and a clear path for the next host.

---

## 3. Out of Scope — v3

Consciously excluded, may revisit in v4:

| Item | Reason |
|------|--------|
| Audience mode (C3) | Significant architecture change — foundational features must land first |
| Prompt-level analytics dashboard (C5) | Needs thousands of sessions before data is meaningful. Tracking hooks built silently, no UI yet |
| Work mode / corporate preset | White hot center is house party only — don't dilute |
| Theme switching (B15) | No use case until wider audience |
| Refactoring (B17) | Never during active feature work |
| E2E / integration tests (B25) | Unit tests from B10 sufficient for now |
| Organizer as player (B02) | Already decided not building |
| User journey doc (B12) | Only useful when onboarding contributors |
| Custom pack creation by organizer | Pre-loaded packs only for v3 — custom packs are a v4 feature |

---

## 4. Feature Specifications

---

### 4.1 Question Packs (C4)

#### 4.1.1 The core insight

The current category taxonomy (habits, social, money, food, work, fun) is **content-oriented** — it describes what a question is about. That's a librarian's taxonomy.

v3 replaces this with an **energy-oriented** taxonomy — it describes what a question *does to a room*. That's a DJ's taxonomy. The organizer doesn't need to know what topic comes next. They need to know what energy they want next.

#### 4.1.2 Energy types (replaces categories)

| Energy Type | Description | When to play |
|-------------|-------------|--------------|
| **Warm-up** | Easy, low-risk, fast answers. No embarrassment, no vulnerability. Gets everyone comfortable submitting. | Always first. Lowers activation energy for the session. |
| **Revealing** | Genuine personal insight. Makes you learn something real about the target. Creates connection and "huh, I didn't know that" moments. | Middle of session. The emotional heart of the game. |
| **Chaotic** | High answer spread by design. Wild guesses, funny misses, big reveals. Pure energy injection. | Any time the room needs a laugh. |
| **Savage** | Playful embarrassment, friend knowledge flex. Requires trust in the group. | Later in session once group is warmed up. |

**Late-night** and **Couples** packs are parked for v4. v3 ships Warm-up, Revealing, Chaotic, and Savage for house party context only.

#### 4.1.3 Packs as first-class objects

A pack is not just a filtered view of questions. It is a named, saveable entity that can be:
- Selected at room creation
- Referenced after a session ("play this same pack again")
- Linked in a share card ("use this deck")

**`packs` table (new):**

```sql
CREATE TABLE packs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  energy_type text NOT NULL, -- 'warmup' | 'revealing' | 'chaotic' | 'savage'
  description text,
  source text DEFAULT 'preloaded', -- 'preloaded' | 'custom'
  created_at timestamptz DEFAULT now()
);
```

**`questions` table changes:**

```sql
ALTER TABLE questions ADD COLUMN pack_id uuid REFERENCES packs(id);
ALTER TABLE questions ADD COLUMN energy_type text; -- mirrors pack energy type for quick filtering
-- 'category' column kept for backwards compat but no longer used in app logic
```

**`rounds` table changes:**

```sql
-- FIX: rounds must store question_id to enable "already played" exclusion,
-- question_events logging, pack-aware suggestion, and future prompt analytics.
-- v1 stored question_text only — that is insufficient for v3.
ALTER TABLE rounds ADD COLUMN question_id uuid REFERENCES questions(id);
```

**`sessions` table changes:**

```sql
ALTER TABLE sessions ADD COLUMN pack_id uuid REFERENCES packs(id);
ALTER TABLE sessions ADD COLUMN preset text; -- 'party' | 'custom'
ALTER TABLE sessions ADD COLUMN parent_session_id uuid REFERENCES sessions(id); -- for replay lineage
ALTER TABLE sessions ADD COLUMN acquisition_source text; -- 'direct' | 'badge_share' | 'challenge_card' | 'replay' | 'host_cta'
```

`parent_session_id` and `acquisition_source` are required for measuring whether v3 actually improves propagation. Without them there is no way to know if the growth loop worked.

#### 4.1.4 Question writing principles for house party

Every question in a house party pack must pass these tests:

1. **No world knowledge required** — the answer comes from knowing *this person*, not knowing facts.
2. **Numeric answer** — GTG is a number-guessing game. Every question must have a numeric answer.
3. **Personal and specific** — "How many unread texts do you have right now?" beats "How many hours do you use your phone per week?"
4. **Produces spread** — the answer should vary enough between people that guesses will differ. "How many fingers do you have?" produces no spread. "How many photos are in your camera roll?" does.
5. **Funny when wrong** — the best questions are the ones where a wildly wrong guess is as entertaining as a right one.

**Examples of house party questions (right tone):**
- "How many unread texts do you have right now?"
- "How many photos are in your camera roll?"
- "How many times did you cancel plans last month?"
- "How many drinks would knock you out tonight?"

**Examples of wrong tone (too work/generic — avoid):**
- "How many hours do you work per week?"
- "How many times have you been late to work this month?"

#### 4.1.5 Seed questions per pack (v3 launch)

Each pack ships with a minimum of 15 questions at launch. Questions are written to the above principles.

**data/packs.json** (new file):
```json
[
  { "name": "Warm-up", "energy_type": "warmup", "description": "Easy starters — get everyone comfortable" },
  { "name": "Revealing", "energy_type": "revealing", "description": "Learn something real about your friends" },
  { "name": "Chaotic", "energy_type": "chaotic", "description": "High spread, wild guesses, big laughs" },
  { "name": "Savage", "energy_type": "savage", "description": "Playful embarrassment — only with people you trust" }
]
```

**data/questions.json** updated: each question gets an `energy_type` field. Old `category` field retired from new questions. Existing questions backfilled with best-fit energy_type during seed migration.

#### 4.1.6 Pack selection at room creation

Organizer selects a pack (or leaves it as Mixed) during room setup. Mixed = questions drawn randomly across Warm-up, Revealing, and Chaotic packs (Savage excluded from Mixed — requires explicit opt-in). Specific pack = all questions pulled from that pack only.

Pack selection is surfaced through the Quick Start preset flow (see 4.2) — organizer doesn't need to understand packs to use them. Presets make the choice for them.

#### 4.1.7 Pack exhaustion rules

If the selected pack runs out of unused questions mid-session:
- Fall back to Mixed (all packs combined, excluding already-played questions)
- Organizer sees a subtle notice: "Pack finished — pulling from all questions"
- If all questions across all packs are exhausted, allow question repeats (mark with "played before" label in suggestion tray)
- Player-submitted questions with no pack assignment are eligible for Mixed only — never auto-assigned to a named pack

---

### 4.2 Route and Deep-Link Contracts

> **Why this section is early:** The challenge card QR, badge share, host CTA, and replay all depend on URL contracts being defined before screens are built. Defining them here prevents route conflicts at build time.

#### 4.2.1 New routes

| Route | Purpose |
|-------|---------|
| `/start` | Landing page for new hosts — replaces current `/create` entry point |
| `/start?pack=[packId]` | Deep link from challenge card — `/start` with pack pre-selected and Party Mode pre-highlighted |
| `/start?preset=party&pack=[packId]` | Full deep link — pack + preset pre-configured, host enters name and goes live |
| `/start?replay=[sessionCode]` | Replay link — pre-loads pack + settings from a previous session |

#### 4.2.2 `/join` stays as-is

`/join` remains the player join flow (enter room code). It is NOT used for host deep links.

The v1 challenge card erroneously linked to `/join?pack=...` — that is fixed here. All acquisition deep links go to `/start`, not `/join`.

#### 4.2.3 Acquisition source tracking

When a new session is created from a deep link, the `acquisition_source` is set server-side based on the URL parameters:

| URL parameter present | acquisition_source value |
|----------------------|--------------------------|
| `replay=[code]` | `'replay'` |
| `pack=[id]` only | `'challenge_card'` |
| Neither | `'direct'` |

Badge share and host CTA set acquisition_source client-side before calling `/api/create-room`:
- Badge share → `'badge_share'`
- "Host your own game" CTA → `'host_cta'`

---

### 4.3 Quick Start Presets (C6)

#### 4.3.1 The problem being solved

The current /create flow asks for: name, scoring mode, reveal mode, show reasoning, hot/cold, timer. That's 6 decisions before a single player can join. In a live social setting that is too much friction. The host should reach "room live" in under 10 seconds.

#### 4.3.2 The preset flow

The `/start` page replaces the current `/create` page. It shows:

```
┌─────────────────────────────────────────────────────┐
│  What's your name?                                  │
│  [_________________________]                        │
│                                                     │
│  How do you want to play tonight?                   │
│                                                     │
│  🎉 Party Mode                                      │
│  Fast, chaotic, fun. Best for house parties         │
│                                                     │
│  ⚙️  Custom                                         │
│  I want to configure everything myself              │
└─────────────────────────────────────────────────────┘
```

**Work Mode is not shown on this screen.** It is out of scope for v3 and showing it as "coming soon" leaks the house-party focus. It will be added in v4 when work mode is actually built.

Name field + Party Mode = two interactions. Room live. Under 10 seconds.

#### 4.3.3 Party Mode defaults

When organizer taps Party Mode:

| Setting | Value | Why |
|---------|-------|-----|
| Timer | 45 seconds | Urgency creates energy |
| Scoring | Competitive (rich) | Leaderboard drama |
| Reveal | Manual | Organizer controls the moment |
| Reasoning | On | Funny reasoning = better reveals |
| Hot/cold | On | More feedback = more engagement |
| Pack | See 4.3.4 — Warm-up first, then Mixed | Correct session arc automatically |
| Target rotation | Auto | No organizer overhead |
| Question suggestion | Auto (top 3 surfaced) | No organizer scrolling |
| acquisition_source | Set from URL params or `'direct'` | Propagation measurement |

#### 4.3.4 Warm-up → Mixed transition algorithm

Party Mode uses a defined sequence, not a vague "Warm-up first":

- **Rounds 1–2:** Questions drawn exclusively from Warm-up pack
- **Round 3+:** Questions drawn from Mixed (Warm-up + Revealing + Chaotic, weighted equally)
- **If Warm-up pack has fewer than 2 unused questions at session start:** skip Warm-up phase, go straight to Mixed from round 1
- **Organizer override:** If organizer manually picks a question from a different pack, auto-suggestion resumes from Mixed from the next round regardless of which round number it is
- **Late join does not affect the transition:** The round number drives the switch, not the player count

#### 4.3.5 Custom mode

Identical to current /create flow. All 6 knobs available. Explicitly opt-in for power users. The full configuration screen is not removed — it's just no longer the default.

---

### 4.4 Smarter Facilitation (C7)

#### 4.4.1 Auto target rotation

When Party Mode is selected, target rotation is automatic. Rules:

- Order is randomised at session start (not join order)
- Cycles through all players before any player is targeted twice
- Organizer can override at any time — tapping a different player selects them, rotation continues from that player onward
- If a player submitted no guess in the previous round (likely away), they are moved to the end of the current cycle. Organizer sees: "Skipped [Name] — they'll go next available round"
- **Late joiner placement:** Late joiners are appended to the end of the current rotation cycle. They never become target until the current cycle completes. They are never inserted mid-cycle.

#### 4.4.2 Auto question suggestion

After each round ends, the game surfaces the top 3 questions for the next round:

- Filtered by current pack phase (Warm-up or Mixed, per 4.3.4)
- Excludes questions already played this session (requires `rounds.question_id` — see 4.1.3)
- Ranked by answer spread from `question_events` if available, otherwise random within pack
- Organizer taps one to select
- "Browse all" link available for manual override
- **Pool exhaustion:** If fewer than 3 unused questions remain in the current pack phase, surface all remaining unused questions (even if only 1 or 2). If 0 unused questions remain, fall back per 4.1.7.
- **Player-submitted questions:** Eligible for suggestion only in Mixed phase, never in Warm-up phase

#### 4.4.3 Timer expiry — two separate cases

Timer expiry covers two distinct situations that must not be conflated:

**Case A — Target has not answered yet (target timeout)**

When the timer hits zero and the target player has not yet submitted their answer:

```
⏱️ Time's up — [Name] hasn't answered yet.

[Skip this round]    [Wait for them]
```

- "Skip this round" → round is abandoned, no scores awarded, move to next round
- "Wait for them" → timer stays at 0, organizer waits, target can still answer
- Reveal button remains disabled until target answers (or round is skipped)

**Case B — Target has answered, but not all guessers have submitted (guesser timeout)**

When the timer hits zero and the target has answered but some guessers haven't submitted:

```
⏱️ Time's up!
5 of 8 players have guessed.

[Reveal now]    [Wait a moment]
```

- "Reveal now" → proceeds to reveal immediately (see also 4.4.4 for reveal gating)
- "Wait a moment" → dismisses prompt, timer stays at 0, organizer waits
- Present screen shows "⏱️ Time's up — waiting for organizer"

Both prompts are non-blocking. If organizer ignores either, session does not freeze.

#### 4.4.4 Reveal button gating (B03 — promoted from future)

Precondition for reveal: target must have submitted their answer. This is unchanged from v1.

Additional gate: if fewer than all guessers have submitted, show a confirm dialog rather than hard-blocking:

```
Only 4 of 7 players have guessed.
Reveal anyway?

[Yes, reveal now]    [Keep waiting]
```

Organizer stays in control. Session never freezes if someone's phone dies.

**Clarification of v1 behaviour:** v1 hard-blocks reveal until target submits. That remains. The confirm dialog is an additional layer on top — it handles the guesser-count case, not the target-answer case.

#### 4.4.5 Pause / resume

Organizer can pause at any time. When paused:

- All player screens show "⏸️ Game paused — back in a moment"
- Timer freezes at current value
- Organizer screen shows "▶️ Resume" button
- Session status: new valid value `paused` (added to existing `lobby → active → ended` state machine — see also section 11 for updated state docs)

Pause is valid only during `active` status. Cannot pause during `lobby` or `ended`.

Resume restores: timer value, current round, current target, all submitted guesses intact.

#### 4.4.6 Rejoin (identity recovery)

Rejoin is the flow for a player whose connection dropped mid-session. It is a distinct product problem from late join.

**Identity model:** Rejoin uses a `player_token` stored in `localStorage` on the player's device at join time. It is not keyed on name alone — that would allow a different person to claim another player's slot by entering the same name.

**`players` table changes:**
```sql
ALTER TABLE players ADD COLUMN player_token uuid DEFAULT gen_random_uuid();
```

**Rejoin flow:**
1. Player returns to `/join`, enters room code
2. `/api/join-room` detects: session is active + a player with this name already exists
3. Server checks: does the request include a `player_token` header matching the existing player row?
4. If token matches → rejoin granted, player gets their accumulated score back
5. If token missing or wrong → blocked with: "This name is already taken. If you lost your connection, try refreshing from the same browser and device."
6. `player_token` is set in localStorage at first join and sent as a header on all subsequent API calls from that browser/device

This prevents hijacking while allowing legitimate reconnection from the same device.

#### 4.4.7 Late join (mid-session participation)

Late join is the flow for a new player who was not in the original lobby.

- Player enters room code on `/join` during an active session
- `/api/join-room` detects: session is active + this name does not exist yet → treat as late join
- Player is added to `players` table with `score = 0`
- Player appears on leaderboard from the next round onward
- Current round in progress is not disrupted — late joiner sees a waiting screen: "Hang tight — joining after this round"
- Late joiner receives a `player_token` in localStorage on successful join
- Late joiner enters target rotation at the end of the current cycle (per 4.4.1)

**Late join state matrix:**

| Session state at time of join | What late joiner sees |
|------------------------------|----------------------|
| `lobby` | Normal join flow — not late join |
| `active` — during guessing phase | "Hang tight — joining after this round" |
| `active` — during reveal phase | "Hang tight — joining after this round" |
| `active` — between rounds | Joins immediately, eligible from next round |
| `paused` | Joins immediately, eligible from next round |
| `ended` | "This game has ended. Want to start a new one?" → `/start` |

---

### 4.5 Personal Result Cards (C2)

#### 4.5.1 What they are

After a session ends, every player receives a personal badge on their game-over screen. Not the room leaderboard — their own individual identity statement based on their performance tonight.

These are designed to be posted. Each one says something about who this person is in their friend group — not just where they ranked.

#### 4.5.2 Badge types

| Badge | Condition | Copy |
|-------|-----------|------|
| 🎯 Psychic | 2+ exact guesses (distance = 0) | "[N] exact guesses. Psychic energy." |
| 🥇 Best Friend | Closest guesser most rounds | "I know [Target] best. It's not even close." |
| 😬 Chaos Agent | Highest average distance from target | "Biggest miss of the night. Iconic." |
| 🕵️ Most Unpredictable | Highest answer spread as target (hardest to guess) | "Nobody could figure me out tonight." |
| 🔥 On Fire | Won 3+ consecutive rounds | "3 rounds in a row. Someone stop me." |
| 🤝 Consistent | Smallest variance in scores across rounds | "Steady. Reliable. Boring? No — accurate." |
| 🎪 Wildcard | Most passes or most extreme single guess | "I came, I guessed, I was spectacularly wrong." |

Every player gets exactly one badge — the most notable thing about their session. Tie-breaking priority (rarest first): Psychic → On Fire → Best Friend → Most Unpredictable → Consistent → Chaos Agent → Wildcard.

Players who only passed every round receive the Wildcard badge.

#### 4.5.3 Badge card design

Each badge is a shareable image generated via `/api/badge/[sessionId]/[playerId]` (edge runtime, next/og):

- Dark background, player colour accent (from v2 `getPlayerColor()`)
- Large badge emoji + badge name
- Badge copy line
- Game name + session date
- "Play with your friends → [URL]" footer
- 1080×1080px (Instagram square format)

Player name optionally included (opt-in: "Include my name on the badge?").

#### 4.5.4 Where it surfaces

On every player's game-over screen, immediately visible without scrolling:

```
┌──────────────────────────────┐
│  🥇 Best Friend              │
│  "I know Priya best.         │
│   It's not even close."      │
│                              │
│  [📤 Share this badge]       │
└──────────────────────────────┘
```

One tap → native share sheet (Web Share API) on mobile with badge image pre-attached. On desktop → direct image download.

---

### 4.6 Challenge Share Card (C1) — updated from v2 export

#### 4.6.1 What changes

The v2 export (B04) is a souvenir — it documents what happened. The v3 share card is a **challenge artifact** — it pulls the next group in.

#### 4.6.2 New elements added to export

On top of the existing v2 layout (leaderboard, best guess, biggest miss, branding):

**"Can your group beat this?"** — replaces the current neutral header.

**Chaos Score** — average distance of all guesses from all targets across the whole session.

Formula: `sum of all (|guess - target|) / total guesses submitted`. Rounded to nearest whole number.

| Score | Label |
|-------|-------|
| ≤ 20 | 🎯 Eerily accurate group |
| 21–50 | 😊 Pretty good reads |
| 51–100 | 😂 Respectably chaotic |
| > 100 | 💀 Absolute chaos |

**Pack name** — "Played: Chaotic Pack"

**QR code** — links to `/start?pack=[packId]` (not `/join` — see 4.2.2). Scan → name → Party Mode pre-selected with same pack → room live.

#### 4.6.3 API changes

`GET /api/export-image/[code]` updated: chaos score calculation added, pack name pulled from `sessions.pack_id`, QR code generated server-side.

---

### 4.7 Game-Over Conversion Screen (C8)

#### 4.7.1 The most important screen in the app

The game-over screen is where peak enjoyment meets the next action. Every player — not just the organizer — sees a personalised screen.

#### 4.7.2 Player game-over screen

```
┌──────────────────────────────────────────────────────┐
│  🎉 Game over!  [Winner name] wins!                  │
│                                                      │
│  ┌──────────────────────────────┐                   │
│  │  🥇 Best Friend              │                   │
│  │  "I know Priya best."        │                   │
│  │  [📤 Share this badge]       │                   │
│  └──────────────────────────────┘                   │
│                                                      │
│  [🎮 Host your own game]                             │
│  Bring this game to your friends — takes 10 seconds │
│                                                      │
│  [👀 See full leaderboard]                           │
└──────────────────────────────────────────────────────┘
```

**"Host your own game"** → `/start?preset=party&pack=[packId]&source=host_cta`. Party Mode pre-highlighted, same pack pre-selected. `acquisition_source` set to `'host_cta'` on room creation.

#### 4.7.3 Organizer game-over screen

```
┌──────────────────────────────────────────────────────┐
│  🎉 What a game!                                     │
│                                                      │
│  [🔁 Play again — same group]                        │
│  One tap, new room, everyone rejoins                 │
│                                                      │
│  [📸 Save session card]                              │
│  Share the chaos score + leaderboard                 │
│                                                      │
│  [🃏 Use this same pack next time]                   │
│  Copy this pack to a new session                     │
│                                                      │
│  [👀 Full results + feedback]                        │
└──────────────────────────────────────────────────────┘
```

**"Play again — same group"** → calls `/api/session/[code]/replay`. Creates new session with `parent_session_id = current session`, `acquisition_source = 'replay'`, same pack + preset. All current players receive a realtime prompt on their screens: "🔁 [Organizer] wants to play again! [Join] [Skip]". One tap rejoins using their existing `player_token`.

**"Use this same pack"** → stores pack reference in `localStorage` as `lastUsedPackId`. Pre-selected next time organizer visits `/start`.

#### 4.7.4 Layout principles

- All primary actions visible without scrolling on any phone screen
- Badge surfaced immediately — not behind "see more"
- Share is one tap
- "Host your own game" is prominent
- Screen feels celebratory, not administrative

---

### 4.8 Prompt-Level Analytics Hooks (C5 — tracking only, no UI)

No dashboard in v3. But hooks are instrumented from day one so data accumulates.

Every question interaction logs silently to `question_events`:

```sql
CREATE TABLE question_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid REFERENCES questions(id),
  session_id uuid REFERENCES sessions(id),
  event_type text NOT NULL, -- 'shown' | 'picked' | 'skipped' | 'passed' | 'completed'
  answer_spread numeric, -- std dev of guesses for this round (populated on 'completed' only)
  recorded_at timestamptz DEFAULT now()
);
```

**Deduplication rule:** Only one `'shown'` event per question per session. Only one `'completed'` event per round. `'picked'` and `'skipped'` are mutually exclusive per show event.

No UI. No organizer-facing view. v4 will surface pick rate, pass rate, answer spread, skip rate per question.

---

## 5. Database Changes — Full Summary

### New tables

| Table | Purpose |
|-------|---------|
| `packs` | Pack definitions — name, energy type, source |
| `question_events` | Per-question interaction log for future analytics |

### Modified tables

**`questions`:**
```sql
ALTER TABLE questions ADD COLUMN pack_id uuid REFERENCES packs(id);
ALTER TABLE questions ADD COLUMN energy_type text;
-- 'category' kept for backwards compat, not used in app logic
```

**`rounds`:**
```sql
-- Critical: needed for "already played" exclusion + question_events + analytics
ALTER TABLE rounds ADD COLUMN question_id uuid REFERENCES questions(id);
```

**`sessions`:**
```sql
ALTER TABLE sessions ADD COLUMN pack_id uuid REFERENCES packs(id);
ALTER TABLE sessions ADD COLUMN preset text;              -- 'party' | 'custom'
ALTER TABLE sessions ADD COLUMN parent_session_id uuid REFERENCES sessions(id);
ALTER TABLE sessions ADD COLUMN acquisition_source text; -- 'direct' | 'badge_share' | 'challenge_card' | 'replay' | 'host_cta'
-- 'status' existing field: adds 'paused' as valid value alongside 'lobby' | 'active' | 'ended'
```

**`players`:**
```sql
ALTER TABLE players ADD COLUMN player_token uuid DEFAULT gen_random_uuid();
-- Used for rejoin identity verification — see 4.4.6
```

### Backfill plan for existing questions

On seed run:
1. Insert packs from `data/packs.json`
2. For each question in `data/questions.json`: assign `pack_id` and `energy_type` based on `energy_type` field in JSON
3. Existing questions already in DB (pre-v3): update `energy_type` and `pack_id` based on best-fit mapping (defined in seed script, not manual)
4. `category` column left intact with existing values — no data deleted

---

## 6. New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/badge/[sessionId]/[playerId]` | GET | Generate personal badge PNG (edge runtime) |
| `/api/packs` | GET | List all available packs |
| `/api/session/[code]/replay` | POST | Create new session from existing session's pack + settings |

### Modified API Routes

| Route | Change |
|-------|--------|
| `/api/create-room` | Accepts `preset`, `pack_id`, `acquisition_source`. Applies Party Mode defaults server-side when `preset = 'party'`. |
| `/api/export-image/[code]` | Adds chaos score, pack name, QR linking to `/start?pack=[id]` |
| `/api/join-room` | Handles three cases: (1) normal join in lobby, (2) late join during active session, (3) rejoin via player_token |

---

## 7. New Files

| Path | Purpose |
|------|---------|
| `data/packs.json` | Source of truth for pre-loaded packs |
| `src/app/start/page.tsx` | New host entry point — replaces /create |
| `src/components/PresetSelector.tsx` | Party / Custom preset selection |
| `src/components/BadgeCard.tsx` | Personal badge display |
| `src/components/GameOverPlayer.tsx` | Player game-over screen |
| `src/components/GameOverOrganizer.tsx` | Organizer game-over screen |
| `src/app/api/badge/[sessionId]/[playerId]/route.tsx` | Badge PNG (edge runtime) |
| `src/app/api/packs/route.ts` | Pack listing |
| `src/app/api/session/[code]/replay/route.ts` | Replay session creation |
| `src/lib/badgeLogic.ts` | Badge assignment (pure function, unit tested) |
| `src/lib/chaosScore.ts` | Chaos score calculation (pure function, unit tested) |

---

## 8. Known Limitations (not fixed in v3)

- Audience mode not built — room still capped at 12 active players (C3 deferred to v4)
- Prompt-level analytics dashboard not built — hooks in place, UI deferred to v4
- Work mode preset not built — house party only
- No custom pack creation by organizer — pre-loaded packs only
- Player-submitted questions go into general pool only — not assignable to named packs
- `player_token` rejoin only works on same browser/device — cross-device recovery not supported

---

## 9. Build Order

**Phase 0 — Contracts (no code — define before building)**
- Confirm `rounds.question_id` migration plan with existing data
- Define `player_token` rejoin identity model (done — see 4.4.6)
- Confirm `/start` route replaces `/create` — no backwards compat needed (no public links to `/create` yet)
- Confirm `acquisition_source` values and when each is set

**Phase 1 — Data foundation**
1. `packs` table + `data/packs.json`
2. `questions.json` updated with energy_type + pack assignments
3. Seed API updated: inserts packs, backfills existing questions
4. `rounds.question_id` column added + populated on round creation going forward
5. `sessions` columns added: `pack_id`, `preset`, `parent_session_id`, `acquisition_source`
6. `players.player_token` column added
7. `question_events` table created
8. `/api/create-room` updated: accepts preset + pack_id + acquisition_source
9. `/api/packs` route created

**Phase 2 — Resilience**
10. `player_token` issued on join, stored in localStorage, sent on API calls
11. Rejoin flow in `/api/join-room` — token validation
12. Pause/resume — session status `paused`, player screens, organizer controls
13. Timer expiry Case A (target timeout) — skip or wait prompt
14. Timer expiry Case B (guesser timeout) — reveal or wait prompt
15. Reveal confirm dialog (B03)
16. Late join flow — active session detection, waiting screen, rotation placement

**Phase 3 — Host automation**
17. `/start` page + PresetSelector component
18. Party Mode defaults wired — all settings applied server-side
19. Warm-up → Mixed transition algorithm (rounds 1–2 / round 3+)
20. Auto target rotation — randomised order, skip logic, late joiner placement
21. Auto question suggestion — top 3 per round, pack-aware, pool exhaustion fallback

**Phase 4 — Social propagation**
22. `badgeLogic.ts` — pure function, all 7 types, tie-breaking, unit tests
23. `chaosScore.ts` — pure function, edge cases, unit tests
24. `/api/session/[code]/replay` — new session creation, parent_session_id, realtime rejoin prompt
25. `/api/badge/[sessionId]/[playerId]` — edge runtime PNG
26. `GameOverPlayer.tsx` — badge + host CTA + leaderboard link
27. `GameOverOrganizer.tsx` — play again + save card + same pack + results
28. Export image updated — chaos score + pack name + QR to `/start?pack=`

---

## 10. Definition of Done — v3

**Functional**
- [ ] All 4 packs seeded with minimum 15 questions each, written to house party principles
- [ ] Party Mode preset creates a room in ≤ 2 taps from `/start`
- [ ] Warm-up → Mixed transition is deterministic: rounds 1–2 Warm-up, round 3+ Mixed
- [ ] Pack exhaustion fallback works — no dead end if pack runs out
- [ ] Timer expiry Case A (target timeout): skip or wait prompt appears, session never freezes
- [ ] Timer expiry Case B (guesser timeout): reveal or wait prompt appears, session never freezes
- [ ] Reveal confirm dialog replaces hard block for guesser count
- [ ] Pause/resume works during guessing phase, reveal phase, and between rounds
- [ ] Rejoin: same device/browser recovers score and slot via player_token
- [ ] Rejoin: different name on same session is still blocked (duplicate prevention intact)
- [ ] Rejoin: different device cannot hijack a player slot by entering the same name
- [ ] Late join: player added mid-session with 0 points, no disruption to current round
- [ ] Late join: correct waiting screen shown depending on current session phase
- [ ] Late joiner enters rotation at end of current cycle, never mid-cycle
- [ ] Auto target rotation cycles all players before repeating
- [ ] Auto question suggestion surfaces 3 options after each round
- [ ] Auto question suggestion excludes already-played questions (requires rounds.question_id)
- [ ] Every player sees a personal badge on game-over screen
- [ ] Badge share works via Web Share API on mobile, download on desktop
- [ ] "Host your own game" button links to `/start?preset=party&pack=[id]&source=host_cta`
- [ ] "Play again" creates new session, sets parent_session_id, prompts existing players to rejoin
- [ ] Challenge share card includes chaos score + pack name + QR linking to `/start?pack=[id]`
- [ ] QR on share card does NOT link to `/join` — links to `/start`
- [ ] `question_events` logs shown/picked/skipped/completed — no duplicate events per round
- [ ] `acquisition_source` is recorded on every new session creation

**Tests**
- [ ] `badgeLogic.ts` unit tests: all 7 badge types, tie-breaking priority, edge cases (all passes, single player, single round)
- [ ] `chaosScore.ts` unit tests: normal session, no guesses, all passes, single round, single player
- [ ] Regression checklist updated and run before deploy

**Propagation measurement**
- [ ] At least 2 live playtests: one fresh group, one session created from a share link or replay
- [ ] After playtests: query `sessions` table and confirm `acquisition_source` is populated correctly
- [ ] `parent_session_id` correctly links replay sessions to their origin

**Deployment**
- [ ] v3 branch merged to main
- [ ] Vercel deploys successfully
- [ ] `/start` route live and accessible
- [ ] `/create` either redirects to `/start` or is removed

---

## 11. State Machine Updates

The existing state machine in `docs/workflow.md` must be updated before v3 ships to reflect:

**Session status:** `lobby` → `active` → `paused` ↔ `active` → `ended`

`paused` is a new valid status. It can only be entered from `active`. Resuming returns to `active`. `paused` cannot transition directly to `ended` — must resume first.

**Late join:** A new player joining during `active` status is now valid. Previously only valid during `lobby`.

**Rejoin:** A player with a matching `player_token` re-entering during `active` status is now valid. Previously blocked as duplicate.

`docs/workflow.md` update is a Definition of Done requirement before merge.
