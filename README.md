# Social Mirror

**See yourself through the eyes of everyone who knows you.**

A personality reveal engine played with friends. Rate each other, discover the gap between how you see yourself and how your friends see you, and get personalized portraits with hidden strengths, challenge cards, and compatibility insights.

---

## How It Works

**Rate** → **Reveal** → **Discover**

1. One person hosts, shares the room code. Everyone joins (2-8 players).
2. Each player takes turns "in the mirror" — you rate yourself, friends rate you. The gap is revealed in real-time.
3. After all rounds, everyone gets a personality portrait: hidden strengths, your mask, a weekly challenge, and group compatibility.

## What You Get

- **Hidden Strengths** — what your friends see that you don't
- **Your Mask** — what you project vs. what they perceive
- **Challenge Card** — a specific action for the week based on your gaps
- **Reflection Prompt** — one question to sit with
- **Compatibility Map** — pairwise friendship insights
- **Group Roles** — who's The Spark, The Anchor, The Wildcard
- **Biggest Surprise** — the single most dramatic gap of the night

## Features

- 25 fun, situational questions mapped to Big Five personality traits
- Host plays the game too (not just a facilitator)
- Zero AI API cost — all insights generated algorithmically
- Real-time sync across all players
- Auto-paced reveal sequence with sounds
- Persistent identity — play across sessions, build your Mirror Profile
- Shareable portrait cards
- Works on mobile (designed for phones at dinner parties)

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Supabase (Postgres + Realtime)
- **Personality Engine:** Custom Mirror Engine (934 lines, zero API cost)
- **Testing:** Vitest (541 tests)
- **Design System:** Wrapped Energy (warm cream, coral-orange-gold gradient)

## Getting Started

```bash
npm install
npm run dev
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Database setup (run in Supabase SQL Editor):
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/seed_mirror_questions.sql`
3. `ALTER TABLE player_profiles ADD CONSTRAINT player_profiles_local_id_key UNIQUE (local_id);`

## Built By

[Dheeraj Jain](https://www.linkedin.com/in/dheerajjain-gim)
