# Guessing the Guess

**The number guessing game that reveals how well you actually know your friends.**

🎮 **[Play it live →](https://guessing-the-guess.vercel.app/)**

---

## What it is

Each round, one player secretly answers a numeric question about themselves. Everyone else tries to guess what *that specific person* said — not the right answer, their answer. Points go to whoever is closest.

It's not trivia. It's a social mirror. Works in a living room or over a video call.

---

## Screenshot / Demo

> 📸 *Screenshot or GIF coming soon*

---

## Tech Stack

| Tech | Why |
|---|---|
| **Next.js (App Router)** | API routes + pages in one repo — no separate backend needed for a game this scope |
| **Supabase Realtime** | All screens (organizer, players, TV display) sync in under a second via postgres_changes — no WebSocket infrastructure to manage |
| **Vercel (Serverless)** | Every API call is a serverless function — zero server ops, scales to zero between sessions |
| **No auth** | Deliberate. A party game lives or dies on how fast you can get everyone in the room. Room creation to first round in under 10 seconds — login friction would kill that |

---

## What's Built

- **3 simultaneous screens** — Organizer controls, per-player view, TV/projector display — all synced live
- **Full game loop** — room creation, player join, guessing, timed reveal animations, scoring, leaderboard
- **Party Mode** — one tap to a live room; question packs, target rotation, and reveal mode all auto-configured
- **13 Indian pop-culture badges** — algorithmically assigned at session end based on how you played. Did you guess exactly right twice? You're The Baba Vanga. Fastest to submit but always wrong? The Arnab Goswami.
- **Shareable session cards** — WhatsApp-ready PNG generated server-side via Satori
- **Mobile-first** — Safari tab-resume, Android join delay, iPhone WebSocket drops — all handled
- **80+ tests** — unit, component, and E2E covering every critical flow

---

## Key Documents

- [Feature Spec v3](KEY_DOCUMENTS/FEATURE-SPEC-v3.md) — full product spec, written to be manually testable
- [Architecture v3](KEY_DOCUMENTS/ARCHITECTURE-v3.md) — system diagram + key architectural decisions
- [Decisions v3](KEY_DOCUMENTS/DECISIONS-v3.md) — every design and technical decision with rationale

---

## Built By

**Dheeraj Jain** — [LinkedIn](https://www.linkedin.com/in/dheerajjain-gim)

Built solo using [Claude Code](https://claude.ai/code) — Anthropic's AI coding tool.
