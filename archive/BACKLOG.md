# Guessing the Guess — Backlog

> **How to use this file**
> - All refined items live in the main table below, each with an ID for easy reference
> - New raw ideas go in the **Inbox** — no thinking needed, just dump it
> - Inbox items get refined with Claude, then promoted to the main table
> - Testing observations stay at the bottom as a log

---

## Active Backlog

| ID | Category | Item | Priority | Version | Status | Notes |
|----|----------|------|----------|---------|--------|-------|
| B01 | Gameplay | **Timer expiry for target player** — when timer hits zero, show organizer a prompt: "Timer expired. Skip round or wait?" — organizer decides. Not an auto-skip | P2 | future | groomed | Timer is visual-only today. Option 2 chosen — prompt organizer, don't auto-skip. Party game context — organizer is physically present |
| B03 | Gameplay | **Reveal button gating** — instead of hard-blocking reveal until minimum guessers submit, show a confirm dialog: "Only X of Y players have guessed. Reveal anyway?" Organizer stays in control, no hard block | P2 | future | groomed | Confirm dialog chosen over hard block — hard block risks getting stuck if someone's phone dies |
| B12 | Documentation | **User journey flow** — linear narrative of full experience for each role: organizer, target player, guesser. Land → create/join → lobby → round → reveal → score → game over | P2 | future | groomed | Deferred — only valuable when onboarding a new contributor or tester. Revisit when project grows |
| B16 | Code Quality | **Automated test gate before refactoring** — test suite (B10) must be complete and passing in CI before any refactoring begins. Refactoring without tests = regression risk | P1 | future | open | Depends on B10. Do not start until v2 is stable and tests are green |
| B17 | Code Quality | **Refactoring candidates (post-v2)** — organizer page is too large (split into hooks/components), polling logic → `usePolling` hook, shared Supabase client helper across API routes, audit all useEffect dependency arrays | P2 | future | groomed | Do after v2 ships and B10 (tests) are in place. No refactoring during active feature work |
| B25 | Testing | **Integration + E2E tests (future)** — integration tests for API routes against a real Supabase test instance. E2E tests with Playwright for full session flow: create room → join → round → reveal → score → end. Run in CI alongside unit tests | P2 | future | groomed | Depends on B10 being in place first. Only worth doing if app grows significantly or API bugs start appearing |
| B02 | Gameplay | **Organizer as a player** — if ever built: spectator-organizer mode — organizer opts in at room creation, guesses on their phone, runs controls on second device, guesses shown during reveal but not scored | P3 | future | groomed | Decided: not building this. Organizer-as-host is the right design for a party game. If ever revisited, spectator-organizer is the cleanest approach |
| B15 | Theming | **Deploy-time theme switching** — swap visual theme at build time via env var (`NEXT_PUBLIC_THEME`). Themes: Classic (current), IPL Season, Professional, Halloween etc. One Vercel deployment = one theme | P3 | future | groomed | Depends on B17 (refactoring) and B27 (visual polish) being done first. No real use case until app is shared with broader audiences |

---

## v3 Brainstorm — ChatGPT Suggestions

> These 8 suggestions come from the ChatGPT product review in `/docs/CHATGPT-suggestions.md`.
> Each needs a full brainstorm before getting an ID and entering the Active Backlog.
> Core thesis: **stop optimizing session quality, start optimizing session propagation.**

| # | Suggestion | Status |
|---|-----------|--------|
| C1 | **Challenge share card** — "Can your group beat this?" with QR/deep link, not just leaderboard | 🔲 not yet brainstormed |
| C2 | **Personal result cards** — "I knew X best," "Biggest miss," "Most unpredictable friend" | 🔲 not yet brainstormed |
| C3 | **Audience mode** — Predictions, voting, reactions, question submissions for groups > 12 | 🔲 not yet brainstormed |
| C4 | **Question packs by context** — House party, work, couples, family, college, spicy, warm-up | 🔲 not yet brainstormed |
| C5 | **Prompt-level analytics** — Find questions that create laughs, shares, replays | 🔲 not yet brainstormed |
| C6 | **Quick Start presets** — Replace config-first flow with Party / Work / Custom one-click presets | 🔲 not yet brainstormed |
| C7 | **Auto target rotation + smarter facilitation** — Lower organizer cognitive load per round | 🔲 not yet brainstormed |
| C8 | **Replay / host conversion screen** — At game over: Play again / Host your own / Share your badge | 🔲 not yet brainstormed |

---

## Inbox

> Raw ideas — no ID, no priority yet. Drop ideas here anytime, refine with Claude later.

- **Cartoon character illustration for landing page** — garbage bin characters (Trash Pack / Oscar the Grouch aesthetic) showing the game loop visually. Deferred from B08 — needs proper design attention. Consider hiring a designer or using AI image generation for a polished result.
- **Streak tracking on round summary** — if same player wins 2+ rounds in a row, show 🔥x3 streak badge on their name in the round ranking. Creates narrative across rounds ("can anyone stop John?"). Parked from B05 brainstorm.
- **Aggregated feedback summary for organizer** — after game ends, organizer's screen shows a summary of emoji ratings from all players who submitted feedback (e.g. "3 x 🤩, 1 x 😊"). No individual names shown. Parked from B09 brainstorm.
- **QR code for joining on presentation screen** — display a QR code next to the room code on the TV/present view so players can scan to join directly without typing the code. Discussed during v2 manual testing. Defer to v3.
- **Winner reveal animation alternatives** — Option B: screen flashes winner's player color, name zooms in from small→large at center, ties fly in from opposite sides. Option C: podium builds worst-to-best, winner drops last with bounce, replaces RoundRanking. Currently shipping Option A (game-show card slides up from bottom). Revisit if user dislikes Option A.

---

## Completed — v2

> All items below were built, tested, and merged to main as part of v2.

| ID | Category | Item | Notes |
|----|----------|------|-------|
| B05 | Gameplay | **Per-round ranking display** — animated ranked summary after all cards reveal. Medal, player name, distance from target, fun label, +pts earned. "Biggest miss" callout. Shows on all screens | Distance as number. Label thresholds: exact=0, so close≤5, not bad≤20, off track≤50, way off>50 |
| B07 | Gameplay | **Newly submitted questions appear at top for organizer** — "New This Session" tray pinned at top of Question Bank panel, pulsing border / amber highlight | Tray shows only questions submitted after organizer page load, tracked via `initialQuestionIds`. Appears within 5s via existing poll |
| B09 | Feedback | **End-of-session feedback button** — emoji rating (😭😐😊🤩) + optional free text + anonymous checkbox. Stored in Supabase `feedback` table | Fields: emoji rating, free text, player name (null if anon), role, user agent, room code, scoring mode, rounds played, player count, timestamp |
| B10 | Testing | **Unit tests + CI + regression checklist** — Vitest for `calculateScores`, `calculateHotCold`, `generateRoomCode`. GitHub Actions CI. `/docs/regression-checklist.md` | ~15-20 unit test cases on pure functions only |
| B11 | Documentation | **Versioned PRD per major release** — PRD-PROD-v1 and PRD-PROD-v2 at `/docs/PRD-PROD-v2.md` | |
| B13 | Documentation | **Workflow diagram** — Mermaid state machine in `/docs/workflow.md` | Session states (lobby→active→ended), round states, who triggers each transition |
| B14 | Documentation | **Technical architecture diagram** — Mermaid in `/docs/architecture.md` showing Next.js → API routes → Supabase | Marks which tables use realtime vs 5s polling |
| B18 | Data Quality | **Duplicate player join prevention** — block join if same name (case-insensitive, trimmed) already in session | Fix in `/api/join-room` only |
| B19 | Data Quality | **Player name standardisation** — trim + capitalise first letter on save (join + create room) | "dheeraj jain" → "Dheeraj Jain" |
| B20 | Data Quality | **Abandoned session cleanup** — on new session creation, mark all sessions older than 24h with status `active` as `expired` | Lazy cleanup, piggybacks on create-room flow |
| B21 | Data Quality | **Question bank cleanup (one-time)** — deleted ~40 duplicate rows where source = 'preloaded' or 'Pre-loaded' | DB maintenance task, done in Supabase SQL Editor |
| B22 | Data Quality | **Question moderation — delete player-submitted questions** — × delete button on player-submitted questions (source = player name). Hard delete + confirm dialog | Pre-loaded questions managed via JSON, no UI delete needed |
| B23 | Testing | **Tie scoring real-play test** — controlled test of 2-way tie, 3-way tie, partial tie, all-same. All 4 scenarios also as unit tests | |
| B24 | Gameplay | **File-based question management** — questions in `/data/questions.json`. Seed API wipes + reinserts. Categories: habits, social, money, food, work, fun | |
| B26 | Analytics | **Vercel Analytics** — enabled from Vercel dashboard. Tracks page views, visitors, countries, devices, referrers | Zero code change |
| B27 | Visual Polish | **Full visual identity overhaul** — Space Grotesk/Nunito font, sound design, player colour identity, animated leaderboard re-sort, alive waiting screens, round start flash, game-over celebration, micro-animations, QR code on present screen, custom wordmark, floating numbers on landing page | |
| B04 | Gameplay | **Fancy export — shareable PNG image** — `@vercel/og`. Leaderboard, best guess, biggest miss, funny one-liner, personal branding footer. "📸 Save Image" on game-over screen | Depends on B05 data |
| B08 | Landing Page | **Landing page improvements** — 5 How-to-Play steps inline as visual emoji cards (horizontal scroll mobile). "Built by Dheeraj Jain · LinkedIn ↗" footer | |
| B06 | Gameplay | **Better export design — HTML** — killed, superseded by B04 | |

---

## Testing Observations (Apr 1 session)

Raw log from the first real multi-player test session on Vercel.

- **Duplicate player joins** — same player joined as "John Snow" twice in the same session. No prevention in place.
- **No player name standardisation** — organizer appeared as "Dheeraj Jain", "Dheeraj jain", "Dheeraj JAIN", "Jain" across sessions.
- **Abandoned sessions** — 10 out of 15 sessions were never properly ended (tab closed mid-game). Sessions stay as `active` in DB forever.
- **Question bank duplicates** — seed button clicked multiple times before idempotency fix. ~40 duplicates now in DB with `source = 'Pre-loaded'` (capital P) vs original `source = 'preloaded'` (lowercase). Needs one-time cleanup query.
- **Test garbage in question bank** — "how may toothpase", "what's up bro count" — player test inputs permanently in DB. No delete flow.
- **Tie scoring not real-play tested** — tie logic was rewritten but no actual tie occurred in Apr 1 sessions. Needs controlled test.
