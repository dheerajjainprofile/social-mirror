# Guessing the Guess — Feature Specification (v3.1)

## What this doc is

This document describes what the product is intended to do, written from a product perspective so the owner can manually test each feature, evaluate design decisions, and spot gaps between intent and implementation. If something in the app contradicts this doc, that is a bug — or a deliberate design change that should be recorded here.

---

## 1. The Game Concept

Guessing the Guess is a real-time multiplayer social estimation game. Each round, one player — the **Target** — secretly answers a numeric question about themselves (e.g., "How many unread WhatsApp messages do you have right now?"). Every other player tries to guess what the Target answered. Points go to whoever guesses closest. The game rewards knowing your friends well, not general knowledge.

The core loop: pick a question → pick a target → everyone guesses → reveal one by one → laugh, react, repeat.

Works in a shared physical space (living room, party) or remotely over a video call (Zoom, Teams, Google Meet).

---

## 2. Getting Into a Game

### 2.1 Creating a Room (Organizer)

The organizer starts at `/start`.

**Two modes are offered:**

| Mode | Description |
|---|---|
| 🎉 Party Mode | Fast setup. Organizer enters their name and taps one button. Room is live in under 10 seconds. All settings pre-filled with recommended defaults. |
| ⚙️ Custom Mode | All 6 settings exposed for full control. |

**Party Mode defaults:**

| Setting | Default |
|---|---|
| Timer | **60 seconds** |
| Scoring | Rich (3/2/1 pts) |
| Reveal | Organizer controls |
| Show Reasoning | On |
| Hot/Cold Hints | On |
| Question Pack | Warm-up for first 2 rounds, then Mixed (with Savage from round 5+) |
| Auto Target Rotation | On |
| Auto Question Suggestion | On |

**Custom Mode settings:**

| Setting | Options |
|---|---|
| Organizer name | Free text |
| Scoring Mode | Simple (1pt closest) or Rich (3/2/1 pts) |
| Reveal Mode | **Organizer controls (manual):** Organizer taps "Reveal Answers!" to trigger. Default in Party Mode. **Auto reveal:** Reveal triggers automatically when (a) target has submitted AND (b) either all guessers have submitted OR the timer expires. No button press needed. |
| Show Reasoning | On / Off |
| Hot/Cold Hints | On / Off |
| Timer | 15–180 seconds, in steps of 15, default 60s |
| Question Pack | Warm-up / Revealing / Chaotic / Savage / Mixed |

After creating a room, the organizer is taken directly to the organizer screen. Room settings are saved to localStorage.

### 2.2 Joining a Room (Player)

Players navigate to `/join` and enter:

- **Room Code** — auto-uppercased, max 6 characters. Pre-filled from URL `?code=` param if present.
- **Name** — max 30 characters, pre-filled from localStorage if available
- **Remember my name** checkbox — saves name to localStorage for future sessions

**Validation and errors:**

| Condition | Error shown |
|---|---|
| Room code not found | "Room not found" |
| Room is full (12 players) | "Room is full" |
| Name already taken in room (case-insensitive) | "This name is already taken in this room." |

Names are automatically converted to Title Case on submission ("dheeraj jain" → "Dheeraj Jain").

### 2.3 Room Code Format + Player Limits

- Room codes are 6 characters, alphanumeric
- Characters I, O, 1, and 0 are excluded to avoid visual confusion
- Maximum 12 non-organizer players per room
- The organizer does not count toward the player limit and does not appear on the leaderboard

---

## 3. The Game Flow

### 3.1 Session States

```
lobby → active ↔ paused → ended
```

| State | Description |
|---|---|
| `lobby` | Players are joining. Game has not started. |
| `active` | A round is in progress or between rounds. |
| `paused` | Organizer has paused. Timer frozen. |
| `ended` | Game is over. No more actions possible. |

### 3.2 Round States

| Phase | Description |
|---|---|
| `guessing` | Target answers secretly. Guessers submit their guesses. Timer counts down. |
| `reveal` | Answers revealed one-by-one with animation. Winner announced. |
| `done` | Round complete. Leaderboard updates. Organizer sets up next round. |

### 3.3 Who sees what

| Screen | Audience | URL |
|---|---|---|
| Organizer Screen | The person running the game — all controls | `/room/[code]/organizer` |
| Player Screen | Each individual player — personalized to their role | `/room/[code]/player/[playerId]` |
| Present Screen | TV or projector — display only, no controls | `/room/[code]/present` |

All three screens update in real time via Supabase realtime subscriptions. No manual refresh needed. Once a session is `ended`, all realtime events stop firing — no sounds, no banners, no winner logic executes after end.

---

## 4. Organizer Screen

### 4.1 Lobby

The organizer sees:
- List of joined players, each with a **× remove button**
- A field to write a custom question OR select from the Question Bank
- A target player selector — pill buttons for each non-organizer player
- **"Start Game!" button** — disabled until at least 1 player joined, question set, target selected

### 4.2 Running a Round (Guessing Phase)

The organizer sees:
- Question card: round number, question text, target player name
- **Hot/Cold toggle button** — toggles hints on/off in real time across all screens
- **SubmissionGrid** — ✓ for each player who submitted (target excluded)
- Status message: "Waiting for [Target] to submit their answer..." until target submits
- **"Reveal Answers!" button:**
  - Disabled until target has submitted
  - If target submitted but some guessers have not: confirmation dialog — "Only N of M players have guessed. Reveal anyway?" → "Yes, reveal now" or "Keep waiting"
- **"Skip" button** — confirmation dialog → round marked done, no winner, no points. A toast appears on all screens: **"Round skipped — no points awarded."** No answers revealed.
- **🔔/🔕 sound toggle** in header — controls sounds on organizer's device only

### 4.3 Revealing Answers (Reveal Phase)

Cards animate in with **adaptive timing** based on player count:
- Cards 1 to (n-3): 0.8s each — fast, keeps energy up
- Cards (n-2) and (n-1): 1.5s each — tension builds
- Last card (target's answer): 2.5s — the big moment

The screen **auto-scrolls** to each newly revealed card as it animates in.

After all cards shown:
- Winner banner: "🏆 [Name] wins!" or "🏆 [Name] & [Name] tie!"
- Confetti blast
- Horizontal number line: all guesses + target answer, colour-coded by player
- Per-Round Ranking panel (animated, worst-first, winner last, 350ms stagger)

**Per-Round Ranking rows:**
- Medal: 🥇 🥈 🥉 (tied players share medal)
- Player name + fun label:

| Distance | Label |
|---|---|
| 0 | 🎯 EXACT! |
| ≤ 5 | So close! |
| ≤ 20 | Not bad |
| ≤ 50 | Off track |
| > 50 | Way off 😬 |

- "🎪 Biggest miss" badge on furthest player (only if 2+ non-passed players)
- Passed players at bottom, below ranked players
- Target player excluded from ranking

### 4.4 Between Rounds (Done Phase)

- Leaderboard always visible
- "Start Next Round" panel appears with question picker + target selector + "Next Round →" button

**Selected question display:**
Once organizer selects a question from any source, the suggestion panel is replaced with:
`✅ Selected: "[question text]"` + `[✕ Change question]` link to deselect.
The selected question is also highlighted in the bank list with a checkmark and border accent.

**Auto Question Suggestion (Party Mode):**
Top 3 questions surfaced, filtered by current pack phase, excluding already-played questions. Each suggestion shows its energy type label (Warm-up / Revealing / Chaotic / Savage).

### 4.5 Game Over

When the organizer ends the game:
- "Game Over!" on all screens immediately
- **No further sounds, banners, or round logic fires after this point**
- Organizer game-over screen shows:
  - **"🔁 Play again — same group"** — triggers Replay flow (Section 13)
  - **"📤 Share Session Story"** — opens Session Story image (WhatsApp-ready PNG, Section 12.2)
  - **"📸 Save challenge card"** — opens Challenge Share Card PNG (Section 12.1)
  - **"🃏 Use this same pack next time"** — saves pack to localStorage for next session
  - **"👀 Full results (.txt)"** — plain text download (raw data)
- Feedback widget shown (Section 15)

### 4.6 Always-visible panels

**Leaderboard:**
- All non-organizer players, sorted highest to lowest
- Each row colour-coded by player's join-order colour (guaranteed unique — see Section 14)
- Rows animate on position change (↑↓ indicators)
- Leaderboard does NOT re-render when organizer deletes a question

**Question Bank:**
- Polls for new questions every 5 seconds
- Organizer can add questions manually
- **"📦 Load Question Bank"** button — loads pre-seeded questions into the bank. **Hidden when pre-loaded questions already exist.** Reappears only if all pre-loaded questions are deleted.
- Delete button shown **only** on non-preloaded questions. Pre-loaded questions have no delete button at all.
- **New This Session tray:** Questions added after page load, pinned above main list, pulsing amber accent. Dismissible per question.

**Players panel:**
- All players, HOST and TARGET badges
- × remove button available at any time

### 4.7 Pause / Resume

- Organizer can pause at any time during an active session
- While paused:
  - All player screens show a **"⏸️ Paused"** status banner at the top — form remains fully functional (players can still submit)
  - Timer **freezes** at current value on all screens including organizer
  - Organizer sees "▶️ Resume" button prominently
  - Present screen shows: question text + target name + "⏸️ Game paused — back in a moment"
- Resuming restores: same round, same frozen timer value, all submitted answers intact

**Pause as a "thinking time" tool:** Organizer can pause after showing the question so players can think, then resume when ready. Players see the question and can submit at any time — the submit button is never disabled during pause.

### 4.8 End Game

Organizer can end the game at any time. Sets session to `ended`, triggers game-over for all participants immediately.

---

## 5. Player Screen

### 5.1 Lobby

Players see:
- "Waiting for game to start..." message
- Pill buttons showing all joined players (own name highlighted)
- Total player count
- **Rotating tips** below player list, cycling every few seconds:
  - "💡 Think about how THEY think, not how you'd answer"
  - "💡 Rich Mode: 1st=3pts, 2nd=2pts, 3rd=1pt"
  - "💡 You can Pass any round — but no points for passing"
  - "💡 Reasoning is half the fun — make it creative"
  - "💡 The closest guess wins — not the highest or lowest"
- **🔔/🔕 sound toggle** in header

### 5.2 Being the Target

When a player is the Target:
- Pulsing red banner: "🎯 YOU ARE THE TARGET THIS ROUND!"
- Rose/red tinted question card + page background
- Timer counts down
- Numeric input + "Submit My Answer 🔒" button
- After submitting: green confirmation + waiting message
- **Target cannot submit a guess — blocked server-side**
- During pause: **"⏸️ Paused"** banner at top, form remains active

### 5.3 Being a Guesser

When a player is not the Target:

**Target name is shown prominently above the question:**
> 🎯 GUESS WHAT **[TARGET NAME]** WILL SAY

Target name is large, bold, and in the target's assigned player colour — the first thing the eye hits before reading the question. This prevents players from answering as themselves instead of guessing the target.

Below the target name:
- Question text
- Timer
- Numeric input field
- Optional reasoning textarea (if Show Reasoning is ON)
- "Submit Guess!" and "Pass" buttons
- During pause: **"⏸️ Paused"** banner at top, form remains fully active

### 5.4 Reveal Phase

- Same adaptive card timing as organizer screen (0.8s early → 1.5s tension → 2.5s final)
- Screen auto-scrolls to each newly revealed card
- Hot/Cold badge on each card (if enabled)
- Winner banner: personalized — "You win!" if this player won, otherwise "[Name] wins!"
- "+N points!" if player earned points
- Confetti only fires on winner's own device
- Number line + leaderboard after done phase

### 5.5 Game Over + Badge

Each player sees:
- "Game Over!" heading
- **Personal badge** — immediately visible, no scrolling needed (Section 11)
- **"📸 Share session card"** — same Session Story image as organizer (Section 12.2)
- **"🎮 Host your own game"** CTA → `/start` with pack preset
- "👀 See full leaderboard" toggle
- Feedback widget (Section 15)

### 5.6 Getting Removed

If organizer removes a player:
- Full-screen "You've been removed" message immediately
- No further interaction possible

### 5.7 Late Join + Rejoin

**Late Join (arriving mid-session):**
- Player sees: "Hang tight — joining after this round"
- Not disruptive to current round
- Joins leaderboard from next round
- If session ended: "This game has ended. Want to start a new one?"

**Rejoin (recovering lost connection):**
- A `player_token` is saved to localStorage at first join
- On rejoin attempt with same name on active session:
  - Token matches → rejoined, score intact
  - Token missing/wrong → blocked with helpful error

### 5.8 Replay — Silent Auto-Rejoin

When organizer starts a replay:
- Player sees prompt: "🔁 [Organizer] wants to play again! [Join] [Skip]"
- **Tapping "Join":** Reads name + player_token from localStorage → calls join API silently → navigates directly to new room's player screen (no join form shown)
- **If localStorage is empty:** Falls back to pre-filled join form
- **If API fails:** Shows retry button: "Couldn't join — tap to try again"
- **Tapping "Skip":** Persistent "Rejoin [room code]" banner shown at bottom while new session is in lobby

### 5.9 Suggest a Question

- Collapsible widget always visible during session
- Text input + "Add" button (Enter key also submits)
- Success message shown for 3 seconds, input clears
- Question appears in organizer's "New This Session" tray within 5 seconds

---

## 6. Present Screen (TV/Projector)

Display-only. No controls. Designed for TV/projector.

| Session State | What is shown |
|---|---|
| Lobby | Large room code + **QR code** (scan to pre-fill join page with room code) + player count |
| Active — Guessing | Question text, target name, timer, guess counter (X of Y submitted) |
| **Paused** | **Question text, target name, "⏸️ Game paused — back in a moment"** |
| Active — Reveal | Animated reveal cards, winner banner, number line |
| Active — Done | Leaderboard |
| Ended | "Game Over!" + final leaderboard |

---

## 7. Scoring Rules

### 7.1 Simple Mode

- Player(s) closest to target's answer each earn 1 point
- Ties: all tied players get 1 point

### 7.2 Rich Mode

Dense ranking:

| Place | Points |
|---|---|
| 1st | 3 pts |
| 2nd | 2 pts |
| 3rd | 1 pt |

Two tied for 1st → both get 3pts, next player gets 2pts (not 1pt).

### 7.3 Passes

Always 0 points, regardless of mode.

### 7.4 Ties

- Simple: all tied get 1pt
- Rich: tied players share rank and points; next rank is immediately next (dense)
- Banner shows all tied winners: "🏆 [Name] & [Name] tie!"

---

## 8. Question Packs

### 8.1 Energy Types

| Type | Character |
|---|---|
| Warm-up | Easy, low-stakes. Gets everyone comfortable. |
| Revealing | Genuine personal insights. Creates "I didn't know that" moments. |
| Chaotic | High spread expected. Wild guesses, big laughs. |
| Savage | Playful embarrassment — requires group trust. Medium intensity. |
| Big Numbers | Fermi estimation. Tests how someone thinks, not what they know. |

### 8.2 Pack Selection

At room creation (Custom Mode):
- Warm-up, Revealing, Chaotic, Savage, Big Numbers (individual packs)
- Mixed = Warm-up + Revealing + Chaotic (Savage and Big Numbers excluded from Mixed by default)

In Party Mode, pack is set automatically (see 8.3).

### 8.3 Warm-up → Mixed Transition (Party Mode)

| Round | Questions drawn from |
|---|---|
| 1–2 | Warm-up only |
| 3–4 | Mixed (Warm-up + Revealing + Chaotic) |
| 5+ | Mixed + Savage |

- **Exception:** If fewer than 2 unused Warm-up questions at session start → skip Warm-up phase, use Mixed from round 1
- Manual override by organizer → pack phase resumes as Mixed from next round
- Every suggested question shows its energy type label so organizer knows what they're picking

### 8.4 Pack Exhaustion

1. Pack runs out → fall back to Mixed
2. Mixed exhausted → allow repeats (marked "played before")

---

## 9. Auto-Facilitation (Party Mode)

### 9.1 Auto Target Rotation

- Order randomized at session start (not join order)
- All players cycle through before anyone repeats
- Organizer can override at any time — rotation continues from next in queue
- No player is targeted twice in a row

### 9.2 Auto Question Suggestion

- Top 3 questions surfaced after each round
- Filtered by current pack phase, excluding already-played questions
- Each suggestion shows energy type label
- Organizer taps one to select; "Browse all" available for full manual control

### 9.3 Timer Expiry Behaviour

Non-blocking modals — session never freezes if ignored.

**Case A — Target has not submitted:**
Modal: "Skip this round" or "Wait for them"

**Case B — Target submitted, some guessers haven't:**
Modal: "Reveal now" or "Wait a moment"

---

## 10. Hot/Cold Hints

Shown on reveal cards only (not done-state cards). Toggleable by organizer anytime, syncs to all screens in real time.

**Thresholds (percentage distance):**

| Badge | Condition |
|---|---|
| 🔥 Hot | Within 20% of target |
| ☀️ Warm | 20–50% off |
| 🧊 Cold | More than 50% off |

**Special case — Target = 0:** Uses absolute difference: <1 = hot, <5 = warm, ≥5 = cold.

---

## 11. Badges

Each player receives exactly one badge on their game-over screen.

### 11.1 All Badge Types

Indian pop culture references. Badge card shows: badge name (large) + copy line (smaller). Name = reference; copy = what it means if you don't get the reference.

| Emoji | Badge | Condition | Copy |
|---|---|---|---|
| 🔮 | The Baba Vanga | 2+ exact guesses (distance = 0) | "Predicted it exactly. Seek help." |
| 🎬 | The Aamir Khan | Highest accuracy overall + slowest avg submission | "Took forever. Was right. Perfectionist things." |
| 🔥 | The Virat Kohli | Won 3+ consecutive rounds | "Played like every point was personal. Because it was." |
| 🏏 | The MS Dhoni | Closest guesser in majority of rounds | "Cool head. Finished it every time." |
| 🕵️ | The Mogambo | Highest answer spread as Target (hardest to guess) | "Nobody could crack me tonight. Mogambo khush hua." |
| 🕶️ | The Salman Khan | Most rounds won without being the fastest submitter | "Broke every rule. Won anyway. That's Bhai." |
| 🌟 | The SRK | Was the Target in the most rounds | "The whole room was thinking about me tonight. Obviously." |
| 🎙️ | The Arnab Goswami | Fastest to submit every round + lowest accuracy | "The nation demanded an answer. It was wrong." |
| 💰 | The Ambani | Consistently submitted the highest numbers | "Thought in crores. Answered in crores. Relatable? No." |
| ⚡ | The Hardik Pandya | Fastest consistently + decent accuracy | "No plan. Just vibes. It worked." |
| 😬 | The Gabbar Singh | Highest average distance from target | "Kitne aadmi the? Still completely wrong." |
| 👻 | The Devdas | Passed 3+ rounds | "Present. Suffering. Uninvolved." |
| 🤷 | The Babu Bhaiya | Never within 50% of any target answer (fallback) | "Haan... nahi... pata nahi. Wrong every time." |

### 11.2 Badge Condition Formulas

Precise definitions for conditions that are not self-evident:

| Badge | Exact formula |
|---|---|
| **Baba Vanga** | `exactGuesses >= 2` where exactGuess = distance 0 in rounds where player was a guesser |
| **Aamir Khan** | Highest accuracy score (lowest avg distance) among all players AND slowest avg submission time. Both conditions must be true. |
| **Virat Kohli** | Won 3 or more consecutive rounds (1st place) |
| **MS Dhoni** | Was the closest guesser (1st place) in the majority of rounds they played (>50%) |
| **Mogambo** | As Target, had the highest answer spread — `max(guesses) - min(guesses)` across all rounds they were Target |
| **Salman Khan** | Most rounds won (1st place) without being the fastest submitter in those rounds |
| **SRK** | Was the Target more rounds than any other player |
| **Arnab Goswami** | Fastest avg submission time AND lowest accuracy (highest avg distance) — both conditions must be true |
| **Ambani** | Highest average submitted number across all rounds (as guesser) |
| **Hardik Pandya** | Top 3 fastest avg submission time AND accuracy within top half of all players |
| **Gabbar Singh** | Highest average absolute distance from target (worst accuracy, not counting passes) |
| **Devdas** | Passed 3 or more rounds |
| **Babu Bhaiya** | Fallback — awarded when no other badge condition is met |

**Minimum sample size:** Badge conditions require at least 2 qualifying rounds. A player who played only 1 round as guesser cannot win Baba Vanga.

**Ties within a badge condition:** If two players both satisfy the same badge condition equally (e.g., both passed exactly 3 rounds), the priority list in 11.2 determines who gets Devdas. The other player continues down the priority list for their next eligible badge.

### 11.3 Tie-Breaking Priority (rarest first)

Baba Vanga → Aamir Khan → Virat Kohli → MS Dhoni → Mogambo → Salman Khan → SRK → Arnab → Ambani → Hardik Pandya → Gabbar Singh → Devdas → Babu Bhaiya

Every player always gets a badge — Babu Bhaiya is the fallback if nothing else applies.

### 11.3 Badge Sharing

- 1080×1080px PNG via `/api/badge/[sessionId]/[playerId]`
- Dark background with player's assigned colour as accent
- Mobile: Web Share API. Desktop: image download.
- Player name optional (opt-in)

---

## 12. Share Cards + Export

### 12.1 Challenge Share Card (PNG)

1200×630px image. Available via **"📸 Save challenge card"** on organizer game-over screen.

Purpose: for new groups — "can your group beat this?"

**Content:**
- Header: title, room code, date, player count, round count
- Winner banner
- Top 6 leaderboard with player colour dots
- Best guess + biggest miss callouts
- Chaos Score label (see 12.3) — no raw number shown
- Pack name
- QR code linking to `/start?pack=[packId]` (scan to play same pack)
- "Can your group beat this?" prompt

### 12.2 Session Story Image (PNG)

1200×630px landscape image. Available via **"📤 Share Session Story"** on organizer game-over screen AND **"📸 Share session card"** on every player's game-over screen.

Purpose: for the group that just played — "remember this?"

**Content:**
- Header: room code, date, player count, round count
- "🏆 [Winner] wins with N pts"
- Tonight's Highlights: exact guesses count, biggest miss, chaos score label
- Final leaderboard: all players with points + medals + colour dots
- Footer: site URL

Designed for WhatsApp inline preview — entire image visible without tapping.

### 12.3 Chaos Score

**Calculation:** Average absolute distance of all guesses from all target answers across the session.

**Display:** Emoji + label + one-line description only. Raw number never shown to users.

| Score | Emoji | Label | Description |
|---|---|---|---|
| ≤ 20 | 🎯 | Eerily Accurate | "Your group knows each other on a concerning level." |
| 21–50 | 😊 | Pretty Good Reads | "You know your friends. Mostly." |
| 51–100 | 😂 | Respectably Chaotic | "Your group gives each other absolutely no credit." |
| > 100 | 💀 | Beautiful Chaos | "Nobody knows anyone. Somehow still friends." |

Footnote on card: "Lower = eerily accurate · Higher = beautiful chaos"

---

## 13. Replay Flow

On organizer game-over: **"🔁 Play again — same group"** button.

1. New session created with new room code, same pack + settings
2. Organizer navigates automatically to new organizer screen (no manual navigation)
3. All current players receive realtime prompt: "🔁 [Organizer] wants to play again! [Join] [Skip]"
4. Player taps "Join" → silent auto-rejoin (see Section 5.8)
5. Player taps "Skip" → persistent rejoin banner shown while new session in lobby

---

## 14. Visual + Audio Design

### Visual

- **Font:** Plus Jakarta Sans throughout — energetic, slightly rounded, excellent mobile rendering
- **Player colours:** 10 distinct colours assigned by join order. First to join = colour 0, second = colour 1, etc. Colours cycle after 10 — players 11 and 12 reuse colours 0 and 1. In practice, groups rarely exceed 10, so collisions are uncommon. Consistent across all screens.
- **Leaderboard animation:** Rows slide in on load. Position change indicators (↑↓).
- **Round start flash:** Full-screen "ROUND N — LET'S GO! 🎯" overlay at start of each round.
- **Landing page:** Floating "game moment" bubbles in background (e.g., "💬 Priya said: 47", "💬 EXACT MATCH 🎯") — communicates the game concept visually before any text is read. Headline: "How well do you know your friends?" Subline: "The number guessing game that reveals everything." Two CTAs above fold: "🎮 Host a Game" → `/start`, "🙋 Join a Game" → `/join`.

### Audio (Hybrid approach)

| Sound | Type | Trigger |
|---|---|---|
| Card reveal pop | Synthesized (warm) | Each answer card animates in |
| Guess submit ding | Synthesized | Player submits guess |
| Winner fanfare | Real MP3 file | Winner announcement |
| Crowd cheer | Real MP3 file | Winner screen + confetti |
| Timer tick | Synthesized | Last 5 seconds of countdown |

**Per-device sound toggle:** 🔔/🔕 button in header on player screen and organizer screen. Default ON. Saves to localStorage. Affects only that device.

---

## 15. Feedback Collection

Shown on game-over screen for organizer and all players.

- Emoji rating (required): 😭 😐 😊 🤩
- Optional free-text comment
- "Submit anonymously" checkbox
- Never blocking — always dismissible
- Feedback linked to room code, not player identity

---

## 16. Security Rules

Enforced server-side — not just UI restrictions.

| Rule | Detail |
|---|---|
| Organizer-only actions | Start round, reveal, skip, end game, remove player, pause, calculate winner — all verified server-side against organizer player ID |
| Target cannot guess | Target player cannot submit a guess — blocked server-side |
| Only Target can answer | Non-target players cannot submit a target answer — blocked server-side |
| One answer per round | Only one target answer accepted per round — duplicate rejected |
| Rejoin identity | Rejoin requires matching `player_token` from localStorage — mismatch blocks |

---

## 17. Known Intentional Limitations

Deliberate non-features in v3:

- **No analytics dashboard** — question events logged silently, no UI yet (v4)
- **Organizer does not play** — not a player, does not guess, not on leaderboard
- **Present screen is display-only** — no interactive controls
- **No in-session settings changes** — timer, scoring mode etc. cannot be changed mid-session
- **No custom pack creation** — pre-loaded packs only; player-submitted questions go to general pool
- **Badges are session-scoped** — reflect one session only, not cumulative history
- **Rejoin works same browser/device only** — cross-device recovery not supported
- **Savage not in Mixed by default** — appears in suggestions from round 5+ in Party Mode; must be explicitly selected in Custom Mode for earlier rounds
- **Questions rewrite pending** — current seeded questions to be replaced with Indian-context questions across 4 packs: **Warm-up, Revealing, Chaotic, Savage** (Big Numbers is v4). Target: ~15 questions per pack. Frozen pending owner review before first party use.
