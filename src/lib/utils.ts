// Name standardisation — trim + title case ("dheeraj jain" → "Dheeraj Jain")
export function toTitleCase(name: string): string {
  return name.trim().replace(/\S+/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )
}

// Room code generation
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// Hot/Cold calculation
export type HotColdRating = 'hot' | 'warm' | 'cold'

export function calculateHotCold(guess: number, target: number): HotColdRating {
  if (target === 0) {
    const diff = Math.abs(guess)
    if (diff < 1) return 'hot'
    if (diff < 5) return 'warm'
    return 'cold'
  }
  const pctDiff = Math.abs((guess - target) / target) * 100
  if (pctDiff < 20) return 'hot'
  if (pctDiff < 50) return 'warm'
  return 'cold'
}

export function hotColdColor(rating: HotColdRating): string {
  switch (rating) {
    case 'hot': return 'text-red-400'
    case 'warm': return 'text-yellow-400'
    case 'cold': return 'text-blue-400'
  }
}

export function hotColdLabel(rating: HotColdRating): string {
  switch (rating) {
    case 'hot': return '🔥 Hot!'
    case 'warm': return '☀️ Warm'
    case 'cold': return '🧊 Cold'
  }
}

// Scoring
export interface GuessEntry {
  playerId: string
  answer: number
  submittedAt: string
}

export function calculateScores(
  guesses: GuessEntry[],
  target: number,
  scoringMode: 'simple' | 'rich'
): { playerId: string; points: number }[] {
  if (guesses.length === 0) return []

  // Sort by proximity only — tied answers share the same rank (no time tiebreaker)
  const sorted = [...guesses].sort((a, b) => {
    return Math.abs(a.answer - target) - Math.abs(b.answer - target)
  })

  if (scoringMode === 'simple') {
    // All players tied for 1st place (same distance) get 1 point
    const minDiff = Math.abs(sorted[0].answer - target)
    return sorted.map((g) => ({
      playerId: g.playerId,
      points: Math.abs(g.answer - target) === minDiff ? 1 : 0,
    }))
  }

  // Rich: 1st=3, 2nd=2, 3rd=1 — tied players share the same rank and same points
  const pointMap = [3, 2, 1]
  const result: { playerId: string; points: number }[] = []
  let rank = 0
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && Math.abs(sorted[i].answer - target) !== Math.abs(sorted[i - 1].answer - target)) {
      rank++
    }
    result.push({ playerId: sorted[i].playerId, points: pointMap[rank] ?? 0 })
  }
  return result
}

// Format number nicely
export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n)
}
