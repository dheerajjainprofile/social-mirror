# Guessing the Guess — Session Report
**Generated:** 2026-04-01  
**Data range:** 2026-03-31 to 2026-04-01

---

## Overall Activity

| Metric | Count |
|--------|-------|
| Total sessions created | 15 |
| Sessions properly ended | 5 |
| Sessions abandoned (still active) | 10 |
| Total rounds played | 22 |
| Total player joins | 57 |
| Total guesses submitted | 37 |
| Total target answers submitted | 20 |
| Total scores awarded | 34 |
| Questions in bank | 76 (includes duplicates) |

---

## How Testing Evolved

| Phase | Sessions | What was tested | Scoring mode |
|-------|----------|----------------|--------------|
| Early (31 Mar morning) | 2KWRVL, 8BNCZC | Basic flow, localhost, test players (Nishita Mehta, John Snow) | Simple |
| Mid (31 Mar afternoon) | T3XQX8, FXMFWB, W82LKE, D3ARJC, DTNDJL | Rich mode introduced, hot/cold, reasoning | Mixed |
| Later (31 Mar evening) | MMGGNA, GQNB2G, E8R4Z7 | Full rich mode + reasoning + hot/cold | Rich |
| Final (1 Apr) | E8UJVZ, 634JH6, XNWEWH, 53XWGF, 6SRT2H | Real multi-player testing, Vercel deployed | Rich |

**Key pattern:** Organizer consistently upgraded preferences over time — moved from Simple/no-reasoning to Rich + hot/cold + reasoning. This suggests the richer experience felt significantly better once tried.

---

## Completed Sessions (status = ended)

| Room Code | Organizer | Scoring | Notes |
|-----------|-----------|---------|-------|
| W82LKE | Dheeraj | Simple | Had guesses + scores recorded |
| DTNDJL | Dheeraj | Simple | Had guesses + scores recorded |
| E8R4Z7 | Dheeraj | Rich | Reasoning ON, hot/cold ON |
| E8UJVZ | Dheeraj | Rich | Reasoning ON, hot/cold OFF |
| 53XWGF | Jain | Rich | Reasoning ON, hot/cold ON |
| 6SRT2H | Dheeraj JAIN | Rich | Most recent, Vercel session |

---

## Abandoned Sessions (status = active, never ended)

10 sessions were left without being properly ended. Likely causes:
- Tab closed mid-game
- Testing a specific feature and moving on
- Players dropped off

---

## Question Bank Issues

- Total questions: 76
- Source `preloaded` (original batch): ~20 questions
- Source `Pre-loaded` (seed button clicked multiple times): ~40 duplicate questions
- Player-submitted test questions found: "how may toothpase", "what's up bro count" (test inputs)
- **Fix already deployed** — seed button now checks before inserting. Old duplicates still in DB and need manual cleanup.

---

## Scoring Observations

- Simple mode: 1 point per round winner — working correctly
- Rich mode: 3/2/1 points — working correctly, scores table confirms
- Tie scoring: not tested yet in real sessions

---

## Player Behaviour

- Same player joined as "John Snow" twice in the same session (duplicate join — no prevention in place)
- Multiple organizer name variations: "Dheeraj Jain", "Dheeraj jain", "Dheeraj JAIN", "Jain" — no name standardisation
- All early sessions ran on localhost (ip_address = ::1); later sessions from Vercel show real IPs

