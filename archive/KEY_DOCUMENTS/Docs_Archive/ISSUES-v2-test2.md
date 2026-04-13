# Issues & Observations — v2 Test Round 2

Logged after second manual testing session. Fix only when explicitly asked.

---

## T2-01 — Presenter screen still not updating when new player joins (STILL BROKEN)

Previous fix (removing Supabase filter from subscription) did not resolve the issue. The subscription event may never be firing at all — the `players` table likely does not have Supabase Realtime replication enabled in the project settings. This means no INSERT event reaches the browser regardless of filters.

**Root cause hypothesis:** Realtime is not enabled for the `players` table in Supabase dashboard → Table Editor → Replication. The organizer page works because it calls `refreshAll()` (a full re-fetch) on any event. The present page tries to do a targeted state update but never gets the trigger.

**Fix direction:** Change the present page to use the same pattern as the organizer page — subscribe to any change on `sessions` table (which DOES have realtime enabled, as session status changes work), and on that event, re-fetch the full player list. OR add a lightweight polling fallback (every 3s) for the lobby phase only.

**Decision needed:** Polling fallback or full realtime investigation? (Polling is simpler and guaranteed to work.)

---

## T2-02 — Winner/ranking display broken — made worse by removing banner (DESIGN REDO NEEDED)

Removing the trophy banner made the screen worse. Current state:

- The winning player's RevealCard shows "🏆 Winner" label (green border, emerald text)
- For a **tie**: only ONE player's card gets the winner label — the tied partner's card shows as a plain "Guess" card. This is actively misleading (looks like they lost).
- The RoundRanking component (medals 🥇🥈🥉) may not be visible or is being missed
- Net result: user sees one highlighted card, no clear summary of who won or tied

**What the user expected from Option A (rank-based medals):**
Show all players with their medals (🥇🥈🥉) prominently, handle ties correctly (both tied players shown as 🥇), and make it obvious who got points.

**Proposed fix — 2-part approach:**

**Part 1 — Fix RevealCard for ties:**
- Change `winnerId` prop (single string) to `winnerIds` (Set of strings)
- All tied winners get the green/emerald winner card styling
- Passed from `winners` array (not just `winnerPlayer`) on organizer/present pages

**Part 2 — Add a compact winner line above the cards:**
Instead of a big trophy banner, show a single clean line:
- Non-tie: `🥇 Alice wins this round!`
- Tie: `🥇 Alice & Bob tie this round!`
- No big background box — just bold white/yellow text with the medal emoji
- Shows immediately when winner is determined, before RoundRanking animates in

**Present page needs `winners` array:**
Currently the present page only has `winnerPlayer` (single). It needs a `winners` array like the organizer page to handle ties correctly.

**Decision needed from user:**
- Confirm Part 1 + Part 2 approach above? Or different preference?
- Should the compact winner line appear on ALL screens (present, player, organizer) or just present?

---

## T2-03 — Export image broken for ties

When multiple players tie a round, the export image either:
- Shows only one winner (the `winner` variable = `leaderboard[0]` which is just the top scorer by total points)
- OR doesn't handle the case where two players have identical total points at the end

The "winner banner" on the export image shows `{winner.name} knows their friends best!` — always singular, no tie handling.

**Fix direction:**
- If top 2 players have equal `totalPoints`, show `Alice & Bob know their friends best!`
- Check `leaderboard[0].points === leaderboard[1]?.points` to detect top-level tie

No decision needed — straightforward fix.

---

## Status
- [ ] All issues logged
- [ ] Awaiting user decisions on T2-01 (polling vs realtime) and T2-02 (design confirmation)
- [ ] Awaiting user go-ahead to fix all
