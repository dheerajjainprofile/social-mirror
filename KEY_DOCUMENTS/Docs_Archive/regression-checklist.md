# Regression Checklist — Guessing the Guess (v3)

Run this before every deploy and before every party. Takes 15–20 minutes on 2–3 devices.
Updated to reflect all decisions agreed in DECISIONS.md.

---

## 1. Room Creation — `/start`

- [ ] Open `/start` — shows two options: "🎉 Party Mode" and "⚙️ Custom"
- [ ] Party Mode: only name field required → creates room with correct defaults (timer=60s, scoring=rich, reveal=manual, reasoning=on, hot/cold=on)
- [ ] Custom mode: all 6 fields available and configurable
- [ ] Submit → redirects to `/room/[code]/organizer`
- [ ] Room code in header: 6 chars, no I/O/1/0
- [ ] `localStorage` contains `gtg_name`, `gtg_player_id`, `gtg_session_id`

---

## 2. Join Flow

- [ ] Open `/join` on second device, enter room code + name → joins successfully
- [ ] Organizer sees player appear in lobby list in real time (no refresh needed)
- [ ] Joining with same name as existing player → blocked: "This name is already taken"
- [ ] Joining a non-existent code → "Room not found" error
- [ ] Name is trimmed and title-cased ("dheeraj jain" → "Dheeraj Jain")
- [ ] Player limit: 13th player attempting to join → blocked with room full error
- [ ] Present screen (`/present`) shows large room code + QR code in lobby state
- [ ] Scanning QR code → lands on `/join?code=[roomCode]` with code pre-filled

---

## 3. Lobby

- [ ] "Start Game!" disabled until 1+ player joined + question selected + target selected
- [ ] Organizer can remove a player (× → confirm dialog → player removed from list)
- [ ] Removed player sees "You've been removed" screen immediately (no refresh)
- [ ] Player list updates in real time as players join — no manual refresh needed
- [ ] Rotating tips visible on player waiting screen below player list
- [ ] Tips cycle every few seconds on player waiting screen

---

## 4. Player Colour Assignment

- [ ] Each player has a distinct colour on the leaderboard — no two players share the same colour
- [ ] Colours are consistent across all screens (organizer leaderboard, player screen, present screen)
- [ ] Colour is based on join order — first to join gets colour 0, second gets colour 1, etc.
- [ ] Colours remain stable after page refresh

---

## 5. Round — Guessing Phase

- [ ] Question displays correctly on all screens (organizer, player, present)
- [ ] Target player sees rose background + "YOU ARE THE TARGET" banner
- [ ] Guesser screen shows "🎯 GUESS WHAT [TARGET NAME] WILL SAY" prominently above question text
- [ ] Target name is large, bold, and in target's assigned player colour on guesser screen
- [ ] Timer counts down if configured — timer value correct per mode (60s for Party Mode)
- [ ] SubmissionGrid shows ✓ as each player submits
- [ ] "Reveal Answers!" button disabled until target submits their answer
- [ ] Target player cannot submit a guess (blocked server-side)
- [ ] Only target player can submit their answer (non-target blocked server-side)
- [ ] Session paused → "⏸️ Paused" banner appears on player screen, form remains fully active
- [ ] Session paused → timer freezes at current value
- [ ] Session paused → player can still submit guess/answer during pause
- [ ] Session resumed → timer resumes from frozen value

---

## 6. Pause / Resume

- [ ] Organizer pause button available during active round
- [ ] On pause: all player screens show "⏸️ Paused" status banner at top
- [ ] On pause: player input forms remain visible and functional (not disabled)
- [ ] On pause: organizer screen shows "▶️ Resume" button prominently
- [ ] On pause: present screen shows question + target name + "⏸️ Game paused — back in a moment"
- [ ] On pause: organizer timer freezes at current value (no countdown during pause)
- [ ] On resume: timer continues from where it froze
- [ ] On resume: all screens return to active state

---

## 7. Round — Reveal Phase

- [ ] Cards animate in with adaptive timing: early cards at 0.8s, last 3 at 1.5s/1.5s/2.5s
- [ ] Screen auto-scrolls to each newly revealed card as it animates in
- [ ] Hot/Cold badge shown on each card (if enabled)
- [ ] Hot/Cold toggle changes reflect on all screens within ~1s
- [ ] Winner banner appears after all cards: "🏆 [Name] wins this round!"
- [ ] Tie banner: "🏆 [Name] & [Name] tie this round!"
- [ ] Confetti fires on winner's device only
- [ ] Number line appears showing all guesses + target answer
- [ ] Skip round → toast appears on all screens: "Round skipped — no points awarded"
- [ ] Skip round → no reveal, no cards, no winner banner

---

## 8. Scoring — Tie Scenarios

- [ ] **Simple mode exact 2-way tie** — both players get 1pt, banner shows "X & Y tie"
- [ ] **Rich mode 2-way tie for 1st** — both get 3pts, next closest gets 2pts
- [ ] **Rich mode 3-way tie for 1st** — all three get 3pts
- [ ] **Rich mode partial tie for 2nd** — p1=3pts, p2+p3 tied 2nd=2pts each, p4=1pt
- [ ] **Rich mode all same answer** → everyone gets 3pts
- [ ] Pass = 0 pts always, in both modes

---

## 9. Next Round + Leaderboard

- [ ] "Start Next Round" panel appears after reveal completes
- [ ] 3 suggested questions shown, filtered by current pack phase
- [ ] Each suggested question shows its energy type label (Warm-up / Revealing / Chaotic / Savage)
- [ ] Selecting a question from bank → "✅ Selected: [question text]" replaces the 3 suggestions
- [ ] Selected question highlighted in bank list with checkmark + border
- [ ] "[✕ Change question]" link deselects and returns to 3 suggestions
- [ ] Leaderboard updates with points from completed round
- [ ] Leaderboard sorted highest to lowest
- [ ] No two players share the same colour on leaderboard
- [ ] Leaderboard does NOT refresh when organizer deletes a question

---

## 10. Question Bank

- [ ] "📦 Load Question Bank" button hidden if pre-loaded questions already exist
- [ ] "📦 Load Question Bank" button appears if all pre-loaded questions deleted
- [ ] Loading bank is idempotent — clicking twice doesn't duplicate questions
- [ ] Delete button shown ONLY on non-preloaded questions (player-submitted + organizer-added)
- [ ] No delete button visible on pre-loaded questions at all
- [ ] Deleting a question does NOT cause leaderboard to refresh
- [ ] Organizer can add a custom question → appears immediately
- [ ] Player can suggest a question → appears in organizer's bank within 5s
- [ ] New questions tray shows questions added after page load (pulsing amber accent)

---

## 11. Removing a Player

- [ ] Organizer can remove player during lobby — player removed cleanly
- [ ] Organizer can remove player during active game — no game freeze
- [ ] If removed player was current target → round auto-skips, organizer sees "Target player was removed — round skipped"
- [ ] Removed player removed from rotation queue — next round targets correct player
- [ ] Submission grid recomputes eligible count after player removed
- [ ] Reveal button ungates correctly after removal recomputes eligible count
- [ ] Removed player sees "You've been removed" screen immediately

---

## 12. Auto Target Rotation

- [ ] Target rotates through all players before anyone is targeted twice
- [ ] Rotation order is randomized at session start (not join order)
- [ ] Organizer can override target manually — rotation continues from next in queue
- [ ] No player is targeted twice in a row

---

## 13. Game Over — Organizer

- [ ] "End Game" → confirm dialog → session marked ended
- [ ] All screens show "Game Over!" state immediately (no refresh)
- [ ] Once ended: no sounds play, no winner banners, no round logic fires
- [ ] "📤 Share Session Story" button visible (replaces old .txt export)
- [ ] Session story image downloads as PNG — landscape 1200×630
- [ ] Session story image contains: winner, highlights, leaderboard, chaos score label (no raw number)
- [ ] Chaos score shows emoji + label + description only (no raw number)
- [ ] "📸 Save Challenge Card" button visible — challenge card has QR code (not blank)
- [ ] QR code on challenge card encodes correct URL (`/start?pack=[packId]`)
- [ ] "🔁 Play again — same group" button visible
- [ ] "Use this same pack next time" stores pack_id in localStorage
- [ ] Feedback widget visible and submittable

---

## 14. Game Over — Player

- [ ] Badge visible immediately on game-over screen — name + emoji + copy
- [ ] Badge uses Indian pop culture reference (e.g. "The MS Dhoni", "The Babu Bhaiya")
- [ ] "📤 Share my badge" button works (test on Vercel, not localhost)
- [ ] "📸 Share session card" button visible — same image as organizer's session card
- [ ] "🎮 Host your own game" CTA visible → links to `/start`
- [ ] Feedback widget visible and submittable

---

## 15. Replay Flow

- [ ] Organizer taps "Play again — same group" → new session created with new room code
- [ ] Organizer page navigates to new `/room/[newCode]/organizer` automatically
- [ ] Players see replay prompt on their screen: "🔁 [Organizer] wants to play again! [Join] [Skip]"
- [ ] Player taps "Join" → silent auto-rejoin using localStorage name + player_token
- [ ] Player redirected directly to `/room/[newCode]/player/[id]` — no join form shown
- [ ] If localStorage empty → player shown pre-filled join form as fallback
- [ ] If auto-rejoin API fails → retry button shown: "Couldn't join — tap to try again"
- [ ] Player taps "Skip" → persistent "Rejoin [room code]" banner visible on their screen while new session in lobby
- [ ] Organizer's new room player list updates in real time when players join (no manual refresh)

---

## 16. Sound Toggle

- [ ] 🔔/🔕 toggle visible in player screen header
- [ ] 🔔/🔕 toggle visible in organizer screen header
- [ ] Toggling off → no sounds play on that device
- [ ] Toggling on → sounds resume
- [ ] Sound preference persists after page refresh (localStorage)
- [ ] Default is ON

---

## 17. End Game Mid-Round (edge case)

- [ ] Organizer ends game while round is in guessing phase → session marked ended
- [ ] All player screens switch to Game Over immediately
- [ ] No sounds play after end
- [ ] No winner banner appears after end
- [ ] No round logic fires after end

---

## 18. Landing Page

- [ ] Floating game moment bubbles visible in background (not too subtle)
- [ ] Headline: "How well do you know your friends?" visible above fold on mobile
- [ ] Two CTA buttons visible above fold: "Host a Game" + "Join a Game"
- [ ] "Host a Game" → `/start`
- [ ] "Join a Game" → `/join`

---

## 19. Scoring — Tie Scenarios (manual, 2+ devices)

- [ ] **Exact 2-way tie (simple)** — two same answers → both 1pt, "X & Y tie this round!"
- [ ] **Exact 2-way tie for 1st (rich)** — both 3pts, next closest 2pts (NOT 1pt)
- [ ] **3-way tie for 1st (rich)** — all three 3pts
- [ ] **Partial tie for 2nd (rich)** — p1=3, p2+p3=2 each, p4=1 (NOT 0)
- [ ] **All same answer (rich)** → everyone 3pts

---

## Post-Deploy Smoke Test (< 3 min)

1. Create room on phone via Party Mode
2. Join on laptop
3. Verify player colour unique on leaderboard
4. Start 1 round — verify target name prominent on guesser screen
5. Submit answer + guesses
6. Reveal — verify adaptive timing, auto-scroll
7. Check leaderboard updates
8. End game — verify badge appears on player, session story image on organizer
9. Confirm no sounds after game ended
