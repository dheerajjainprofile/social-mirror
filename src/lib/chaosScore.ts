// Chaos score calculation — pure function, fully testable
// Chaos score = average distance of all guesses from all targets across the whole session
// High chaos = everyone was wildly off; Low chaos = tight, accurate group

export interface ChaosGuess {
  answer: number | null
  passed: boolean
  targetAnswer: number
}

export interface ChaosResult {
  score: number
  label: string
  emoji: string
  totalGuesses: number
}

export function calculateChaosScore(guesses: ChaosGuess[]): ChaosResult {
  const validGuesses = guesses.filter((g) => !g.passed && g.answer !== null)

  if (validGuesses.length === 0) {
    return { score: 0, label: 'No guesses', emoji: '🤔', totalGuesses: 0 }
  }

  const totalDistance = validGuesses.reduce((acc, g) => {
    return acc + Math.abs((g.answer as number) - g.targetAnswer)
  }, 0)

  const score = Math.round(totalDistance / validGuesses.length)

  return {
    score,
    label: getChaosLabel(score),
    emoji: getChaosEmoji(score),
    totalGuesses: validGuesses.length,
  }
}

export function getChaosLabel(score: number): string {
  if (score <= 20) return 'Eerily accurate group'
  if (score <= 50) return 'Pretty good reads'
  if (score <= 100) return 'Respectably chaotic'
  return 'Absolute chaos'
}

export function getChaosEmoji(score: number): string {
  if (score <= 20) return '🎯'
  if (score <= 50) return '😊'
  if (score <= 100) return '😂'
  return '💀'
}

export function getChaosScoreLabel(score: number): { emoji: string; label: string; description: string } {
  if (score <= 20) return { emoji: '🎯', label: 'Eerily Accurate', description: 'Your group knows each other on a concerning level.' }
  if (score <= 50) return { emoji: '😊', label: 'Pretty Good Reads', description: 'You know your friends. Mostly.' }
  if (score <= 100) return { emoji: '😂', label: 'Respectably Chaotic', description: 'Your group gives each other absolutely no credit.' }
  return { emoji: '💀', label: 'Beautiful Chaos', description: 'Nobody knows anyone. Somehow still friends.' }
}
