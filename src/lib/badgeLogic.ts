// Badge assignment logic — 13 Indian pop culture badges

export interface PlayerBadgeStats {
  playerId: string
  exactGuesses: number
  roundsWon: number
  consecutiveWins: number
  avgDistance: number
  isSlowButAccurate: boolean
  winsWithoutBeingFastest: number
  answerSpreadAsTarget: number
  passCount: number
  totalRounds: number
  submittedHighestNumbers: boolean
  isFastestConsistently: boolean
  neverWithin50Percent: boolean
  isTargetMostRounds: boolean
  closestGuesserRatio: number   // fraction of guesser rounds where player had min distance
  avgSubmittedNumber: number    // average number submitted as guesser (for Ambani)
  avgSubmissionRank: number     // average rank position by submission time (1 = fastest)
}

export interface Badge {
  name: string
  emoji: string
  copy: string
}

export interface PlayerBadge {
  playerId: string
  badge: string
  emoji: string
  name: string
  copy: string
  targetName?: string
  exactCount?: number
  rank?: number           // 1-based final leaderboard position
  totalPlayers?: number   // how many players competed
  bestDistance?: number | null  // closest distance from target (null if no non-passed guesses)
}

export interface GuessRecord {
  playerId: string
  roundId: string
  answer: number | null
  passed: boolean
  autoPassed?: boolean
  submittedAt?: string
}

export interface RoundRecord {
  roundId: string
  targetPlayerId: string
  targetAnswer: number
}

// Priority-ordered badge definitions — rarest first
const BADGE_PRIORITY = [
  'The Baba Vanga',
  'The Virat Kohli',
  'The Salman Khan',
  'The Aamir Khan',
  'The MS Dhoni',
  'The Mogambo',
  'The SRK',
  'The Arnab Goswami',
  'The Ambani',
  'The Hardik Pandya',
  'The Gabbar Singh',
  'The Devdas',
  'The Babu Bhaiya',
] as const

export function computeBadge(stats: PlayerBadgeStats): Badge {
  if (stats.exactGuesses >= 2) {
    return { name: 'The Baba Vanga', emoji: '🔮', copy: 'Predicted it exactly. Seek help.' }
  }
  if (stats.isSlowButAccurate) {
    return { name: 'The Aamir Khan', emoji: '🎬', copy: 'Took forever. Was right. Perfectionist things.' }
  }
  if (stats.consecutiveWins >= 3) {
    return { name: 'The Virat Kohli', emoji: '🔥', copy: 'Played like every point was personal. Because it was.' }
  }
  if (stats.closestGuesserRatio > 0.5 && !stats.isFastestConsistently) {
    return { name: 'The MS Dhoni', emoji: '🏏', copy: 'Cool head. Finished it every time.' }
  }
  if (stats.answerSpreadAsTarget > 100) {
    return { name: 'The Mogambo', emoji: '🕵️', copy: 'Nobody could crack me tonight. Mogambo khush hua.' }
  }
  if (stats.winsWithoutBeingFastest >= 2) {
    return { name: 'The Salman Khan', emoji: '🕶️', copy: 'Broke every rule. Won anyway. That\'s Bhai.' }
  }
  if (stats.isTargetMostRounds) {
    return { name: 'The SRK', emoji: '🌟', copy: 'The whole room was thinking about me tonight. Obviously.' }
  }
  if (stats.isFastestConsistently && stats.avgDistance > 80) {
    return { name: 'The Arnab Goswami', emoji: '🎙️', copy: 'The nation demanded an answer. It was wrong.' }
  }
  if (stats.submittedHighestNumbers) {
    return { name: 'The Ambani', emoji: '💰', copy: 'Thought in crores. Answered in crores. Relatable? No.' }
  }
  if (stats.isFastestConsistently && stats.avgDistance <= 80) {
    return { name: 'The Hardik Pandya', emoji: '⚡', copy: 'No plan. Just vibes. It worked.' }
  }
  if (stats.avgDistance > 60) {
    return { name: 'The Gabbar Singh', emoji: '😬', copy: 'Kitne aadmi the? Still completely wrong.' }
  }
  if (stats.passCount >= 3) {
    return { name: 'The Devdas', emoji: '👻', copy: 'Present. Suffering. Uninvolved.' }
  }
  return { name: 'The Babu Bhaiya', emoji: '🤷', copy: 'Haan... nahi... pata nahi. Wrong every time.' }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// For each round, returns Map<playerId, rank> where rank 1 = fastest submitter
function computeRoundSubmissionRanks(
  guesses: GuessRecord[],
  roundId: string
): Map<string, number> {
  const ranked = guesses
    .filter(g => g.roundId === roundId && !g.passed && g.submittedAt)
    .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime())

  const rankMap = new Map<string, number>()
  ranked.forEach((g, idx) => rankMap.set(g.playerId, idx + 1))
  return rankMap
}

// For each round, returns the playerId(s) with the minimum distance (closest guesser)
function getClosestGuessers(
  guesses: GuessRecord[],
  round: RoundRecord
): string[] {
  const activeGuesses = guesses.filter(
    g => g.roundId === round.roundId && !g.passed && g.answer !== null && g.playerId !== round.targetPlayerId
  )
  if (activeGuesses.length === 0) return []

  const withDist = activeGuesses.map(g => ({
    playerId: g.playerId,
    dist: Math.abs((g.answer as number) - round.targetAnswer),
  }))
  const minDist = Math.min(...withDist.map(g => g.dist))
  return withDist.filter(g => g.dist === minDist).map(g => g.playerId)
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function assignBadges(
  playerIds: string[],
  guesses: GuessRecord[],
  rounds: RoundRecord[],
  scores: { playerId: string; roundId: string; points: number }[],
  playerNames: Record<string, string>
): PlayerBadge[] {
  if (playerIds.length === 0) return []

  // Pre-compute submission ranks per round (only if timestamps available)
  const hasTimestamps = guesses.some(g => !!g.submittedAt)
  const roundSubmissionRanks = new Map<string, Map<string, number>>()
  if (hasTimestamps) {
    for (const r of rounds) {
      roundSubmissionRanks.set(r.roundId, computeRoundSubmissionRanks(guesses, r.roundId))
    }
  }

  // Pre-compute who was closest guesser per round
  const closestGuessersByRound = new Map<string, string[]>()
  for (const r of rounds) {
    closestGuessersByRound.set(r.roundId, getClosestGuessers(guesses, r))
  }

  // Pre-compute target round counts for SRK
  const targetCounts: Record<string, number> = {}
  for (const r of rounds) {
    targetCounts[r.targetPlayerId] = (targetCounts[r.targetPlayerId] ?? 0) + 1
  }
  const maxTargetCount = Math.max(0, ...Object.values(targetCounts))

  // ── Phase 1: compute per-player raw stats ──────────────────────────────────

  interface PlayerRawStats extends PlayerBadgeStats {
    // extra fields used for tie-breaking, not in PlayerBadgeStats
    _exactGuessCount: number
    _targetCount: number
  }

  const allStats: PlayerRawStats[] = playerIds.map(playerId => {
    const myGuesses = guesses.filter(g => g.playerId === playerId && !g.passed && g.answer !== null)
    const totalRounds = rounds.length

    // exactGuesses
    const exactGuesses = myGuesses.filter(g => {
      const r = rounds.find(r => r.roundId === g.roundId)
      return r && Math.abs((g.answer as number) - r.targetAnswer) === 0
    }).length

    // roundsWon
    const roundsWon = scores.filter(s => s.playerId === playerId && s.points > 0).length

    // consecutiveWins
    let maxStreak = 0, currentStreak = 0
    for (const r of rounds) {
      const won = scores.some(s => s.playerId === playerId && s.roundId === r.roundId && s.points > 0)
      if (won) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak) }
      else currentStreak = 0
    }

    // avgDistance
    const avgDistance = myGuesses.length > 0
      ? myGuesses.reduce((acc, g) => {
          const r = rounds.find(r => r.roundId === g.roundId)
          return r ? acc + Math.abs((g.answer as number) - r.targetAnswer) : acc
        }, 0) / myGuesses.length
      : 0

    // answerSpreadAsTarget (std dev of guesses when this player was target)
    const roundsAsTarget = rounds.filter(r => r.targetPlayerId === playerId)
    let totalSpread = 0
    for (const r of roundsAsTarget) {
      const rGuesses = guesses
        .filter(g => g.roundId === r.roundId && !g.passed && g.answer !== null)
        .map(g => g.answer as number)
      if (rGuesses.length >= 2) {
        const mean = rGuesses.reduce((a, b) => a + b, 0) / rGuesses.length
        totalSpread += Math.sqrt(rGuesses.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rGuesses.length)
      }
    }
    const answerSpreadAsTarget = roundsAsTarget.length > 0 ? totalSpread / roundsAsTarget.length : 0

    // passCount — only explicit passes, not auto-created rows for unanswered rounds
    const passCount = guesses.filter(g => g.playerId === playerId && g.passed && !g.autoPassed).length

    // neverWithin50Percent
    const neverWithin50Percent = myGuesses.length > 0 && myGuesses.every(g => {
      const r = rounds.find(r => r.roundId === g.roundId)
      if (!r || r.targetAnswer === 0) return false
      return Math.abs((g.answer as number) - r.targetAnswer) / r.targetAnswer > 0.5
    })

    // isTargetMostRounds
    const myTargetCount = targetCounts[playerId] ?? 0
    const isTargetMostRounds = myTargetCount > 0 && myTargetCount === maxTargetCount

    // closestGuesserRatio — rounds where player was guesser (not target, not passed)
    const roundsAsGuesser = rounds.filter(r => r.targetPlayerId !== playerId)
    const roundsAsClosest = roundsAsGuesser.filter(r => {
      const closest = closestGuessersByRound.get(r.roundId) ?? []
      return closest.includes(playerId)
    }).length
    const closestGuesserRatio = roundsAsGuesser.length > 0 ? roundsAsClosest / roundsAsGuesser.length : 0

    // avgSubmittedNumber
    const avgSubmittedNumber = myGuesses.length > 0
      ? myGuesses.reduce((acc, g) => acc + (g.answer as number), 0) / myGuesses.length
      : 0

    // avgSubmissionRank (lower = faster; 0 if no timestamp data)
    let avgSubmissionRank = 0
    if (hasTimestamps) {
      const ranks: number[] = []
      for (const r of rounds) {
        if (r.targetPlayerId === playerId) continue
        const roundRanks = roundSubmissionRanks.get(r.roundId)
        if (roundRanks?.has(playerId)) ranks.push(roundRanks.get(playerId)!)
      }
      avgSubmissionRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0
    }

    // winsWithoutBeingFastest
    let winsWithoutBeingFastest = 0
    if (hasTimestamps) {
      for (const r of rounds) {
        const won = scores.some(s => s.playerId === playerId && s.roundId === r.roundId && s.points > 0)
        if (!won) continue
        const roundRanks = roundSubmissionRanks.get(r.roundId)
        const rank = roundRanks?.get(playerId) ?? 999
        if (rank !== 1) winsWithoutBeingFastest++
      }
    }

    return {
      playerId,
      exactGuesses,
      roundsWon,
      consecutiveWins: maxStreak,
      avgDistance,
      isSlowButAccurate: false, // resolved in phase 2
      winsWithoutBeingFastest,
      answerSpreadAsTarget,
      passCount,
      totalRounds,
      submittedHighestNumbers: false, // resolved in phase 2
      isFastestConsistently: false,   // resolved in phase 2
      neverWithin50Percent,
      isTargetMostRounds,
      closestGuesserRatio,
      avgSubmittedNumber,
      avgSubmissionRank,
      _exactGuessCount: exactGuesses,
      _targetCount: targetCounts[playerId] ?? 0,
    }
  })

  // ── Phase 2: resolve cross-player stats ────────────────────────────────────

  const guessers = allStats.filter(s => s.avgDistance > 0 || s.exactGuesses > 0 || s.closestGuesserRatio > 0)

  // submittedHighestNumbers — player with highest avgSubmittedNumber
  const maxAvgNumber = Math.max(...allStats.map(s => s.avgSubmittedNumber))
  if (maxAvgNumber > 0) {
    allStats
      .filter(s => s.avgSubmittedNumber === maxAvgNumber)
      .forEach(s => { s.submittedHighestNumbers = true })
  }

  if (hasTimestamps && guessers.length > 0) {
    // isFastestConsistently — top 3 fastest avg submission rank (lowest rank = fastest)
    // Only among players who actually submitted (have a rank)
    const withRanks = allStats.filter(s => s.avgSubmissionRank > 0)
    if (withRanks.length > 0) {
      const sortedBySpeed = [...withRanks].sort((a, b) => a.avgSubmissionRank - b.avgSubmissionRank)
      const top3Cutoff = sortedBySpeed[Math.min(2, sortedBySpeed.length - 1)].avgSubmissionRank
      const medianDistIdx = Math.floor(withRanks.length / 2)
      const sortedByDist = [...withRanks].sort((a, b) => a.avgDistance - b.avgDistance)
      const medianDist = sortedByDist[medianDistIdx]?.avgDistance ?? Infinity

      allStats
        .filter(s => s.avgSubmissionRank > 0 && s.avgSubmissionRank <= top3Cutoff)
        .forEach(s => { s.isFastestConsistently = true })

      // isSlowButAccurate — lowest avgDistance AND slowest submission (highest avgSubmissionRank)
      const minDist = Math.min(...withRanks.map(s => s.avgDistance))
      const maxRank = Math.max(...withRanks.map(s => s.avgSubmissionRank))
      allStats
        .filter(s => s.avgDistance === minDist && s.avgSubmissionRank === maxRank && s.avgDistance <= medianDist)
        .forEach(s => { s.isSlowButAccurate = true })
    }
  }

  // ── Phase 3: assign badges with exclusivity ────────────────────────────────

  const assigned = new Set<string>() // badge names already given out
  const results: PlayerBadge[] = []

  // For each player, determine their badge in priority order
  // If their top badge is already taken, move to next
  // Sort players by playerId for stable tie-breaking
  const sortedPlayerStats = [...allStats].sort((a, b) => a.playerId.localeCompare(b.playerId))

  // Build candidate map: badge → players who qualify, sorted by "best qualifier"
  function qualifiesFor(stats: PlayerRawStats, badgeName: string): boolean {
    switch (badgeName) {
      case 'The Baba Vanga': return stats.exactGuesses >= 2
      case 'The Aamir Khan': return stats.isSlowButAccurate
      case 'The Virat Kohli': return stats.consecutiveWins >= 3
      case 'The MS Dhoni': return stats.closestGuesserRatio > 0.5 && !stats.isFastestConsistently
      case 'The Mogambo': return stats.answerSpreadAsTarget > 100
      case 'The Salman Khan': return stats.winsWithoutBeingFastest >= 2
      case 'The SRK': return stats.isTargetMostRounds
      case 'The Arnab Goswami': return stats.isFastestConsistently && stats.avgDistance > 80
      case 'The Ambani': return stats.submittedHighestNumbers
      case 'The Hardik Pandya': return stats.isFastestConsistently && stats.avgDistance <= 80
      case 'The Gabbar Singh': return stats.avgDistance > 60
      case 'The Devdas': return stats.passCount >= 3
      case 'The Babu Bhaiya': return true
      default: return false
    }
  }

  // Greedy assignment: for each player (priority order = badge rarity), assign highest available badge
  for (const stats of sortedPlayerStats) {
    let badgeAssigned = false
    for (const badgeName of BADGE_PRIORITY) {
      if (assigned.has(badgeName)) continue
      if (qualifiesFor(stats, badgeName)) {
        assigned.add(badgeName)
        const badge = computeBadge({ ...stats })
        // computeBadge may return a different badge if stats don't perfectly align
        // Use the badge name directly from the priority check instead
        const badgeDef = getBadgeDef(badgeName)
        results.push({
          playerId: stats.playerId,
          badge: badgeDef.name,
          emoji: badgeDef.emoji,
          name: badgeDef.name,
          copy: badgeDef.copy,
        })
        badgeAssigned = true
        break
      }
    }
    if (!badgeAssigned) {
      // Fallback — should not happen since Babu Bhaiya always qualifies
      const fallback = getBadgeDef('The Babu Bhaiya')
      results.push({
        playerId: stats.playerId,
        badge: fallback.name,
        emoji: fallback.emoji,
        name: fallback.name,
        copy: fallback.copy,
      })
    }
  }

  // Return in original playerIds order
  return playerIds.map(id => results.find(r => r.playerId === id)!).filter(Boolean)
}

function getBadgeDef(name: string): Badge {
  const defs: Record<string, Badge> = {
    'The Baba Vanga': { name: 'The Baba Vanga', emoji: '🔮', copy: 'Predicted it exactly. Seek help.' },
    'The Aamir Khan': { name: 'The Aamir Khan', emoji: '🎬', copy: 'Took forever. Was right. Perfectionist things.' },
    'The Virat Kohli': { name: 'The Virat Kohli', emoji: '🔥', copy: 'Played like every point was personal. Because it was.' },
    'The MS Dhoni': { name: 'The MS Dhoni', emoji: '🏏', copy: 'Cool head. Finished it every time.' },
    'The Mogambo': { name: 'The Mogambo', emoji: '🕵️', copy: 'Nobody could crack me tonight. Mogambo khush hua.' },
    'The Salman Khan': { name: 'The Salman Khan', emoji: '🕶️', copy: 'Broke every rule. Won anyway. That\'s Bhai.' },
    'The SRK': { name: 'The SRK', emoji: '🌟', copy: 'The whole room was thinking about me tonight. Obviously.' },
    'The Arnab Goswami': { name: 'The Arnab Goswami', emoji: '🎙️', copy: 'The nation demanded an answer. It was wrong.' },
    'The Ambani': { name: 'The Ambani', emoji: '💰', copy: 'Thought in crores. Answered in crores. Relatable? No.' },
    'The Hardik Pandya': { name: 'The Hardik Pandya', emoji: '⚡', copy: 'No plan. Just vibes. It worked.' },
    'The Gabbar Singh': { name: 'The Gabbar Singh', emoji: '😬', copy: 'Kitne aadmi the? Still completely wrong.' },
    'The Devdas': { name: 'The Devdas', emoji: '👻', copy: 'Present. Suffering. Uninvolved.' },
    'The Babu Bhaiya': { name: 'The Babu Bhaiya', emoji: '🤷', copy: 'Haan... nahi... pata nahi. Wrong every time.' },
  }
  return defs[name] ?? defs['The Babu Bhaiya']
}
