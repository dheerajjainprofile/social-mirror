# Social Mirror

**See yourself through the eyes of everyone who knows you.**

A personality reveal engine played with friends. Rate each other on personality traits, discover the gap between self-perception and friend-perception, and get AI-powered personality portraits with hidden strengths, challenge cards, and compatibility insights.

---

## How It Works

1. **Start a session** — one person hosts, shares the room code
2. **Friends join** — 2-8 players via code or QR scan
3. **Mirror rounds** — each player takes turns "in the mirror":
   - You rate yourself on a personality question (1-7 scale)
   - Your friends rate you on the same question
   - The gap between self and friends is revealed in real-time
4. **Personality portraits** — after all rounds, each player gets:
   - Trait bars (self vs. friends) across 5 personality dimensions
   - Hidden Strengths (what friends see that you don't)
   - Your Mask (what you project vs. what they perceive)
   - A challenge card for the week
   - A reflection question to sit with
5. **Group dynamics** — biggest surprise, compatibility map, personality roles, hot take

## Features

- **25 fun, debatable questions** mapped to Big Five personality traits
- **Mirror Engine** — generates all insights algorithmically (zero API cost)
- **Real-time sync** via Supabase Realtime (all players see the same thing)
- **Auto-paced reveal** — "Begin the Reveal" button, then auto-plays with sounds
- **Persistent identity** — play across sessions, build your Mirror Profile
- **Shareable portrait cards** — OG image generation for screenshots
- **Sound design** — Web Audio API sounds for every key moment
- **Mobile-first** — designed for phones in dim rooms at dinner parties

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Supabase (Postgres + Realtime)
- **Personality Engine:** Custom (no external AI API needed)
- **Deployment:** Vercel
- **Testing:** Vitest (541 tests) + Playwright E2E
- **Design System:** Spotify Wrapped Energy (warm cream, coral-orange-gold gradient)

## Getting Started

```bash
npm install
npm run dev
```

### Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

Run the SQL files in Supabase SQL Editor in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/seed_mirror_questions.sql`
3. Add unique constraint: `ALTER TABLE player_profiles ADD CONSTRAINT player_profiles_local_id_key UNIQUE (local_id);`

## Project Structure

```
src/
  app/
    page.tsx              — Landing page
    start/page.tsx        — Create session
    join/page.tsx         — Join session
    mirror/[code]/page.tsx — Unified game page (all phases)
    profile/[id]/page.tsx — Mirror Profile
    api/mirror/           — Mirror round APIs
  components/
    MirrorRatingSlider    — 1-7 rating buttons
    MiniReveal            — Animated gap reveal
    PortraitCard          — Full personality portrait
    BiggestSurpriseCard   — Session's biggest gap
    HotTakeCard           — Group statistical observation
    CompatibilityCard     — Pairwise friendship insights
    GroupRolesCard         — Personality roles with descriptions
    MirrorRevealSequence  — Auto-paced reveal orchestrator
  lib/
    mirrorEngine.ts       — Personality synthesis (934 lines, zero API cost)
    mirrorQuestions.ts     — Dimension-balanced question selection
    identity.ts           — Persistent player identity
    theme.ts              — Shared design tokens
    sounds.ts             — Web Audio API sounds
data/
  mirror-questions.json   — 25 Big Five-mapped questions
  questions.json          — Legacy question bank
```

## Design System

See [DESIGN.md](DESIGN.md) for the complete visual identity specification.

## Built By

[Dheeraj Jain](https://www.linkedin.com/in/dheerajjain-gim)
