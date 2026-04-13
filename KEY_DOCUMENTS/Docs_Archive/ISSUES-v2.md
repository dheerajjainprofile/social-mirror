# Issues & Observations — v2 (Post Local Testing)

Logged after manual testing session. Fix only when explicitly asked.

---

## I-01 — LinkedIn link broken on landing page
Landing page footer shows "Built by Dheeraj Jain" with a LinkedIn link but it doesn't land on the correct profile directly. Need to cross-check the href value in `src/app/page.tsx`.

---

## I-02 — How-to-Play steps cut off on mobile/narrow window
When browser window is resized to phone width, only the first 3 steps of the "How it works" horizontal scroll row are visible and user has to scroll right. May be a snap/overflow UX issue — needs review.

---

## I-03 — QR Code for joining (brainstorm needed)
Was QR code planned in v2? Or is this a new suggestion from ChatGPT suggestions file? Need to check backlog/CHATGPT-suggestions.md. If it's a backlog item, note it here. If new, add to v3 backlog.

---

## I-04 — Presentation page: room code shown twice (needs decision)
On the presentation page (before anyone joins), room code appears at the top AND again in a very large font in the middle. User is unsure if this is a bug or intentional design. Needs a judgment call.

---

## I-05 — Presentation page: player list not updating in real-time (BROKEN)
When players join, the presentation page does not reflect it automatically — only shows on manual page refresh. Realtime subscription for players is either missing or broken on the present page.

---

## I-06 — Win/trophy display confusing for non-winners (UX issue)
On the reveal screen, every player sees "PLAYER B wins the round" with a trophy icon, AND non-winners see +2 or +1 next to their name. This is confusing — a player who came 2nd wonders why they see +2 if someone else "won."

**Proposed fix direction:** Replace the single "PLAYER B wins" trophy banner with rank-based display:
- 1st place → gold trophy 🥇
- 2nd → silver 🥈
- 3rd → bronze 🥉
- Lower → no trophy, just points
- Or: only show the winner banner to the winner themselves, and show "You came 2nd — +2 pts" to others.

Need user to confirm preferred approach before fixing.

---

## I-07 — Hot/Cold toggle causing screen reload for players (possible bug)
When organizer clicks Hot/Cold toggle after revealing a card, the player's screen starts reloading. Needs code walkthrough to understand what the button currently does before deciding if it's a bug or needs redesign/removal.

---

## I-08 — Round 2+ cards re-animating from scratch on reveal (bug)
From round 2 onwards, after clicking Reveal + confetti, all cards reload and animate in one-by-one again. Looks like a state reset bug — previous round's card animation state not being cleared properly.

---

## I-09 — Question bank flow: all loaded questions appear as "New This Session" (bug + UX brainstorm)
- All questions on "Load Sample Qs" appear in the amber "New This Session" tray with a red ✕ — this is wrong, preloaded questions should go straight to the approved/main list.
- Questions submitted by players always stay in the new/pending tray and never move to approved — need to confirm: does organizer need to explicitly approve? If yes, is there an approve button? Walk through intended flow.
- After a question is used in a round, it still shows in the question list. Should it be hidden/marked used?

---

## I-10 — Answer distribution: player name overlapping with "Answer Distribution" heading (UI bug)
On the reveal screen, player names in the answer distribution section overlap or mix with the section heading. Layout/z-index or overflow issue.

---

## I-11 — "Save Image" button broken on organizer game-over screen (BROKEN)
Clicking "📸 Save Image" on the organizer's end-game screen does nothing or errors. The `/api/export-image/[code]` route may be failing silently.

---

## I-12 — Players list UI looks weird (attached screenshot)
The Players (4) panel layout looks off — Dheeraj Jain shows HOST label, bottom player shows TARGET label, but overall layout/spacing feels wrong. Need to review the component rendering for this panel.

---

## Status
- [ ] All issues logged
- [ ] Awaiting user go-ahead to fix
