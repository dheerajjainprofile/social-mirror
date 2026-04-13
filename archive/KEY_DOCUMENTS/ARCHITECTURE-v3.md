# Technical Architecture — Guessing the Guess

```mermaid
graph TB
    subgraph Client["Browser (Next.js App Router)"]
        LP["Landing page /"]
        CP["Create page /create"]
        JP["Join page /join"]
        OP["Organizer page /room/code/organizer"]
        PP["Player page /room/code/player/id"]
        PRP["Present screen /room/code/present"]
    end

    subgraph API["Next.js API Routes (Vercel serverless)"]
        CR["/api/create-room"]
        JR["/api/join-room"]
        SR["/api/start-round"]
        SA["/api/submit-answer"]
        SG["/api/submit-guess"]
        TR["/api/trigger-reveal"]
        CW["/api/calculate-winner"]
        SK["/api/skip-round"]
        EG["/api/end-game"]
        AQ["/api/add-question"]
        APQ["/api/approve-question"]
        SQ["/api/seed-questions"]
        DQ["/api/delete-question"]
        US["/api/update-session"]
        RP["/api/remove-player"]
        SF["/api/submit-feedback"]
    end

    subgraph DB["Supabase (PostgreSQL)"]
        subgraph RT["Realtime tables (postgres_changes)"]
            SESS[(sessions)]
            PLAY[(players)]
            RND[(rounds)]
            GS[(guesses)]
            TA[(target_answers)]
            SC[(scores)]
        end
        subgraph POLL["Polling only (no realtime replication)"]
            QS[(questions)]
        end
        FB[(feedback)]
    end

    subgraph Files["Repo files"]
        QJ[/data/questions.json]
    end

    CP -->|POST| CR --> SESS & PLAY
    JP -->|POST| JR --> PLAY
    OP -->|POST| SR --> RND
    PP -->|POST| SA --> TA
    PP -->|POST| SG --> GS
    OP -->|POST| TR --> RND
    OP -->|POST via auto| CW --> SC & RND
    OP -->|POST| SK --> RND
    OP -->|POST| EG --> SESS
    OP -->|POST| AQ --> QS
    OP -->|POST| APQ --> QS
    OP -->|POST| SQ --> QS
    OP -->|POST| DQ --> QS
    OP -->|POST| US --> SESS
    OP -->|POST| RP --> PLAY
    PP -->|POST| SF --> FB
    OP -->|POST| SF --> FB

    QJ -->|wipe + reseed| SQ

    OP -->|Realtime channel| RT
    PP -->|Realtime channel| RT
    PRP -->|Realtime channel| RT

    OP -->|Poll every 5s| QS
    PRP -->|Poll every 5s| QS
```

## Key architectural decisions

| Decision | What | Why |
|----------|------|-----|
| **Realtime for game state** | sessions, players, rounds, guesses, target_answers, scores | These need sub-second sync across all screens. Supabase Realtime delivers postgres_changes events without polling overhead. |
| **Polling for questions** | questions table polled every 5s | Supabase Realtime replication is not enabled on this table — a deliberate choice to avoid unnecessary realtime slots. 5s lag is acceptable for question bank updates. |
| **Serverless API routes** | All mutations go through Next.js API routes | Keeps Supabase credentials server-side only. No direct DB access from browser. |
| **File-based question management** | `/data/questions.json` → seed API | Editing pre-loaded questions = edit JSON + push. No DB admin access needed. Wipe-and-reseed on every seed call. |
| **No user auth** | Players identified by UUID in localStorage | Party game context — no login friction. UUID stored as `gtg_player_id`. Removed players see a "you've been removed" screen. |
| **Lazy session cleanup** | On every create-room, expire sessions > 24h | Vercel is serverless, no background jobs. Piggybacks on natural usage flow. |

## Data flow for a typical round

```
Organizer clicks "Start Round"
  → POST /api/start-round → inserts rounds row (status=guessing)
  → Realtime fires → all clients refresh round state

Players submit guesses
  → POST /api/submit-guess → inserts guesses row
  → Realtime fires → organizer SubmissionGrid updates

Target submits answer
  → POST /api/submit-answer → inserts target_answers row
  → Realtime fires → organizer "Reveal" button enables

Organizer clicks "Reveal Answers!"
  → POST /api/trigger-reveal → updates rounds.status = reveal
  → Realtime fires → all clients start card animation sequence

After all cards revealed (auto-triggered)
  → POST /api/calculate-winner → inserts scores rows, sets winner_player_id
  → Realtime fires → leaderboard updates, winner banner appears
```
