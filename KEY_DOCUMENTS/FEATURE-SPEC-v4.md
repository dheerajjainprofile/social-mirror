# Hunch — Feature Specification (v4)

## What this doc is

This document describes what the product is intended to do, written from a product perspective so the owner can manually test each feature, evaluate design decisions, and spot gaps between intent and implementation. If something in the app contradicts this doc, that is a bug — or a deliberate design change that should be recorded here.

This is a complete standalone spec — not a delta from v3.

---

## 1. The Game Concept

Hunch is a real-time multiplayer social estimation game. Each round, one player — the **Target** — secretly answers a numeric question about themselves (e.g., "How many unread WhatsApp messages do you have right now?"). Every other player tries to guess what the Target answered. Points go to whoever guesses closest. The game rewards knowing your friends well, not general knowledge.

The core loop: pick a question → pick a target → everyone guesses → reveal one by one → laugh, react, repeat.

Works in a shared physical space (living room, party) or remotely over a video call (Zoom, Teams, Google Meet).

---

## 2. Getting Into a Game

### 2.1 Creating a Room (Organizer)

The organizer starts at `/start`.

**Two modes are offered:**

| Mode | Description |
|---|---|
| ⚡ Quick Start | Fast setup. Organizer enters their name, optionally picks a pack, and taps Create Room. No settings shown — all pre-filled with recommended defaults. `organizer_plays` is always `true` (host always plays). |
| ⚙️ Custom | All 6 settings exposed for full control. |

**Quick Start defaults (applied server-side):**

| Setting | Default |
|---|---|
| Timer | 60 seconds |
| Scoring | Rich (3/2/1 pts) |
| Reveal | Organizer controls |
| Show Reasoning | On |
| Hot/Cold Hints | On |

**Custom Mode settings:**

| Setting | Options |
|---|---|
| Scoring Mode | Simple (1pt closest) or Rich (3/2/1 pts) |
| Reveal Mode | **Organizer controls (manual):** Organizer taps "Reveal Answers!" to trigger. **Auto reveal:** Triggers automatically when target has submitted AND (all guessers submitted OR timer expired). |
| Show Reasoning | On / Off |
| Hot/Cold Hints | On / Off |
| Timer | 15–180 seconds, in steps of 15, default 60s |

**Pack selection** appears inline below the selected mode (Quick Start or Custom). Options:
- Default pack: **Office — Safe** (pre-selected when no deep-link pack and no localStorage history)
- Individual packs: Warm-up, Revealing, Chaotic, Savage, Office — Safe, Office — Unfiltered
- 🎲 All Mixed — draws from all packs (selected by clearing all pack buttons)
- Exactly 1 pack selected → that pack only. More than 1 selected → mixed from selected packs. "Mixed mode" hint shown when >1 selected.
- Last used pack is saved to localStorage and pre-selected on next visit (overrides the Office — Safe default).

**"I'll play too" toggle:**
- **Quick Start:** Not shown. `organizer_plays` is always `true` — host always participates.
- **Custom mode:** Toggle row below pack selection. Label: "I'll play too."
  - Default: on
  - When on: `organizer_plays = true` sent to API, stored on session
  - When on: organizer appears in SubmissionGrid, leaderboard, and receives a badge at game over

**Name field:** Pre-filled from localStorage if available. `autoComplete="off"`.

After creating a room, the organizer is taken directly to the organizer screen. Name saved to localStorage. The "Create Room" button stays in loading/disabled state until navigation completes — it does NOT briefly re-activate between API response and page transition.

**Quick Start / Custom selector — layout and tap reliability:**
- The selector is a **segmented tab bar**: two `flex-1` `<button type="button">` children inside a `flex rounded-2xl bg-slate-900 border border-slate-700 p-1 gap-1` wrapper. `py-3 rounded-xl font-black text-sm` per button. This is the design the product wants; it only ever appeared "broken on iPhone" because of a dev-server infrastructure bug unrelated to the CSS (see below).
- Selected `Quick Start` state uses a `bg-gradient-to-r from-purple-600 to-pink-600` with `shadow-[0_0_24px_rgba(236,72,153,0.55)]` + `ring-1 ring-pink-400/50`.
- Selected `Custom` state uses a `bg-gradient-to-r from-cyan-500 to-teal-500` with `shadow-[0_0_24px_rgba(34,211,238,0.5)]` + `ring-1 ring-cyan-300/50`. Previously it was `bg-slate-600 ring-slate-500` which was nearly invisible against the slate-950 page background.
- Each button uses plain `onClick={() => setPreset(...)}` + `style={{ touchAction: 'manipulation' }}`. **No `onTouchEnd` with `preventDefault()`** — that pattern blocks iOS click synthesis. **No `transition-all`** — it can interfere with tap routing on iOS; `transition-colors` is used instead.

**Mobile UI safety invariants (April 2026 pre-party batch):**
- **Flex rows with multiple children use `min-w-0` + `shrink-0` + `truncate`** so long labels (e.g., "Reveal Answers! 🎭") never push sibling buttons off the viewport. This pattern applies to the organiser guessing-phase Reveal/Skip row and the host-guess input + Submit + Pass row. Guarded by `bugfixBatch8.test.ts`.
- **`/start` page uses responsive spacing** — `p-4 md:p-6`, `mb-4 md:mb-6`, `text-[11px] md:text-xs` on Quick Start preset pills, and `hidden sm:block` on the "I'll play too" sub-description. Mobile viewports get tighter padding and smaller text so the whole form fits without feeling congested.
- **Double-tap re-entry guards** — the join form and reveal button are protected against rapid double-taps: join uses a `useRef<boolean>` that flips synchronously to block re-entry, and `api/trigger-reveal` uses an idempotency check on `rounds.status` to reject duplicate inserts. Both guarded by `bugfixBatch8.test.ts`.

**iPhone / iPad tap reliability — the real root cause (April 2026):**
- Every prior "iPhone buttons don't tap" bug report was caused by **`next.config.ts` missing `allowedDevOrigins`**, not by any button CSS. Next.js 15.2+ refuses to hydrate React on LAN-IP dev requests (`192.168.x.x:3000`) unless the LAN subnet is explicitly allow-listed. Symptoms: page renders from SSR HTML, typing in inputs works (native DOM), but `useEffect` never runs, `useState` never updates, and no buttons respond. Dev-tested via `localhost:3000` looks fine, which is why the bug kept regressing every time the user switched testing origin.
- The permanent fix is `allowedDevOrigins` set in [next.config.ts](guessing-the-guess/next.config.ts) with entries for all RFC1918 LAN subnets and `*.local` — **required** for any real-device testing from the same Wi-Fi.
- `themeColor` was also moved from the `metadata` export to a new `viewport` export in [layout.tsx](guessing-the-guess/src/app/layout.tsx), per the Next.js 15+ requirement. Leaving it in `metadata` emitted a dev-mode warning that contributed to hydration instability.
- Regression-tested by `bugfixBatch7.test.ts` — both the `allowedDevOrigins` entry and the `viewport.themeColor` placement are asserted.

### 2.1.1 Target auto-select on first player join

The organizer screen auto-selects a target player as soon as the first non-organizer player joins the lobby. If no players were in the room at the time the organizer landed on the lobby screen, the auto-select runs during the 3-second lobby poll when the first player arrives — so the host never needs to manually pick a target before starting round 1.

### 2.2 Joining a Room (Player)

Players navigate to `/join` and enter:

- **Room Code** — auto-uppercased, max 6 characters. Pre-filled from URL `?code=` param if present.
- **Name** — max 30 characters, pre-filled from localStorage if available
- **Remember my name** checkbox — saves name to localStorage
- `autoComplete="off"` on both inputs

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
- When `organizer_plays = false` (default): organizer does not count toward limit and does not appear on leaderboard
- When `organizer_plays = true`: organizer participates as a guesser, appears on leaderboard

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

All three screens update in real time via Supabase Realtime subscriptions. No manual refresh needed. Once a session is `ended`, all realtime events stop firing.

---

## 4. Organizer Screen

### 4.1 Lobby

The organizer sees:
- **Two-row sticky header** (Option A layout, April 2026):
  - Row 1: Hunch logo + "Room Code" label + big yellow code (left) · icon-only action buttons (right): 🔔/🔕 sound, 📺 presenter, ⏸/▶ pause/resume, ⛔ end game. Each has an `aria-label` and `title` for accessibility.
  - Row 2: mode chip (`⚡ Quick Start` purple / `⚙️ Custom` cyan) · status text (`Lobby`, `Round N`, `⏸ Paused`, `Game Ended`).
  - Never wraps, never truncates, alignment preserved from 320px to desktop.
- **Inline QR code** — renders the join URL (`/join?code=XXXX`) as a 4×4px pixel grid directly on screen. Scan to open the join page with code pre-filled. No external service; rendered client-side via `uqr`. **The QR code URL is derived from `window.location.origin` at runtime**, so scanning from a device on the same LAN during local development opens the dev instance (not production). SSR-safe fallback to `https://guessing-the-guess.vercel.app` for server-rendered paints. **Caveat for local dev:** `localhost:3000` URLs can't be resolved from a second device — start `next dev` on the LAN IP or use a tunnel if you need the QR to work on-phone.
- **📤 Share join link button** — opens the native system share sheet (iOS/Android) so organizer can send the join link via WhatsApp, Teams, SMS, etc. Falls back to clipboard copy on desktop.
- List of joined players, each with a **× remove button**
- A field to write a custom question OR select from the Question Bank. In Quick Start mode, a question is **auto-selected** from the pack when players join — organizer can override.
- A target player selector — pill buttons for each non-organizer player. **Target is auto-selected** (random player for Custom, first in rotation queue for Quick Start) so organizer need not do anything — override by tapping a different player.
- **"Start Game!" button** — disabled until at least 1 player joined, question set, target selected. **Also disabled when there are 0 guessers** (e.g. only 1 non-organizer player AND `organizer_plays` is false) with an amber warning banner explaining the issue.

### 4.2 Running a Round (Guessing Phase)

The organizer sees:
- **Hunch logo** in header
- **Question card:** round number label (just "Round N" — identical to the player screen, with no trailing "Question" word), then:
  - When `organizer_plays = true` and organizer is **not** the target: prominent `🎯 Guess what [TARGET NAME] will say` header (same style as player screen) followed by the question text. Target name shown in their join-order player colour.
  - When organizer is the target, or `organizer_plays = false`: question text with `Target: [Name]` line below in small text.
- **Hot/Cold toggle button** — toggles hints on/off in real time across all screens
- **SubmissionGrid** — ✓ for each player who submitted (target excluded; organizer shown only if `organizer_plays = true`)
- Status message: "Waiting for [Target] to submit their answer..." until target submits
- **Inline host guess UI** (when `organizer_plays = true`):
  - Numeric input (`type="text" inputMode="numeric"`) with Submit and Pass buttons
  - Purple-bordered card, separate from the player controls
  - Only shown when organizer has not yet submitted; hidden after submission
- **"Reveal Answers!" button:**
  - Disabled until target has submitted
  - If some guessers haven't submitted: confirmation dialog — "Only N of M players have guessed. Reveal anyway?"
- **"Skip" button** — confirmation dialog → round marked done, no winner, no points. Toast on all screens.
- **🔔/🔕 sound toggle** in header — unlocks the Web Audio context on first toggle so auto-triggered sounds (reveal pop, timer ticks) actually play on the host screen. The host's AudioContext is also unlocked proactively on "Start Round" click **AND on "Reveal Answers!" click** (both `handleTriggerReveal` and `handleForceReveal`) to prevent browser re-suspension between round start and reveal.
- **Host plays the same reveal sound as players** — a soft "pop" on each card flip during the reveal animation (this was missing before and is now fixed)
- **Change question link ("✕ Change question")** — deselects the current question and shows three fresh suggestions without auto-selecting one, per the original DECISIONS-v3 R-9 contract. Previously `buildSuggestedQuestions()` re-auto-selected the first suggestion, making the button feel broken; a new `autoSelect` parameter on the function (default `true` for initial loads, `false` for the Change button) fixes this

### 4.3 Between Rounds (Done Phase) + Next Round

- Leaderboard visible (only when `currentRound.status === 'done'` or session ended)
- **Question Bank visible** (only when `session.status === 'lobby'` or `currentRound.status === 'done'`)
- "Start Next Round" panel shows target selector + question change option
- **Auto-question selection (Party Mode):** Top suggested question is **pre-selected automatically** when suggestions are built — including on initial lobby load (round 1). Host just taps the sticky button — no manual pick required. "✕ Change question" link available if host wants to swap.
- **Auto-target selection (Party Mode):** First player in the rotation queue is pre-selected as the target — including on initial lobby load. Host can override by tapping a different player.
- **Sticky "Start Round" button** — `position: fixed; bottom: 0` — always visible. Label: `▶ Start Round N`. Falls back to "👆 Pick a target player above" or "👆 Pick a question above" when not ready. Question text is NOT shown in the button label.
- Scroll container has `padding-bottom: 7rem` to avoid sticky button overlap
- **Next-Q preview pill** (shown above the sticky Start Round button when a question is queued) — clicking it scrolls the **Start Next Round** editor card into view via `scrollIntoView({ behavior: 'smooth', block: 'center' })` using a `nextRoundEditorRef`. Previously the pill scrolled to `top: 0` which threw the host to the top of the page with no visible affordance.
- **The sticky Start Round footer is hidden while `showWinnerReveal` is true** so the animated winner card at the bottom of the viewport never overlaps with the next-question preview. `WinnerReveal` also uses `z-[60]` (higher than the sticky footer's `z-50`) as a defensive measure.

### 4.4 Revealing Answers (Reveal Phase)

Cards animate in with **adaptive timing** based on player count:
- Cards 1 to (n-3): 0.8s each
- Cards (n-2) and (n-1): 1.5s each
- Last card (target's answer): 2.5s

The screen **auto-scrolls** to each newly revealed card as it animates in.

After all cards shown:
- Winner banner: "🏆 [Name] wins!" or "🏆 [Name] & [Name] tie!"
- Confetti blast — organizer screen only fires confetti if `organizer_plays = true` AND organizer is one of the winners
- **Winner badges ("🏆 Winner" label) only appear on cards after ALL cards are revealed** — never mid-reveal to avoid showing a wrong early winner. In a 3-way (or N-way) tie, all tied players highlight simultaneously; the organizer reconstructs winners from the **guesses table** (source of truth) rather than the derived `scores` table, so partial-insert races can't latch onto a single player while the rest are still being written. `calculate-winner` also fetches tied-winner player rows in parallel via `Promise.all` rather than sequentially.
- **Round Results includes every player who submitted** — the `buildRevealCards` client code fetches players fresh from the DB inside the function and merges with the caller's list, then falls back to a `'Player'` placeholder if a guesser's row can't be found. Previously, a guesser whose player row wasn't in the stale caller-provided list was silently dropped from both the reveal cards AND the Round Results ranking, which caused an exact-match player to be missing from results entirely.
- Horizontal number line ("Answer Distribution"): all guesses + target answer, colour-coded by player. The **target answer dot is larger** (24×24px vs 16×16px), glows yellow, and has a ring to make it visually dominant. Target label and value are also rendered in a larger font size.
- **Duplicate answers are clustered** — when two or more players submit the same number, a single dot is rendered at that position and their avatars are fanned horizontally (~16px overlap each) with player initials. The answer value is displayed once above the cluster. If more than 3 players share a value, a "+N" chip is appended. This replaces the old layout where overlapping labels became unreadable. Target and winner avatars use special colors/emoji in place of initials.
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
- **"Didn't answer" is distinct from "Passed"** — when a player never submits a guess and the round is revealed, the system auto-creates a guess row with `passed = true` AND `auto_passed = true`. The reveal card renders "Didn't answer" in a dimmer tone instead of "Passed", so the group can see who was AFK vs. who actively chose to skip. Both still earn 0 points (scoring treats `passed = true` the same either way). The Devdas badge (3+ passes) counts **only explicit passes**, never auto-passes — so players who just missed rounds don't get labelled "Devdas".
- Target player excluded from ranking

### 4.5 Game Over

When the organizer ends the game:
- "Game Over!" on all screens immediately
- Organizer game-over screen shows:
  - **"🔁 Play again — same group"** — triggers Replay flow (Section 13)
  - **"📤 Share Session Story"** — opens preview-first `ShareArtifactModal` (Section 12.4) with the Session Story image
  - **"📸 Save game card"** — opens Challenge Share Card PNG (Section 12.1)
  - **"🃏 Pre-select this pack next time"** — saves pack ID to localStorage; auto-selected on next host flow
  - **"👀 Full results (.txt)"** — plain text download
  - **"📤 Share your badge"** — only shown when `organizer_plays = true`; opens preview-first `ShareArtifactModal` with the host's badge + viral copy + meaningful filename
- Feedback widget shown (Section 15)

### 4.6 Always-visible panels (during active session)

**Leaderboard:**
- All non-organizer players (plus organizer when `organizer_plays = true`), sorted highest to lowest
- Each row colour-coded by join-order colour
- Rows animate on position change (↑↓ indicators)

**Question Bank:**
- Polls for new questions every 5 seconds
- Organizer can add questions manually
- **"📦 Sample Qs"** button — loads pre-seeded questions from `data/questions.json`. **Only visible when `NEXT_PUBLIC_DEV_MODE=true`** (dev/admin tool, never shown in production).
- Delete button shown **only** on non-preloaded questions
- **New This Session tray:** Questions added after page load, pinned above main list, pulsing amber. Dismissible per question.
- **Pack filter tab bar** (shown only when `session.pack_id` is set): "This Pack / All" tabs. Default is "This Pack" — filters approved questions to `q.pack_id === session.pack_id`. "All" shows every approved question. User-submitted questions (no pack_id) always visible in "All" tab.

### 4.7 Pause / Resume

- Organizer can pause at any time during an active session — including **during reveal** (while cards are animating one by one) and during the "Start Next Round" window after a round is done
- While paused: all player screens show "⏸️ Paused" banner; timer freezes; form remains active
- **Reveal animation also freezes while paused** — the auto-reveal card sequence stops advancing and resumes from exactly where it left off when the host unpauses
- Resuming restores: same round, same frozen timer, all answers intact, same reveal progress
- **Timer resume correctness**: `sessions.paused_at` (server timestamp) is written at pause time and cleared on resume. The active round's `started_at` is shifted forward by the pause duration so all clients compute the same remaining time. A **6-second resume buffer** in the Timer component prevents a premature drop-to-0 during the Realtime propagation window between `session.status` and `rounds.started_at` updates. The organizer client also (a) stamps `paused_at` into local session state on pause so it's always available on resume, and (b) sends that `paused_at` in the resume request body as a fallback so the server can still shift `started_at` correctly even if the sessions row read returns a stale/null `paused_at`. Regression-tested by `bugfixBatch7.test.ts` — resume must never show a lower remaining value than the one displayed at pause time.

### 4.8 End Game

Organizer can end the game at any time. Sets session to `ended`, triggers game-over for all participants.

---

## 5. Player Screen

### 5.1 Lobby

Players see:
- **Hunch logo** in header
- "Waiting for game to start..." message
- Pill buttons showing all joined players (own name highlighted)
- **Rotating tips** cycling every few seconds

### 5.2 Being the Target

When a player is the Target:
- Pulsing red banner: "🎯 YOU ARE THE TARGET THIS ROUND!"
- Rose/red tinted question card + page background
- Timer counts down
- Numeric input (`type="text" inputMode="numeric" pattern="[0-9]*"`) — iOS-safe, no decimal
- `onChange` strips all non-digit characters
- `onKeyDown` Enter submits
- "Submit My Answer 🔒" button
- After submitting: green confirmation + waiting message
- **Target cannot submit a guess — blocked server-side**
- During pause: "⏸️ Paused" banner, form remains active

### 5.3 Being a Guesser

When a player is not the Target:

**Target name is shown prominently above the question:**
> 🎯 GUESS WHAT **[TARGET NAME]** WILL SAY

Target name is large, bold, in the target's assigned player colour.

Below:
- Question text
- Timer
- Numeric input (`type="text" inputMode="numeric"`) — same iOS-safe pattern
- Optional reasoning textarea (if Show Reasoning is ON)
- "Submit Guess!" and "Pass" buttons
- During pause: "⏸️ Paused" banner, form fully active

### 5.4 Reveal Phase

- Same adaptive card timing as organizer screen
- Screen auto-scrolls to each newly revealed card
- Hot/Cold badge on each card (if enabled)
- Winner banner: personalized — "You win!" if this player won
- "+N points!" if player earned points
- Confetti only fires on the **top scorer's** own device — the player(s) with the highest points in the round. In Rich mode, 2nd and 3rd place earners do NOT receive confetti. For ties at 1st place, all tied winners get confetti. Uses per-round-id dedup ref so confetti fires reliably even when scores arrive slightly after the round.done event.

### 5.5 Game Over + Badge

Each player sees:
- "Game Over!" heading
- **Personal badge** — immediately visible (Section 11)
- **"📸 Share session card"** — Session Story image (Section 12.2)
- **"🎮 Host your own game"** CTA → `/start` with pack preset
- "👀 See full leaderboard" toggle — leaderboard includes host when `organizer_plays = true`
- Feedback widget (Section 15)
- Screen scrolls to top automatically when session ends
- **"Suggest a question" widget is hidden once the game is over** — only shown during an active session

### 5.6 Getting Removed

If organizer removes a player:
- Full-screen "You've been removed" message immediately
- No further interaction possible

### 5.7 Late Join + Rejoin

**Late Join:**
- Join API returns `late_join: true` when session is active/paused; join page writes `gtg_late_join` flag to localStorage
- Player page reads flag on mount: if `isLateJoiner && currentRound.status === 'guessing'`, shows "Hang tight! A round is already in progress. You'll jump in from the next round."
- Flag cleared (and hang-tight dismissed) when the current round reaches `done` status
- If session is already `ended`: join page detects `data.redirect` in 400 response and shows a full-page "This game has ended" screen with a "Start a new game →" CTA and "Try a different code" link

**Rejoin:**
- `player_token` saved to localStorage at first join
- Rejoin with same name on active session + matching token → rejoined, score intact
- Token missing/wrong → blocked with helpful error

### 5.8 Replay — Silent Auto-Rejoin

When organizer starts a replay:
- Player sees: "🔁 [Organizer] wants to play again! [Join] [Skip]"
- "Join" → reads name + player_token from localStorage → silent join → navigates to new room
- "Skip" → persistent "Rejoin [room code]" banner shown at bottom

### 5.9 Suggest a Question

- Collapsible widget visible **only while session is active** — hidden on game-over screen
- Text input + "Add" button (Enter key also submits)
- Success message for 3 seconds, input clears
- Appears in organizer's "New This Session" tray within 5 seconds

---

## 6. Present Screen (TV/Projector)

Display-only. No controls.

| Session State | What is shown |
|---|---|
| Lobby | Large room code + QR code + player count |
| Active — Guessing | Question text, target name, timer, submission counter |
| Paused | Question text, target name, "⏸️ Game paused — back in a moment" |
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

Two tied for 1st → both get 3pts, next player gets 2pts.

### 7.3 Passes

Always 0 points, regardless of mode.

### 7.4 Ties

- Simple: all tied get 1pt
- Rich: tied players share rank and points; next rank is immediately next (dense)
- Banner shows all tied winners: "🏆 [Name] & [Name] tie!"

---

## 8. Question Packs

### 8.1 Packs

| Pack | Energy Type | Character |
|---|---|---|
| Warm-up | `warmup` | Easy starters. Gets everyone comfortable. |
| Revealing | `revealing` | Genuine personal insights. "I didn't know that" moments. |
| Chaotic | `chaotic` | High spread expected. Wild guesses, big laughs. |
| Savage | `savage` | Playful embarrassment — requires group trust. |
| Office — Safe | `office_safe` | Work-appropriate for team bonding. |
| Office — Unfiltered | `office_unfiltered` | Honest workplace truths — for teams who keep it real. |

**Questions:** 90 total — 15 per pack. All Indian-context questions covering habits, social life, work, and fun.

### 8.2 Pack Selection

At room creation:
- 🎲 All Mixed — draws from all packs
- Any single pack — questions from that pack only
- Multiple packs selected — questions drawn from all selected packs

`pack_id` = null (Mixed) when 0 or 2+ packs selected; = pack's energy_type when exactly 1 selected.

### 8.3 Pack Exhaustion

1. Selected pack(s) run out → fall back to Mixed
2. Mixed exhausted → allow repeats (marked "played before")

---

## 9. Hot/Cold Hints

Shown on reveal cards only. Toggleable by organizer anytime — syncs to all screens in real time.

**Thresholds (percentage distance):**

| Badge | Condition |
|---|---|
| 🔥 Hot | Within 20% of target |
| ☀️ Warm | 20–50% off |
| 🧊 Cold | More than 50% off |

**Special case — Target = 0:** Uses absolute difference: <1 = hot, <5 = warm, ≥5 = cold.

---

## 10. Auto-Facilitation

### 10.1 Auto Target Rotation

- Order randomized at session start
- All players cycle before anyone repeats
- Organizer can override; rotation continues from next in queue
- No player targeted twice in a row

### 10.2 Auto Question Suggestion

- Top 3 questions surfaced after each round
- Filtered by current pack, excluding played questions
- Each suggestion shows energy type label

### 10.3 Timer Expiry Behaviour

Non-blocking modals.

**Case A — Target has not submitted:**
Modal: "Skip this round" or "Wait for them"

**Case B — Target submitted, some guessers haven't:**
Modal: "Reveal now" or "Wait a moment"

---

## 11. Badges

Each player receives exactly one badge at game over.

### 11.1 All Badge Types

Indian pop-culture references. All 13 badges guaranteed reachable (Babu Bhaiya is the unconditional fallback).

| Emoji | Badge | Condition | Copy |
|---|---|---|---|
| 🔮 | The Baba Vanga | 2+ exact guesses (distance = 0) | "Predicted it exactly. Seek help." |
| 🔥 | The Virat Kohli | Won 3+ consecutive rounds | "Played like every point was personal. Because it was." |
| 🕶️ | The Salman Khan | Most rounds won without being fastest submitter | "Broke every rule. Won anyway. That's Bhai." |
| 🎬 | The Aamir Khan | Highest accuracy + slowest avg submission | "Took forever. Was right. Perfectionist things." |
| 🏏 | The MS Dhoni | Closest guesser >50% of rounds AND not consistently fastest | "Cool head. Finished it every time." |
| 🕵️ | The Mogambo | Highest answer spread as Target (hardest to guess) | "Nobody could crack me tonight. Mogambo khush hua." |
| 🌟 | The SRK | Was the Target most rounds | "The whole room was thinking about me tonight. Obviously." |
| 🎙️ | The Arnab Goswami | Fastest to submit every round + lowest accuracy | "The nation demanded an answer. It was wrong." |
| 💰 | The Ambani | Consistently submitted the highest numbers | "Thought in crores. Answered in crores. Relatable? No." |
| ⚡ | The Hardik Pandya | Top 3 fastest avg submission + accuracy in top half | "No plan. Just vibes. It worked." |
| 😬 | The Gabbar Singh | Highest average distance from target | "Kitne aadmi the? Still completely wrong." |
| 👻 | The Devdas | Passed 3+ rounds | "Present. Suffering. Uninvolved." |
| 🤷 | The Babu Bhaiya | Fallback — no other badge applies | "Haan... nahi... pata nahi. Wrong every time." |

### 11.2 Badge Condition Formulas

| Badge | Exact formula |
|---|---|
| **Baba Vanga** | `exactGuesses >= 2` (distance = 0 as guesser, min 2 qualifying rounds) |
| **Virat Kohli** | 3+ consecutive rounds won (1st place) |
| **Salman Khan** | Most rounds won (1st place) without being fastest submitter in those rounds |
| **Aamir Khan** | Lowest avg distance overall AND slowest avg submission time — both required |
| **MS Dhoni** | Was closest guesser (1st) in >50% of rounds played AND `isFastestConsistently = false` |
| **Mogambo** | Highest `max(guesses) - min(guesses)` across rounds they were Target |
| **SRK** | Was Target more rounds than any other player |
| **Arnab Goswami** | Fastest avg submission AND highest avg distance — both required |
| **Ambani** | Highest avg submitted number as guesser |
| **Hardik Pandya** | Top 3 fastest avg submission AND accuracy within top half |
| **Gabbar Singh** | Highest avg absolute distance (worst accuracy, passes excluded) |
| **Devdas** | Passed 3+ rounds |
| **Babu Bhaiya** | Unconditional fallback |

**Minimum sample size:** Badge conditions require at least 2 qualifying rounds (e.g., Baba Vanga needs 2 rounds as guesser).

**Exclusivity:** Each badge awarded to at most one player per session. If two players tie for a badge, the priority list resolves it — the other player continues down to their next eligible badge.

### 11.3 Priority (rarest first, resolves ties)

Baba Vanga → Virat Kohli → Salman Khan → Aamir Khan → MS Dhoni → Mogambo → SRK → Arnab Goswami → Ambani → Hardik Pandya → Gabbar Singh → Devdas → Babu Bhaiya

**Organizer as player:** When `organizer_plays = true`, organizer participates in badge computation as a normal player. `computeBadge()` includes organizer in `nonOrgPlayers` when `session.organizer_plays` is true.

### 11.4 Badge Card (PNG)

- 1080×1080px via `/api/badge/[sessionId]/[playerId]`
- Generated server-side with Satori + Inter font (real ArrayBuffer — not system font)
- Design: ambient gradient glows, frosted inner card, player name above badge title, emoji drop-shadow, gradient dividers
- Dark background with gradient accents
- **Sharing uses the preview-first `ShareArtifactModal`** (Section 12.4) — no more surprise downloads or broken iOS Safari shares
- **Stat pills on card**: rank pill ("e.g. #2 of 5") + best distance pill ("Best: off by 3" or "🎯 Exact match!") — computed server-side, displayed both in the in-game `BadgeCard` component and embedded in the PNG image
- **`PlayerBadge` type fields**: `rank?: number`, `totalPlayers?: number`, `bestDistance?: number | null`
- **Attribution footer**: "Room CODE · Date · hunch.vercel.app · Built by Dheeraj Jain" — shown on the PNG for all badges including organizer's

---

## 12. Share Cards + Export

### 12.1 Challenge Share Card (PNG)

1200×630px. Available via "📸 Save challenge card" on organizer game-over.

**Content:**
- Header: title, room code, date, player count, round count
- Winner banner
- Top 6 leaderboard with player colour dots
- Best guess + biggest miss callouts
- Chaos Score label (Section 12.3)
- Pack name
- QR code linking to `/start?pack=[packId]` — rendered using `uqr` 2D array (`qr.data[y][x]`); 3×3px cells inline via Satori-compatible divs
- "Can your group beat this?" prompt

### 12.2 Session Story Image (PNG)

1200×630px landscape. Available via "📤 Share Session Story" (organizer) and "📸 Share session card" (every player).

**Content:**
- Header: room code, date, player count, round count
- "🏆 [Winner] wins with N pts"
- Tonight's Highlights: exact guesses, biggest miss, chaos score label
- Final leaderboard: all players with points + medals + colour dots
- Footer: site URL

Designed for WhatsApp inline preview.

Both share card images use real Inter font (loaded via `ogFonts.ts`) — no blank/white text issue.

### 12.4 Preview-first Share Workflow

All shareable artifacts (badge, session story) use the same `ShareArtifactModal` component:

1. User clicks a share button → a centred modal opens
2. **The image is displayed at full size inside the modal** — the user SEES what they're sharing before committing
3. The viral caption text is shown below the preview in its own panel
4. Three explicit actions:
   - **📤 Share** — opens native share sheet with image file + caption (shown only when `navigator.share` is available — mobile mostly)
   - **📥 Download image** — saves the image with a meaningful filename; works as the fallback on desktop
   - **📋 Copy caption** — writes the viral caption to clipboard for paste-anywhere
5. On mobile, a hint is shown: *"long-press the image to save it directly"*
6. Status line confirms success (Shared ✓ / Saved ✓ / Caption copied ✓) or surfaces errors

**Filename convention** — every downloadable artifact uses a meaningful filename that includes the player/host name and identifying detail, so files don't collide in the user's Downloads folder:

| Artifact | Filename format | Example |
|---|---|---|
| Badge PNG | `Hunch-Badge-<PlayerName>-<BadgeName>.png` | `Hunch-Badge-Dheeraj-BabaVanga.png` |
| Session story PNG | `Hunch-Game-<HostName>-<RoomCode>-<YYYY-MM-DD>.png` | `Hunch-Game-Dheeraj-ABC123-2026-04-11.png` |
| Challenge card | `hunch-<RoomCode>.png` | `hunch-ABC123.png` |

**Viral share copy** — every share event includes player/host name, badge identity, a boastable stat (rank, best distance, exact hit count), and a challenge link back to the game. Each badge has its own templated hook that plays to its personality (e.g. Baba Vanga: "predicted strangers' answers DOWN TO THE NUMBER"; Virat Kohli: "won three rounds in a row like every point was personal"). Session story copy leads with host name + player count + round count + winner callout. Implemented in `src/lib/shareCopy.ts`.

### 12.3 Chaos Score

**Calculation:** Average absolute distance of all guesses from all target answers across the session.

**Display:** Emoji + label only. Raw number never shown.

| Score | Emoji | Label | Description |
|---|---|---|---|
| ≤ 20 | 🎯 | Eerily Accurate | "Your group knows each other on a concerning level." |
| 21–50 | 😊 | Pretty Good Reads | "You know your friends. Mostly." |
| 51–100 | 😂 | Respectably Chaotic | "Your group gives each other absolutely no credit." |
| > 100 | 💀 | Beautiful Chaos | "Nobody knows anyone. Somehow still friends." |

---

## 13. Replay Flow

On organizer game-over: "🔁 Play again — same group" button.

1. New session created with new room code, same pack + settings
2. Organizer navigates automatically to new organizer screen
3. All current players receive realtime prompt: "🔁 [Organizer] wants to play again! [Join] [Skip]"
4. "Join" → silent auto-rejoin via localStorage token
5. "Skip" → persistent rejoin banner at bottom while new session in lobby

---

## 14. Brand Identity

### Logo

**Hunch H-mark** (SVG component `HunchLogo.tsx`):
- Square with rounded corners, `#0f172a` background
- Gradient border: purple (#7c3aed) → pink (#ec4899)
- Glow filter applied to border
- White H lettermark (3 rects: left vertical, crossbar, right vertical) with rounded caps
- `size` prop (default 40px); scales all dimensions proportionally
- **Homepage:** 64px logo + `text-4xl md:text-5xl` wordmark (largest — brand recall priority)
- **Start page:** 40px logo
- **Player page header:** 36px logo + "Hunch" wordmark (`text-sm font-black`) above room code
- **Organizer page header:** 36px logo + "Hunch" wordmark (`text-sm font-black`) above room code
- **Player lobby waiting screen:** 48px logo + `text-3xl` wordmark — prominent brand display while players wait
- Favicon: `/app/icon.svg` — hardcoded 32×32 version of same design

### Wordmark

"Hunch" in white, font-black, alongside the H-mark SVG. Appears on every screen — homepage, start page, in-game headers, and player lobby — to maximize brand recall.

### Colour Palette

- Background: `#0f172a` (slate-950)
- Primary: purple (`#7c3aed`) → pink (`#ec4899`) gradient
- Player colours: 10 distinct colours by join order; cycle after 10

### Landing Page

- Floating "game moment" bubbles (e.g., "💬 Priya said: 47", "💬 EXACT MATCH 🎯") in background
- Tagline: "How well do you know your friends?" — deliberately smaller (`text-lg md:text-xl`, `font-bold text-slate-300`) so the HUNCH brand dominates
- Two CTAs above fold: "🎮 Host a Game" → `/start`, "🙋 Join a Game" → `/join` (`py-4` mobile / `py-5` desktop so they stay tappable but don't eat fold space)
- **Social proof strip** (shown when `NEXT_PUBLIC_SHOW_STATS=true`): "X games played · Y players · Z rounds"
  - Fetched from `/api/stats` with 5-minute cache
  - Queries: ended sessions count, non-organizer players, rounds
  - **Hidden on `<640px` viewports** (`hidden sm:flex`) so the stats strip never pushes the footer below the iPhone fold
- **"How it Works" — 3 animated self-explanatory scene cards** (purple/pink/amber accents) connected by pulsing ↓ arrows. No numbered circles — the flow is self-explanatory. Rich CSS animations throughout:
  1. **Question scene** — CSS-illustrated question card with **HOST** badge (purple). Purple glow pulse on the card border. Cards slide up + fade in on page load (staggered 0.1s/0.35s/0.6s). Caption: "Host picks a question."
  2. **Guess scene** — **TARGET** player (Ananya) highlighted with rose border + rose glow pulse + "TARGET 🎯" badge below her name. Three guesser bubbles pop in with a scale-bounce animation (staggered 0.5s/0.7s/0.9s/1.1s). Caption: "Target answers secretly. Everyone else guesses!"
  3. **Reveal scene** — Trophy emoji bounces continuously. Winner card (Priya: 47) has amber shimmer glow. Caption: "Closest guess wins!"
  - Animations defined in `globals.css` as `hiw-*` keyframes. Pure CSS, no JS libraries.
  - Same 3-step content is used in the **HowToPlay.tsx modal** on the player page (text only, no illustrations). Badge step removed — 3 steps total.
- **"Built by Dheeraj Jain" footer visible above the fold on iPhone without scrolling** — main element uses `min-h-dvh` (dynamic viewport height) rather than `min-h-screen` so iOS Safari's URL bar is excluded from height calculations. Regression-tested by `bugfixBatch7.test.ts`.

### Audio

| Sound | Type | Trigger |
|---|---|---|
| Card reveal pop | Synthesized | Each reveal card animates in |
| Guess submit ding | Synthesized | Player submits guess |
| Winner fanfare | Real MP3 | Winner announcement |
| Crowd cheer | Real MP3 | Winner screen + confetti |
| Timer tick | Synthesized | Last 5 seconds |

Per-device 🔔/🔕 toggle in header. Default ON. Saves to localStorage.

---

## 15. OG / Social Metadata

Set in `layout.tsx`:
- `metadataBase`: production URL
- `openGraph`: title, description, URL, site name, locale, type
- `twitter`: card type, title, description
- `themeColor`: `#0f172a`

Ensures proper WhatsApp/iMessage/Twitter unfurl previews when sharing game links.

---

## 16. Feedback Collection

Shown on game-over screen for organizer and all players.

- Emoji rating (required): 😭 😐 😊 🤩
- Optional free-text comment
- "Submit anonymously" checkbox
- Never blocking — always dismissible
- Feedback stored by room code (not player identity)

---

## 17. Security Rules

Enforced server-side.

| Rule | Detail |
|---|---|
| Organizer-only actions | Start round, reveal, skip, end game, remove player, pause, calculate winner — verified against organizer player ID |
| Target cannot guess | Target player cannot submit a guess — blocked server-side |
| Only Target can answer | Non-target players cannot submit a target answer — blocked server-side |
| One answer per round | Duplicate target answers rejected |
| Rejoin identity | Rejoin requires matching `player_token` from localStorage |

---

## 18. Known Intentional Limitations

Deliberate non-features in v4:

- **No analytics dashboard** — question events logged silently, no UI yet
- **Present screen is display-only** — no interactive controls
- **No in-session settings changes** — timer, scoring mode etc. locked once session starts
- **No custom pack creation** — pre-loaded packs only; player-submitted questions go to general pool
- **Badges are session-scoped** — one session only, not cumulative history
- **Rejoin works same browser/device only** — cross-device recovery not supported
- **Office packs not in Auto-Facilitation rotation** — Auto target rotation and question suggestion do not have special office pack phase logic (Party Mode still uses warm-up → mixed transition)
