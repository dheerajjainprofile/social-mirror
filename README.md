# Social Mirror

**See yourself through the eyes of everyone who knows you.**

---

## What it is

A personality reveal engine played with friends. Each round, one player is "in the mirror" — they rate themselves on a personality trait, and everyone else rates them too. After all rounds, AI synthesizes the gap between self-perception and friend-perception into shareable personality portraits.

It's not a personality test. It's a social mirror. The dissonance is the product.

---

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Supabase (Postgres + Realtime)
- **AI:** Claude API (personality synthesis)
- **Deployment:** Vercel
- **Testing:** Vitest + Playwright

---

## Getting Started

```bash
npm install
npm run dev
```

Set up environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
ANTHROPIC_API_KEY=your_claude_api_key
```

---

## Built by

[Dheeraj Jain](https://www.linkedin.com/in/dheerajjain-gim)
