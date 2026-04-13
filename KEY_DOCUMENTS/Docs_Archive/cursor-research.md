
Here's a concise statement of what I understood, then the audit.

---

## What I understood

You had **Claude Code (or similar) change** the `guessing-the-guess/` app. After that, **the game flow fails or feels wrong at multiple steps** (reveal, presentation screen, exports, question bank, hot/cold, etc.). You want an **expert-level review of the whole project**: main code paths, **tests**, **issues**, and **likely fixes**—without assuming we can reproduce runtime bugs in your Supabase/Vercel environment.

---

## Executive summary

The app is a **Next.js App Router** client plus **Supabase** (realtime + polling). The **riskiest areas** are: **(1)** organizer/player **state vs DB** (especially after `trigger-reveal`), **(2)** **heavy `refreshAll`** patterns on every realtime event, **(3)** **`calculate-winner` idempotency**, **(4)** **present page** subscription filters and lobby vs active polling, **(5)** **`RevealCard`** internal state (`flipped`) across rounds, **(6)** **`update-session`** without validation. Tests cover **only** `utils.ts` helpers—not API routes or UI—so regressions in flow won't be caught.

Your own **`docs/ISSUES-v2.md`** already lists several real bugs/UX issues; the review below **aligns with and extends** that.

---

## ✅ CLAUDE CODE VALIDATION — All 8 issues confirmed REAL (2026-04-02)

Claude Code independently read every referenced file and verified each claim. Summary:

| # | Issue | Verdict | Priority |
|---|---|---|---|
| 1 | `handleTriggerReveal` doesn't set local `currentRound.status` → reveal UI stuck | **CONFIRMED** | 🔴 Critical |
| 2 | Organizer auto-reveal only allows `status='reveal'`, present allows `'reveal' OR 'done'` | **CONFIRMED** | 🔴 Critical |
| 3 | `calculate-winner` raw `.insert()` — no idempotency guard → double scoring risk | **CONFIRMED** | 🔴 Critical |
| 4 | Present guesses subscription created with `round_id=eq.undefined` on first mount | **CONFIRMED** | 🟠 High |
| 5 | Lobby polling stops when `session.status !== 'lobby'` → late joiners missing | **CONFIRMED** | 🟠 High |
| 6 | `update-session` passes raw request body to Supabase, no field allowlisting | **CONFIRMED** | 🟠 High |
| 7 | `RevealCard` `flipped` never resets to `false` when `visible` goes false | **CONFIRMED** | 🟡 Medium |
| 8 | Present page checks `status === 'answering'` but API always sets `'guessing'` → dead code | **CONFIRMED** | 🟡 Medium |

---

## Fix Order (agreed with user on 2026-04-02)

1. **Issue #1** — Optimistically set `currentRound.status = 'reveal'` after `handleTriggerReveal` succeeds
2. **Issue #3** — Make `calculate-winner` idempotent (check if round already 'done', or delete+reinsert)
3. **Issue #2** — Align organizer auto-reveal useEffect to allow `'reveal' OR 'done'`
4. **Issue #4** — Guard guesses subscription until `currentRound?.id` is defined
5. **Issue #5** — Extend player polling beyond lobby (or fix realtime)
6. **Issue #6** — Allowlist fields in `update-session`
7. **Issue #7** — Reset `flipped` in RevealCard when `visible` → false
8. **Issue #8** — Replace `'answering'` with `'guessing'` in present page (or remove dead block)

---

## STATUS (update this as fixes are applied)

- [x] Issue #1 — handleTriggerReveal optimistic state update (organizer/page.tsx: setCurrentRound after API call)
- [x] Issue #2 — Organizer auto-reveal status alignment (now checks 'reveal' OR 'done')
- [x] Issue #3 — calculate-winner idempotency (early return if status=done; delete+reinsert scores)
- [x] Issue #4 — Present guesses subscription guard (useEffect now returns early if !currentRound?.id)
- [ ] Issue #5 — Lobby polling for late joiners (SKIPPED — needs product decision on polling scope)
- [x] Issue #6 — update-session field allowlist (only 'hot_cold_enabled' allowed)
- [x] Issue #7 — RevealCard flipped reset (else branch sets flipped=false)
- [x] Issue #8 — Dead 'answering' status code in present page (changed to 'guessing')

---

## Critical / high-severity issues (original Cursor analysis)

### 1. Organizer: reveal UI can be gated on stale `currentRound.status` (likely "broken flow" after Reveal)

Reveal content is **only rendered** when `currentRound.status === 'reveal' || 'done'`:

```831:832:guessing-the-guess/src/app/room/[code]/organizer/page.tsx
            {(currentRound.status === 'reveal' || currentRound.status === 'done') && (
              <div className="space-y-3">
```

But `handleTriggerReveal` only calls the API and `buildRevealCards`; it **does not** set local `currentRound` to `reveal`:

```360:374:guessing-the-guess/src/app/room/[code]/organizer/page.tsx
  const handleTriggerReveal = async () => {
    if (!currentRound) return
    setActionLoading(true)
    try {
      await fetch('/api/trigger-reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: currentRound.id }),
      })
      await buildRevealCards(currentRound, playersRef.current)
      builtCardsForRoundRef.current = currentRound.id
    } finally {
      setActionLoading(false)
    }
  }
```

So right after a successful reveal, React state can still say **`guessing`** until the next **`refreshAll`** from realtime. If realtime is slow, misconfigured, or drops an event, the organizer can see **no reveal section** (or a confusing state) even though cards were built.

**Fix direction:** After a successful `trigger-reveal`, **optimistically** `setCurrentRound((r) => r ? { ...r, status: 'reveal' } : null)`, or **refetch** the round and set it (same as `refreshAll` does for rounds).

---

### 2. Organizer: auto-reveal + `handleCalculateWinner` only runs in `status === 'reveal'` (differs from player/present)

```284:297:guessing-the-guess/src/app/room/[code]/organizer/page.tsx
  useEffect(() => {
    if (currentRound?.status !== 'reveal') return
    if (revealCards.length === 0) return
    if (revealedCount >= revealCards.length) {
      if (!winnerPlayer) handleCalculateWinner()
      return
    }
```

The **player** page allows both **`reveal` and `done`** for the reveal animation. The organizer **only** animates in `reveal`. That is intentional if `calculate-winner` always runs before `done`—but combined with (1), any **ordering** bug (status flips to `done` before the last tick) can **skip** calling `handleCalculateWinner` or **stall** the animation.

**Fix direction:** Align semantics with player/present, or **drive winner calculation from a single place** (e.g. API-only after last card, or explicit organizer state machine) and add **guards** so `calculate-winner` isn't double-invoked.

---

### 3. `calculate-winner` is not idempotent — double scoring risk

```74:88:guessing-the-guess/src/app/api/calculate-winner/route.ts
    const scoreInserts = scoreResults
      .filter((s) => s.points > 0)
      .map((s) => ({
        session_id: round.session_id,
        player_id: s.playerId,
        round_id,
        points: s.points,
      }))

    if (scoreInserts.length > 0) {
      const { error: scoreError } = await supabase.from('scores').insert(scoreInserts)
```

A second POST (retry, duplicate effect, double click) **inserts again**; totals **sum** all rows → **inflated leaderboard**.

**Fix direction:** Before insert, **delete** existing `scores` for `round_id`, or use **upsert** with a unique `(round_id, player_id)` and DB constraint, or **return early** if round already `done` with scores present.

---

### 4. Present page: `guesses` realtime filter can bind to `undefined` round id

```202:204:guessing-the-guess/src/app/room/[code]/present/page.tsx
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guesses', filter: `round_id=eq.${currentRound?.id}` },
        () => setSubmittedCount((c) => c + 1)
      )
```

The subscription is recreated when `currentRound?.id` changes, but on **first** mount `currentRound` may be **null** → filter `round_id=eq.undefined` → **wrong or no events**. There is a **3s lobby poll** for players, but **no** similar poll for guess counts when `session` is **active** if this subscription fails.

**Fix direction:** Don't subscribe until `currentRound?.id` is defined; or **poll** guesses during `guessing` like lobby; or **increment** from a broader channel and filter in code.

---

### 5. Present page: lobby polling vs active session

Comment says realtime INSERT on `players` is unreliable; **polling only runs in `lobby`**:

```213:224:guessing-the-guess/src/app/room/[code]/present/page.tsx
  useEffect(() => {
    if (!session || session.status !== 'lobby') return
    const poll = setInterval(async () => {
```

If someone **joins after** the session is **active**, the presentation **might not** update player list—matches **I-05** in `docs/ISSUES-v2.md`.

**Fix direction:** Extend polling to **active** when you need player list accuracy, or fix Supabase realtime (replica identity, RLS, `postgres_changes` config).

---

### 6. `update-session` allows arbitrary column updates (security + "hot/cold reload")

```10:15:guessing-the-guess/src/app/api/update-session/route.ts
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', session_id)
```

Any client can send **`updates: { status: 'ended', ... }`** if the anon key can update rows (depends on RLS). Even if RLS blocks it, **wide-open** updates are fragile.

**Fix direction:** **Allowlist** fields (e.g. only `hot_cold_enabled`). This also reduces accidental full **`refreshAll`** storms that feel like "reload" (see **I-07**).

---

## Medium-severity issues

### 7. `RevealCard`: `flipped` state is not reset when `visible` goes false

```34:39:guessing-the-guess/src/components/RevealCard.tsx
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setFlipped(true), 100)
      return () => clearTimeout(t)
    }
  }, [visible])
```

If the **same** component instance is reused with a new `card` while `visible` stays true, or `visible` toggles in a way that doesn't remount, **flip animation** can be wrong. Usually **keys** (`key={card.id}`) remount; **I-08** (round 2+ re-animation) can still happen if **parent** rebuilds cards and **reset** `revealedCount` while effects fight—worth **resetting `flipped` when `visible` is false** or when `card.id` changes.

---

### 8. Present page: `winnerIds` / winner wiring

```335:335:guessing-the-guess/src/app/room/[code]/present/page.tsx
                  winnerIds={revealWinnerNames.length > 0 ? revealCards.filter((c) => revealWinnerNames.includes(c.playerName)).map((c) => c.playerId ?? '') : winnerPlayer ? [winnerPlayer.id] : []}
```

`RevealCard` matches by **`playerId`** (`winnerIds.includes(card.playerId)`). Ties use **names** first; **duplicate display names** could mis-highlight. **Empty strings** in `winnerIds` if `playerId` missing—edge case.

---

### 9. Question bank "New this session" vs seed (`ISSUES-v2` I-09)

Logic: `isNewThisSession = !initialQuestionIds.has(q.id)`. After seed, `handleSeedQuestions` adds new IDs to `initialQuestionIds`—**should** remove seeded rows from the amber tray. If you still see **all** seeded rows in the tray, likely causes: **stale `initialQuestionIds`**, **seed not updating `initialQuestionIds`**, or **race** between load and seed. **Player-submitted** questions use `auto_approve: true` from the player form, so they land in **approved** list, not **pending**—that matches the backlog's "approve" flow vs **player** UX expectations.

---

### 10. Export image (`ISSUES-v2` I-11)

`GET /api/export-image/[code]` uses **Edge** + **Supabase anon** + **`ImageResponse`**. Failures often come from: **Edge + Supabase** env/region, **RLS** blocking reads, **wrong response** (HTML error page) so `res.blob()` is wrong, or **client** not handling non-OK. Organizer uses `fetch` + blob download—**verify** `res.ok` and **Content-Type** in network tab.

---

## Lower / UX / consistency (from code + `ISSUES-v2`)

- **I-06** Confusion: everyone sees **"Winner"** / trophy labels on **`RevealCard`** for round winners; **RoundRanking** is clearer—product choice to change **copy** or **per-viewer** messaging.
- **Dead UI:** `present/page.tsx` has `currentRound.status === 'answering'` but rounds are **`guessing`** in API—block **never** runs. *(Confirmed by Claude Code — fix: change to 'guessing' or remove)*
- **LinkedIn / layout:** `ISSUES-v2` I-01, I-02, I-04, I-10, I-12.
- **`/api/update-session`** + `sessions` realtime → **full `refreshAll`** on organizer/player—can **feel** like a reload when toggling hot/cold (**I-07**).

---

## Test suite review

**What exists:** `src/tests/utils.test.ts` — **`generateRoomCode`**, **`calculateHotCold`**, **`calculateScores`** — good coverage for **pure helpers**.

**What's missing (high value):**

- **`calculate-winner`** idempotency and "no guesses" / "all pass" paths.
- **API contracts** for `trigger-reveal`, `start-round`, `submit-guess` with round status.
- **No component** or **integration** tests—so **organizer reveal** state bug would **not** be caught.

---

## Suggested fix order (practical)

1. **Optimistic or refetch `currentRound` after `trigger-reveal`** (organizer)—likely fixes the most painful "stuck after Reveal" cases.  
2. **Idempotent `calculate-winner`** (scores + round status).  
3. **Present: fix guesses subscription + player updates** (poll or realtime).  
4. **Harden `update-session`** (allowlist).  
5. **`RevealCard` reset** / key stability for **I-08**.  
6. **Question bank** tray: verify `initialQuestionIds` after seed + one E2E path.  
7. **Export image**: trace failing response (status, body, Edge env).







RE REVIEW


Here’s an honest second pass after reading the current code. I did **not** run the app against Supabase or browsers—only **static review** + **unit tests** (`npm test`: **18/18 passed**).

---

## What clearly improved (verified in code)

1. **`handleTriggerReveal` optimistic update** — After `trigger-reveal`, you now set local round to `reveal`, so the reveal UI is not blocked on realtime:

```360:374:guessing-the-guess/src/app/room/[code]/organizer/page.tsx
  const handleTriggerReveal = async () => {
    if (!currentRound) return
    setActionLoading(true)
    try {
      await fetch('/api/trigger-reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: currentRound.id }),
      })
      await buildRevealCards(currentRound, playersRef.current)
      builtCardsForRoundRef.current = currentRound.id
      setCurrentRound((r) => r ? { ...r, status: 'reveal' } : null)
    } finally {
      setActionLoading(false)
    }
  }
```

2. **Organizer auto-reveal + winner** — Effect now allows **`reveal` or `done`**, so it matches player/present and doesn’t stop early only because status flipped:

```285:297:guessing-the-guess/src/app/room/[code]/organizer/page.tsx
  useEffect(() => {
    if (currentRound?.status !== 'reveal' && currentRound?.status !== 'done') return
    if (revealCards.length === 0) return
    if (revealedCount >= revealCards.length) {
      if (!winnerPlayer) handleCalculateWinner()
      return
    }
```

3. **`calculate-winner`** — Idempotent path when round is already **`done`**, plus **delete scores for `round_id` before insert** on the scoring path — addresses duplicate points from double-submit.

4. **`update-session`** — **Allowlist** `hot_cold_enabled` only — closes the arbitrary-update hole.

5. **`RevealCard`** — **`flipped` resets when `visible` is false** — helps round-to-round animation glitches.

6. **Present page** — Subscription waits until **`currentRound?.id` exists**, avoiding a `round_id=eq.undefined` listener.

---

## Remaining risks (still worth fixing or testing)

| Risk | Why it matters |
|------|----------------|
| ~~**`trigger-reveal` not checked for success**~~ | **FIXED** — `if (!res.ok) return` added before `buildRevealCards` / optimistic update. |
| ~~**`handleCalculateWinner` doesn’t gate on `res.ok`**~~ | **FIXED** — `if (!res.ok) return` added before `res.json()`. |
| **Idempotent `calculate-winner` response for ties** | When round is already `done`, the early return rebuilds **`winners`** from a **single** `winner_player_id` in the DB — **ties** are still not represented as multiple winners in that JSON path (same schema limitation as before). |
| **Race on two simultaneous first-time scoring calls** | Unlikely on one phone, but two tabs could still race before `status === 'done'`. Delete-before-insert reduces **duplicate rows**; not a full distributed lock. Acceptable for a house party, not bank-grade. |
| ~~**Present view: player list during `active`**~~ | **FIXED** — Removed `if (!currentRound?.id) return` guard that was blocking ALL subscriptions (sessions/players/rounds). Guard now only applies to the guesses listener. Sessions/rounds/players/scores subscribe as soon as `session` is defined. |
| **Tests** | Still **only** `src/lib/utils` (18 tests). **No** API route tests, no component tests, no Playwright — **regressions in flows won’t be caught in CI.** |

---

## Test coverage (reality check)

- **Unit tests:** `generateRoomCode`, `calculateHotCold`, `calculateScores` — **good** for core math.
- **Not covered:** every route (`trigger-reveal`, `calculate-winner` branches, `skip-round`, `join-room`, etc.), realtime behavior, export image on Edge, multi-device flows.

So: **math is guarded; the glue is not.**

---

## Can you trust this for a house party?

- **Trust the review, not a guarantee.** No one can promise **“won’t break live”** without **your** run-through on real devices + Supabase (Wi‑Fi, phones, TV).
- **The latest changes do address the main issues we called out** (reveal gating, duplicate scores, session updates, reveal card reset, safer present subscription). That’s real progress.
- **Before the party:** run **`docs/regression-checklist.md`** end-to-end (5–10 minutes, 2–3 devices). That’s the highest-ROI “sorry face” insurance you have.
- **Quick add:** after fixes, add **`if (!res.ok)`** on **`trigger-reveal`** (and tighten **`calculate-winner`** handling) — that’s the one remaining issue I’d still flag as **party-risk** if the API errors under load or bad network.

So: **you can trust the direction of the fixes and this audit, but not skip manual + checklist verification**—that’s what makes it “production level” for your context, not my read alone.