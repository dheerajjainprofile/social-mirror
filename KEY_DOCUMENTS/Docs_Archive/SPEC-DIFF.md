# Feature Spec Diff — v3 → v3.1

Changes between the original FEATURE-SPEC.md and the updated version.
Based on all decisions agreed in DECISIONS.md.

---

## CHANGED

### Party Mode default timer
- **Before:** 45 seconds
- **After:** 60 seconds

### Reveal animation timing
- **Before:** Fixed 1.5s per card, 2s before last card (flat for all player counts)
- **After:** Adaptive timing — early cards at 0.8s, last 3 cards at 1.5s/1.5s/2.5s. Reduces total reveal time for large groups while preserving drama at the end.

### Player colour assignment
- **Before:** Deterministic hash of player ID → colour. Could produce duplicates.
- **After:** Assigned by join order (first to join = colour 0, second = colour 1, etc.). Guaranteed unique within a session.

### Badges — completely replaced
- **Before:** 7 generic badges (Psychic, Best Friend, Chaos Agent, Most Unpredictable, On Fire, Consistent, Wildcard)
- **After:** 13 Indian pop culture badges (Baba Vanga, Aamir Khan, Virat Kohli, MS Dhoni, Mogambo, Salman Khan, SRK, Arnab Goswami, Ambani, Hardik Pandya, Gabbar Singh, Devdas, Babu Bhaiya). Badge card shows name + copy line — name is the reference, copy explains it.

### Chaos Score display
- **Before:** Raw number shown with a label below it. Confusing — users didn't know if high was better or worse.
- **After:** Raw number hidden entirely. Shows emoji + label + one-line description only. Footnote: "Lower = eerily accurate · Higher = beautiful chaos."

### Full results export
- **Before:** Plain `.txt` file download. Dry, not shareable.
- **After:** Replaced with **Session Story image** (1200×630 PNG) — WhatsApp-ready recap showing winner, highlights, leaderboard, chaos score label. Available to ALL players (not just organizer). `.txt` kept as a secondary "raw data" option.

### Challenge Share Card
- **Before:** Session card was organizer-only.
- **After:** Session card (challenge share card) available to every player on their game-over screen.

### Font
- **Before:** Space Grotesk
- **After:** Plus Jakarta Sans — friendlier, slightly rounded, better mobile rendering

### Audio
- **Before:** All sounds synthesized via Web Audio API. Felt generic/notification-like.
- **After:** Hybrid — winner fanfare + crowd cheer replaced with real MP3 files. Card reveal pop resynthesized with warmer tone. Tick + submit ding remain synthesized.

### Landing page
- **Before:** Floating numbers (low opacity, barely visible). Decorative only.
- **After:** Floating "game moment" bubbles (e.g., "💬 Priya said: 47", "💬 EXACT MATCH 🎯"). Communicates game concept visually before reading. New headline/subline. Two CTAs above fold: "Host a Game" + "Join a Game".

### Question Bank button
- **Before:** "📦 Sample Qs" — always visible, unclear purpose.
- **After:** "📦 Load Question Bank" — hidden when pre-loaded questions already exist. Reappears only if all pre-loaded questions deleted.

### Savage in Mixed (Party Mode)
- **Before:** Savage excluded from Mixed entirely.
- **After:** Savage included in suggestions from round 5+ in Party Mode. Organizer still chooses which suggestion to pick — not forced.

### Pause behaviour (player screen)
- **Before:** Player forms disabled during pause (confusing — felt like app was broken).
- **After:** Forms remain fully functional during pause. "⏸️ Paused" banner at top only. Players can submit answers/guesses during pause.

### Pause behaviour (timer)
- **Before:** Timer continued counting on organizer screen during pause (bug).
- **After:** Timer freezes at current value on all screens when paused. Resumes from frozen value on resume.

### Present screen — pause state
- **Before:** Not specified.
- **After:** Shows question text + target name + "⏸️ Game paused — back in a moment" during pause.

### Present screen — lobby QR code
- **Before:** Only large room code shown in lobby.
- **After:** QR code added in lobby state. Scanning pre-fills the room code on the join page.

### Skip round
- **Before:** Silent — no feedback to players.
- **After:** Toast appears on all screens: "Round skipped — no points awarded."

### Replay flow — player experience
- **Before:** Player redirected to `/join` page to re-enter details.
- **After:** Silent auto-rejoin — reads name + player_token from localStorage, calls API, navigates directly to new room's player screen. No form shown. Fallbacks: empty localStorage → pre-filled form. API failure → retry button.

### Organizer screen after replay
- **Before:** Stayed on old session page — player joins not reflected (bug).
- **After:** Organizer navigates automatically to new room's organizer screen on replay creation.

### Guesser question card — target name prominence
- **Before:** Target name mentioned in card but not dominant.
- **After:** "🎯 GUESS WHAT [TARGET NAME] WILL SAY" shown prominently above the question text. Target name large, bold, in their assigned colour. Eye hits target name before reading the question.

### Selected question UX
- **Before:** Selecting a question didn't clearly replace the suggestion panel — organizer unsure which question was selected.
- **After:** On selection, suggestion panel replaced with "✅ Selected: [question text]" + "[✕ Change question]" link. Selected question highlighted in bank list.

### Removing a player mid-game
- **Before:** Game could get stuck if target player was removed mid-round.
- **After:** If removed player was current target → round auto-skips. Removed from rotation queue. Submission grid recomputes eligible count. No game freeze.

### End game mid-round
- **Before:** Sounds, winner banners, round logic could still fire after game ended.
- **After:** Hard stop — all realtime handlers check `session.status === 'ended'` before executing. No sounds, no banners, nothing fires after game ends.

---

## NEW

### Sound toggle (per device)
🔔/🔕 button in header on player screen and organizer screen. Default ON. Saves to localStorage. Affects only that device.

### Auto-scroll on reveal
Screen auto-scrolls to each newly revealed card as it animates in. Prevents needing to manually scroll during reveal.

### Rotating tips in lobby (player screen)
5 gameplay tips rotate below the player list while waiting for game to start. Teaches new players, builds anticipation.

### "Use this same pack next time"
Button on organizer game-over screen. Saves pack_id to localStorage. Pre-selected on next visit to `/start`.

### Session Story image API
New `/api/session-story/[code]` endpoint generating a 1200×630 WhatsApp-friendly recap image of the session.

### Game concept — remote play
Added: game works over video calls (Zoom, Teams) — not restricted to physical co-location.

---

## REMOVED / DEPRECATED

### Wildcard badge
Replaced by "The Babu Bhaiya" — same fallback purpose, much more shareable.

### Consistent badge
Replaced by "The Aamir Khan" — same slow+accurate behaviour, funnier reference.

### On Fire badge
Replaced by "The Virat Kohli" — same consecutive wins condition, stronger brand.

### Best Friend badge
Replaced by "The MS Dhoni" — same condition, better cultural resonance.

---

## DEFERRED TO v4

- High-end graphics for badge card and session story (gradient backgrounds, glow effects)
- Full questions rewrite with Indian context (frozen pending owner research)
- Post-session question rating for quality improvement
- Analytics dashboard (question pick/pass/skip rates)
- Reveal timing fine-tuning based on real session feedback
- Configurable "show partial guesses on skip" option
- Removed player rejoin handling (currently: same name blocked, different name allowed)
