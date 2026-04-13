# GTG — Agreed Decisions Log

This file records every decision agreed during the pre-fix brainstorm session.
Updated as each item is discussed and agreed. Used as the spec when fixing.
Feature spec (FEATURE-SPEC.md) will be updated at the end based on this file.

---

## Status key
- ✅ Agreed — ready to implement
- 🔄 In discussion
- 🅱️ Backlog — agreed to defer
- ❌ Won't fix / intentional

---

## GROUP 1 — Fix Before Party (Bugs)

### G1-1. Auto-rotate — same player targeted twice
**Your item:** Raw list #1
**Status:** ✅ Agreed
**Decision:** Rotation queue built once at session start (randomized). Each player targeted exactly once per cycle before repeating. After full cycle, reshuffle. Organizer override selects specific player; rotation continues from next in queue. Edge cases (removed player mid-cycle) not handled — keep simple.
**Type:** Bug fix

### G1-2. Blank QR code on session card
**Your item:** Raw list #4 / #9a
**Status:** ✅ Agreed
**Decision:** Pre-generate QR as base64 PNG data URL outside satori (in the route handler), then pass as `<img src="data:..." />` into the satori JSX. No external dependency. Library: `qrcode` (supports edge/browser environments).
**Type:** Bug fix

### G1-3. Replay → redirects to join page instead of waiting screen
**Your item:** Raw list #5
**Status:** ✅ Agreed
**Decision:** Option A — silent auto-rejoin. When player taps "Join" on replay prompt: read name + player_token from localStorage → call /api/join-room silently → redirect directly to /room/[newCode]/player/[newPlayerId]. No form, no friction.
**Exception handling:**
- localStorage empty (name/token missing) → fallback to pre-filled join form (Option B)
- API call fails → show retry button, short message "Couldn't join — tap to try again"
- Player taps Skip then changes mind → persistent "Rejoin [room code]" banner on game-over screen while new session is in lobby
- New session already started → handled by existing late-join flow ("Hang tight — joining after this round")
**Type:** Bug fix + UX improvement

### G1-4. Organizer screen not updating after rematch when player joins
**Your item:** Raw list #6
**Status:** ✅ Agreed
**Decision:** Each replay creates a new session with a new room code. Everyone's URL changes. Fix: after successful replay API call, organizer page navigates to `/room/[newCode]/organizer` via router.push. Fresh page load = fresh init() = correct subscriptions. No subscription teardown complexity needed. Players handled by G1-3 silent auto-rejoin flow.
**Type:** Bug fix

### G1-5. Multiple players showing same colour on leaderboard
**Your item:** Raw list #13
**Status:** ✅ Agreed
**Decision:** Option B — derive colour from join order. Sort players by created_at, assign colour index by position (0, 1, 2...). No DB change needed. Every screen independently derives the same colour since all screens have the player list with created_at. Guaranteed unique within a session.
**Type:** Bug fix

### G1-6. Game stuck after removing a player mid-game
**Your item:** Raw list #16
**Status:** ✅ Agreed
**Decision:** Handle all three causes cleanly, no extra warning dialog:
1. Removed player was current target → auto-skip current round (no points), show organizer "Target player was removed — round skipped", move to Start Next Round state
2. Removed player in rotation queue → remove their ID from queue on deletion, next round picks next valid player
3. Removed player in submission grid → remove from eligible count, recompute so Reveal button ungates correctly
No extra warning when removing current target — organizer is expected to remove between rounds, not during.
**Type:** Bug fix

### G1-7. Pause — timer still runs on organizer screen + enhancement
**Your item:** Raw list #17
**Status:** ✅ Agreed
**Decision:** Two parts:
1. Bug fix: timer freezes when session.status === 'paused', resumes from frozen value on status → active. Timer is driven by session status, not local component state alone.
2. Enhancement: Pause is a legitimate "thinking time" tool. During pause:
   - Player (guesser): question + target name visible, form fully functional, can submit normally — no hint text, form visually active (not greyed out)
   - Player (target): question visible, answer form fully functional, can submit normally
   - Both player screens: small "⏸️ Paused" status banner at top, not blocking the form
   - Organizer: "⏸️ Paused" indicator, timer frozen, "▶️ Resume" button prominent
   - Present: question + target name visible, "⏸️ Game paused — back in a moment"
No explicit "you can submit during pause" hint — keeping form visually active is sufficient signal.
**Type:** Bug fix + feature enhancement

### G1-8. End game before reveal — sounds still play, winner logic fires
**Your item:** Raw list #21
**Status:** ✅ Agreed
**Decision:** Hard stop on everything when session.status === 'ended'. Every realtime handler on player + organizer screens checks session.status before executing any round-level logic — if ended, ignore the event entirely. Same gate on all sound triggers. Mid-reveal when game ends → cut off immediately, no partial reveals. No edge case complexity for now.
**Note:** Session data (question_events, rounds, guesses, scores) is sufficient to debug past sessions and surface insights — v4 analytics dashboard will surface this.
**Type:** Bug fix

---

## GROUP 2 — Design Decisions

### G2-1. Skip round — should partial answers be revealed?
**Your item:** Raw list #6 (feature spec list)
**Status:** ✅ Agreed
**Decision:** Always clean skip — no reveal of partial guesses. Show a brief toast on all screens: "Round skipped — no points awarded." Fast, clean, no config needed.
**Deferred to v4:** Configurable "show partial guesses on skip" option.
**Type:** Design decision (no code change needed — current behaviour is correct, just add toast)

### G2-2. Badges — rethink and expand
**Your item:** Raw list #24
**Status:** ✅ Agreed
**Decision:** 13 Indian pop culture badges replacing generic set. Badge card shows: badge name (= reference, large) + copy line (smaller). Both visible — people who get the reference laugh, people who don't still understand from the copy.

| Badge | Emoji | Condition | Copy |
|-------|-------|-----------|------|
| The Baba Vanga | 🔮 | 2+ exact guesses | "Predicted it exactly. Seek help." |
| The MS Dhoni | 🏏 | Closest guesser most rounds | "Cool head. Finished it every time." |
| The Virat Kohli | 🔥 | Won 3+ consecutive rounds | "Played like every point was personal. Because it was." |
| The Aamir Khan | 🎬 | Highest accuracy overall + slowest avg submission | "Took forever. Was right. Perfectionist things." |
| The Salman Khan | 🕶️ | Most rounds won without being fastest submitter | "Broke every rule. Won anyway. That's Bhai." |
| The Mogambo | 🕵️ | Highest answer spread as target | "Nobody could crack me tonight. Mogambo khush hua." |
| The Gabbar Singh | 😬 | Highest avg distance from target | "Kitne aadmi the? Still completely wrong." |
| The Devdas | 👻 | Passed 3+ rounds | "Present. Suffering. Uninvolved." |
| The Arnab Goswami | 🎙️ | Fastest to submit every round, lowest accuracy | "The nation demanded an answer. It was wrong." |
| The SRK | 🌟 | Was target most rounds | "The whole room was thinking about me tonight. Obviously." |
| The Ambani | 💰 | Submitted highest numbers across all rounds | "Thought in crores. Answered in crores. Relatable? No." |
| The Hardik Pandya | ⚡ | Consistently fastest to submit, decent accuracy | "No plan. Just vibes. It worked." |
| The Babu Bhaiya | 🤷 | Never within 50% of any target answer | "Haan... nahi... pata nahi. Wrong every time." |

**Priority order (tie-breaking, rarest first):**
Baba Vanga → Aamir Khan → Virat Kohli → MS Dhoni → Mogambo → Salman Khan → SRK → Arnab → Ambani → Hardik Pandya → Gabbar Singh → Devdas → Babu Bhaiya

**Deferred to v4:** Full visual redesign of badge card (high-end graphics, gradients, Instagram-worthy). Copy and conditions may also be revisited with more player data.
**Type:** Feature change (replaces existing badge logic entirely)

### G2-3. Full results .txt — replace with something shareable
**Your item:** Raw list #27
**Status:** ✅ Agreed
**Decision:** Replace .txt entirely with a "Session Story" image — a single WhatsApp-shareable PNG that tells the narrative of the session. Different purpose from the challenge card:
- Challenge card = for new groups ("beat our score")
- Session story = for the group that just played ("remember this?")

Session Story image content:
- Header: room code, date, player count, round count
- Winner banner: "🏆 [Name] wins with N pts"
- Tonight's Highlights section: 3-4 funny/notable moments (exact guesses, biggest miss, consecutive wins, chaos score label)
- Final leaderboard: all players with points + medals
- Single image, previews inline on WhatsApp — no clicking, no downloading needed

On organizer game-over screen: "📤 Share Session Story" button (replaces "Export full results (.txt)").
**Deferred to v4:** Individual round highlights, funniest reasoning quotes from players.
**Type:** Feature change (replaces .txt export)

### G2-4. Chaos score — not understandable to users
**Your item:** Raw list #28
**Status:** ✅ Agreed
**Decision:** Remove raw number entirely. Show only emoji + label + one-line group descriptor. Add tiny footnote: "Lower = eerily accurate. Higher = beautiful chaos." for curious readers.

Labels:
- ≤20: 🎯 Eerily Accurate — "Your group knows each other on a concerning level."
- 21–50: 😊 Pretty Good Reads — "You know your friends. Mostly."
- 51–100: 😂 Respectably Chaotic — "Your group gives each other absolutely no credit."
- >100: 💀 Beautiful Chaos — "Nobody knows anyone. Somehow still friends."

Applied on: challenge card + session story image.
**Type:** Design change

### G2-5. Per-player sound toggle + organizer mute
**Your item:** Raw list #29d
**Status:** ✅ Agreed
**Decision:** Individual sound toggle only. 🔔/🔕 button in header of player screen + organizer screen. Saves to localStorage. Default ON. Affects only that device. No server interaction, no organizer-level mute — players self-manage.
**Type:** New feature

---

## GROUP 3 — Bigger Scope Tasks

### G3-1. Questions rewrite — Indian context, all 4 packs
**Your item:** Raw list #2 + #22
**Status:** ✅ Agreed
**Decision:** 4 packs × 15 questions = 60 questions total. Drop "Living Under a Rock" entirely. All existing seeded questions deleted and replaced.

Packs:
1. Warm-up — easy, low-risk, high energy, instantly answerable
2. Revealing — personal, genuine, creates "I didn't know that" moments
3. Savage — medium savage, benchmark = "how many exes still think about you" energy
4. Big Numbers — Fermi estimation, tests how someone thinks not what they know

Quality rules for every question:
- One condition, one number, answerable in under 5 seconds
- No clarification needed from organizer or target
- Party energy — makes room lean forward, not zone out
- Indian context where natural (WhatsApp, Swiggy, weddings, cricket, crores)
- Funny when wrong — wildly wrong guess is as entertaining as right one

Quality improvement mechanism:
- Analytics hooks already in place (question_events table logs shown/picked/skipped/completed)
- No post-session rating UI for now
- Manual review by owner using analytics data — deferred to v4
- v4 will surface pass rate, answer spread, skip rate per question for data-driven replacement

**Questions frozen at draft version — owner will do independent research and drop ideas before implementation. Do NOT commit to data/questions.json until owner reviews and approves final set.**
**Type:** Content task

### G3-2. Visual design pass — badge card + session card
**Your item:** Raw list #25 + #26
**Status:** ✅ Agreed
**Decision:** Both cards use dark background with player colour as accent (consistent, readable across all player colours).

Badge card (1080×1080):
- Dark background, player colour as accent border/glow ring
- Giant emoji (160px+) centered with subtle white glow ring
- Badge name in large bold white text (large)
- Copy line in smaller weight below
- Bottom strip: game name + date in contrasting colour
- Feels like a personal identity card

Session story card (1200×630 landscape):
- Landscape chosen for WhatsApp inline preview — entire leaderboard visible without tapping
- Split layout: left third = dark panel with winner name + chaos score label, right two-thirds = leaderboard + highlights
- Each leaderboard row uses player colour dot
- "Tonight's highlights" section with 2-3 funny callouts in accent colour
- Bold room code in top corner as stamp/watermark
**Type:** Feature improvement (visual redesign of existing cards)

### G3-3. Font change
**Your item:** Raw list #29a
**Status:** ✅ Agreed
**Decision:** Replace Space Grotesk with Plus Jakarta Sans. Single font family, multiple weights. Applied globally. Reason: energetic, slightly rounded, premium feel on mobile, works at all sizes, familiar to Indian consumer app audience.
**Type:** Visual change

### G3-4. Audio overhaul
**Your item:** Raw list #29c
**Status:** ✅ Agreed
**Decision:** Option C — hybrid approach.
- Crowd cheer + winner fanfare: replace with real royalty-free MP3 files (Freesound.org / Pixabay). Under 3s each, under 50KB total.
- Card reveal: resynthesize with warmer pop sound (Web Audio API, better tuned)
- Timer tick + guess submit ding: keep as synthesized (nobody notices these)
**Type:** Feature improvement

---

## GROUP 4 — Backlog (defer, not party-critical)

### G4-1. Removed player tries to rejoin
**Your item:** Raw list #4 (feature spec list)
**Status:** 🅱️ Backlog

### G4-2. Waiting for game to start — fun animation
**Your item:** Raw list #19
**Status:** 🔄 In discussion

### G4-3. Player joins with same name as host
**Your item:** Raw list #20
**Status:** 🅱️ Backlog

---

## REMAINING ITEMS

### R-1. QR code on present screen for player join
**Your item:** Raw list #3
**Status:** ✅ Agreed
**Decision:** Add QR code to present screen lobby state. Encodes `/join?code=[roomCode]`. Player scans → lands on join page with code pre-filled → enters name → taps join. Same base64 data URL approach as G1-2.
**Type:** New feature

### R-2. Reveal animation speed with many players
**Your item:** Raw list #7
**Status:** ✅ Agreed
**Decision:** Adaptive timing based on player count:
- Cards 1 to (n-3): 0.8s each — fast, keeps energy up
- Cards (n-2) and (n-1): 1.5s each — tension building
- Last card (target's answer): 2.5s — the big moment
Result: 10 players = ~11s total (vs 17s flat), 4 players = ~6s. Drama preserved at the end, monotony eliminated at the start.
**Deferred to v4:** Fine-tune timing based on real session feedback.
**Type:** Feature improvement

### R-3. Too many players = scrolling chaos on UI
**Your item:** Raw list #8
**Status:** ✅ Agreed
**Decision:** Auto-scroll to each newly revealed card during animation. Everything else (number line, leaderboard) stays as-is — not a real problem at current player counts.
**Type:** UX improvement

### R-4. Share badge not working (localhost)
**Your item:** Raw list #10
**Status:** ❌ Not a bug — expected localhost limitation
**Decision:** next/og edge runtime calls Vercel's font service which fails on localhost without internet tunnel. Verify on deployed Vercel app before party. No code change needed.
**Type:** No action

### R-5. "Use this same pack next time" option missing
**Your item:** Raw list #11
**Status:** ✅ Agreed
**Decision:** Implement as designed. Button on organizer game-over screen writes current session's pack_id to localStorage as lastUsedPackId. On next /start visit, that pack is pre-selected in the pack dropdown.
**Type:** Bug fix / missing feature

### R-6. Target name not prominent enough on player screen
**Your item:** Raw list #12
**Status:** ✅ Agreed
**Decision:** Redesign question card on player (guesser) screen. Target name must be the first thing the eye hits — above the question text, large, bold, in target's assigned player colour.
Layout:
- Top: "🎯 GUESS WHAT [TARGET NAME] WILL SAY" — large, bold, coloured
- Below: question text in normal size
Applies to: player guesser screen only (target player sees their own card unchanged).
**Type:** UX improvement

### R-7. Deleting question causes leaderboard refresh + delete criteria
**Your item:** Raw list #14
**Status:** ✅ Agreed
**Decision:** Two fixes:
1. Isolate question polling state from leaderboard state — question refresh should not trigger leaderboard re-render. Simple component state separation.
2. Delete button only shown on non-preloaded questions (source !== 'preloaded'). Preloaded questions have no delete button at all — not even disabled. Organizer can delete player-submitted + manually added questions from any session.
**Type:** Bug fix + UX clarification

### R-8. What does "Sample Qs" button do
**Your item:** Raw list #15
**Status:** ✅ Agreed
**Decision:** Rename "📦 Sample Qs" to "📦 Load Question Bank". Hide button entirely once pre-loaded questions already exist in the bank. Button reappears only if all pre-loaded questions have been deleted.
**Type:** UX clarification

### R-9. Selected question not reflected in Start Next Round panel
**Your item:** Raw list #18
**Status:** ✅ Agreed
**Decision:** Once a question is selected from any source, "Start Next Round" panel replaces the 3 suggestions with:
"✅ Selected: [question text]" + "[✕ Change question]" link to deselect and go back to suggestions.
Selected question also highlighted in the bank list (checkmark + border accent).
**Type:** UX fix

### R-10. Waiting for game to start — fun animation
**Your item:** Raw list #19
**Status:** ✅ Agreed
**Decision:** Option C — existing player list stays + add rotating tips below it. Tips rotate every few seconds:
- "💡 Think about how THEY think, not how you'd answer"
- "💡 Rich Mode: 1st=3pts, 2nd=2pts, 3rd=1pt"
- "💡 You can Pass any round — but no points for passing"
- "💡 Reasoning is half the fun — make it creative"
- "💡 The closest guess wins — not the highest or lowest"
**Type:** UX improvement

### R-11. Pack selection mechanism — explain + confirm
**Your item:** Raw list #23
**Status:** ✅ Agreed
**Decision:** Pack mechanism confirmed as designed with one change — Savage included in Mixed from round 5+ (not excluded entirely).

Updated Party Mode question suggestion rules:
- Rounds 1–2: Warm-up only
- Rounds 3–4: Mixed (Warm-up + Revealing + Chaotic)
- Round 5+: Mixed + Savage
- Every suggested question shows its energy type label so organizer knows what they're picking
- Organizer always in control — suggestions are a convenience, not a lock
- Already-played questions always excluded regardless of pack phase
**Type:** Design clarification + minor rule change

### R-12. Landing page background animation not visible
**Your item:** Raw list #29b
**Status:** ✅ Agreed
**Decision:** Replace existing floating numbers with floating "game moment" bubbles — snapshots of real game moments drifting slowly across the screen at varying sizes and opacities:
- "💬 Priya said: 47"
- "💬 Rahul guessed: 12"
- "💬 How many unread texts...?"
- "💬 🏆 Ananya wins!"
- "💬 Off by 200 😬"
- "💬 EXACT MATCH 🎯"

Landing page layout (everything above the fold on mobile):
- Floating game moment bubbles as background
- Headline: "How well do you know your friends?" — large, bold, center
- Subline: "The number guessing game that reveals everything."
- Two CTA buttons: "Host a Game" → /start, "Join a Game" → /join

Goal: visitor understands the game concept in 5 seconds without reading anything.
**Type:** Feature redesign

### R-13. Session card available to every player
**Your item:** Raw list #7 (observation list)
**Status:** ✅ Agreed
**Decision:** Session card (challenge share card) available to ALL players on their game-over screen — not just organizer. Same identical image for everyone — session card is a group artifact, badge handles the personal layer. Player game-over screen shows: badge + "📤 Share my badge" + "📸 Share session card" + "🎮 Host your own game".
**Type:** Feature change

### R-14. Party mode default timer → 60 seconds
**Your item:** Raw list #2 (feature spec list)
**Status:** ✅ Agreed
**Decision:** Change Party Mode default timer from 45s to 60s. No other timer changes.
**Type:** Config change

