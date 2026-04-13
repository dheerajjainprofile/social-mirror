# ChatGPT Product Review — Guessing the Guess

> Raw feedback from ChatGPT after reviewing PRD-PROD-v1, BACKLOG.md, and PRD-PROD-v2.
> Added to repo for reference during v3 strategy planning.
> Date: 2026-04-01

---

You're right — Claude Code.
I read your three documents as one product story: v1 = what is actually live, the backlog = what reality taught you in testing, and v2 = the intended correction plus polish layer. That is already a very PM-ish way to work, and it's better than how many first-time founders operate.

My strongest conclusion is this:
Guessing the Guess already has the bones of a good party game, but it is not yet designed as a viral product.

Right now, the docs are strongest on gameplay clarity, reliability, and visual polish, but weaker on the three things that actually create spread:
- frictionless host/start flow,
- high-quality reusable prompt systems, and
- artifact-driven sharing that converts players into future hosts.

That distinction matters because virality and network effects are not the same thing: a product can be fun in a group without automatically acquiring new users. Existing users need to expose the product to non-users through the product's natural usage loop. Andrew Chen calls out Dropbox folder sharing and Zoom meeting links as examples of this kind of product-native growth, and NFX draws the same distinction between "viral effects" and "network effects."

## What is already very good

The core mechanic is strong because it creates social tension + surprise + identity: "How well do you know your friends?" That is a proven shape for party games. Your v1 already has the right multiplayer architecture: room code, host screen, player phones as controllers, and a TV/present view. That setup is very similar to what makes Jackbox easy to host: one visible host screen, everyone else joining on their own device.

You also already spotted the right v2 directions:
- better per-round drama,
- question freshness,
- shareable export,
- duplicate prevention,
- cleanup,
- testing,
- visual identity.

Those are legitimate improvements, not fluff. The backlog log also shows you are listening to real usage rather than inventing roadmap items in a vacuum, which is exactly what good product teams do.

## The biggest strategic mistake in the current plan

Your v2 puts too much weight on polish before solving growth mechanics.

The PRD explicitly centers v2 on "polish and identity," visual overhaul, sound, animation, and branding. That will improve delight, but delight alone rarely creates distribution. The current plan improves how the app feels after a room exists, but not enough about how new rooms get created again and again.

Said differently:
**You are optimizing session quality.**
**You are not yet optimizing session propagation.**
That is the central gap.

## The most important product insight: your real growth loop is not "share a leaderboard"

It is:
**play with friends → create a social artifact worth posting → make the next group able to start instantly → turn one player into the next host.**

That is the loop I would design around.

Your export PNG is a good start, but as currently described it is still mostly a static results card. It needs to become a challenge artifact, not just a souvenir. The current v2 export includes leaderboard, best guess, biggest miss, and branding. Nice — but not enough. It should also contain a direct invitation mechanic: a QR, short URL, or "Play this exact pack with your group" hook, because the best viral loops are baked into the product's natural output.

### What I would change in the export

Instead of only:
- winner,
- leaderboard,
- funny line,

add:
- "Who knows your group best?"
- "Beat this chaos score."
- "Play the same deck."
- QR + deep link to create a room instantly.
- personal badges for players, not only the room.

The highest-sharing assets will not be the room leaderboard. They will be:
- "I know Priya best."
- "I was the biggest miss."
- "Most unpredictable friend."
- "2 exact guesses. Psychic energy."

Those are identity-rich and post-worthy.

## Your question system is more important than your animation system

This is the single biggest product truth in your docs.

Right now, the roadmap treats questions as:
- data cleanup,
- file-based management,
- category storage,
- organizer moderation.

That is necessary, but not sufficient.

For this game, **question quality is the product.**

If the questions are average, the app will never become viral no matter how polished it looks. Jackbox's event guidance also shows how much audience-friendly settings, moderation, and player-created content controls matter when games rely on user input.

### What is wrong with the current question model

Your current seeded categories are: habits, social, money, food, work, fun.

That taxonomy is too content-oriented and not enough energy-oriented. Party games are won by session pacing, not by neat database categories.

I would replace or supplement those categories with play-mode categories:
- **Warm-up** — easy, low-risk, fast answers.
- **Revealing** — interesting personal insight.
- **Chaotic** — high-spread numeric answers, fun misses.
- **Savage** — playful embarrassment / friend knowledge flex.
- **Work-safe** — offsite/team-friendly.
- **Late-night** — bolder, more intimate.
- Couples / college / family / office packs.

That makes hosting easier and makes the game more reusable across contexts.

### The feature I would add immediately

Add question analytics per prompt, not just session feedback:
- pick rate,
- pass rate,
- answer spread,
- average round rating,
- share rate,
- funny-moment rate,
- skip rate.

Your current feedback table is session-level and useful, but it will not tell you which questions create energy. You need prompt-level telemetry because the fastest route to virality is not prettier buttons — it is a deck that consistently produces stories people retell later.

## The second big gap: you don't yet have a "white hot center"

NFX's "white hot center" idea is very relevant here: early growth comes from finding the narrow cluster of users who already love the product most and then designing around them, instead of trying to appeal broadly too soon.

Right now your product can fit: house parties, close friend groups, college hangouts, office offsites, families, remote groups. That is too broad for early growth.

### Pick one first

My instinct is that your strongest early wedge is one of these:
- close-friend house parties, or
- team offsites / work socials.

They have different product needs.

**House-party version wants:**
- chaotic and spicy prompts,
- faster pacing,
- bragging artifacts,
- rematch loops.

**Work version wants:**
- safer decks,
- moderation,
- lower embarrassment,
- easier facilitation,
- cleaner presentation mode.

Do not design equally for both right now. Find which group already gives you: longer sessions, more rounds, more replays, more shares, more next-day host conversions. That is your white hot center.

## The third big gap: larger groups currently hit a dead end

You cap rooms at 12 players. That is fine technically, but party games often get better as more people feel involved — until they hit congestion. NFX explicitly notes that network value can flip into congestion when too many same-side users create friction, and Jackbox solves large-group pressure with audience play-along.

### I would add a lightweight audience mode

Not full gameplay. Just:
- join as audience,
- predict who will be closest,
- vote funniest reasoning,
- react to reveals,
- submit "next round" questions,
- influence bonus awards.

Why this matters:
- it removes the "sorry, room is full" dead end,
- turns parties bigger than 12 into growth fuel,
- gives non-players a reason to scan the QR,
- increases social energy in the room.

This is more powerful than floating numbers on the landing page.

## The host experience needs more simplification than the docs admit

Your current /create flow asks the organizer to set name, scoring mode, reveal mode, show reasoning, hot/cold, and timer before even starting. That is a lot for a live social setting.

For a party product, the host should be able to get to "room live" in under 10 seconds.

### What I would change

Replace the current configuration-first flow with:
- Quick Start
- Party Mode
- Work Mode
- Custom

Each preset chooses defaults for: timer, reasoning on/off, reveal control, question pack, tone. Most hosts do not want five knobs. They want one smart choice.

I would also add:
- auto target rotation,
- suggest next question automatically,
- pause/resume,
- late join or rejoin flow,
- timer expiry decision now, not later.

Your own docs already expose that timer enforcement and reveal gating are still unresolved future items, and that is more important than several polish items in B27.

## Two important doc inconsistencies you should fix before asking any AI to build more

These matter because agents like Claude Code or ChatGPT will misread them.

**1) Status language is inconsistent**
PRD v2 says "Planning — not yet built," but the backlog marks many v2 items as done. That is confusing unless "done" means "implemented in code but not shipped," which is not stated clearly.

I would define four separate statuses: groomed, built in v2 branch, QA passed, shipped to main.

**2) Scope is inconsistent**
PRD v2's scope list does not include B22, but the build order includes it in Phase 3. Meanwhile, v1 says question deletion is not built. That should be cleaned up, or future implementation will drift.

**3) Reveal mode behavior is under-specified**
v1 includes a Reveal Mode setting at room creation, but the round flow describes organizer-controlled reveal and does not clearly explain what "Auto reveal" actually does in the live experience. That is exactly the kind of spec hole that causes buggy implementations.

## What I would deprioritize

If your goal is "make this app viral," I would push these down:
- Mermaid diagrams,
- floating numbers on landing page,
- custom wordmark perfection,
- some micro-animations,
- generalized end-of-session feedback without immediate action.

Those are not bad. They are just lower leverage than: better prompts, faster host flow, audience mode, share-to-host loop, personal result cards, session presets, prompt analytics.

## My recommended top 8 additions

In order:

1. **Challenge share card** — Not just leaderboard — "Can your group beat this?" with QR/deep link.
2. **Personal result cards** — "I knew X best," "Biggest miss," "Most unpredictable friend."
3. **Audience mode** — Predictions, voting, reactions, question submissions.
4. **Question packs by context** — House party, work, couples, family, college, spicy, warm-up.
5. **Prompt-level analytics** — Find the questions that create laughs, shares, and replays.
6. **Quick Start presets** — Reduce host setup friction dramatically.
7. **Auto target rotation + smarter facilitation** — Lower organizer cognitive load.
8. **Replay/host conversion screen** — At game over, every player should see: Play again / Host your own room / Use this same pack / Share your badge.

That last one is probably the most important single screen in the whole app.

## The one-sentence product strategy I would use

**Build Guessing the Guess as the fastest way for any friend group to generate "you had to be there" moments — then turn those moments into shareable identity artifacts that launch the next session.**

That's the product. Not just "a fun estimation game." A moment engine.

## Revised roadmap priority

**Before more polish:**
- quick-start presets,
- prompt packs,
- audience mode,
- share/host loop,
- timer/reveal flow fixes.

**Then polish:**
- sound,
- animations,
- podium,
- branding,
- export aesthetics.

---

*You have a real shot here. The core mechanic is good. The mistake would be thinking the last mile is more neon and confetti. The last mile is better prompts, faster hosting, and stronger social propagation.*
