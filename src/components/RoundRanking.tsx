'use client'

import { useEffect, useState } from 'react'
import { calculateScores } from '@/lib/utils'
import type { RevealCardData } from './RevealCard'

interface RoundRankingProps {
  cards: RevealCardData[]          // all reveal cards (including target)
  targetAnswer: number
  scoringMode: 'simple' | 'rich'
}

interface RankRow {
  playerId: string
  playerName: string
  answer: number | null
  passed: boolean
  distance: number | null
  rank: number | null
  points: number
  medal: string
  label: string
  isBiggestMiss: boolean
}

function distanceLabel(distance: number | null): string {
  if (distance === null) return 'Passed'
  if (distance === 0) return '🎯 EXACT!'
  if (distance <= 5) return 'So close!'
  if (distance <= 20) return 'Not bad'
  if (distance <= 50) return 'Off track'
  return 'Way off 😬'
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function RoundRanking({ cards, targetAnswer, scoringMode }: RoundRankingProps) {
  const [visibleCount, setVisibleCount] = useState(0)

  const guessCards = cards.filter((c) => !c.isTarget)

  // Compute scores
  const guessEntries = guessCards
    .filter((c) => !c.passed && c.answer !== null && c.playerId)
    .map((c) => ({ playerId: c.playerId!, answer: c.answer!, submittedAt: '' }))
  const scoreMap = new Map(calculateScores(guessEntries, targetAnswer, scoringMode).map((s) => [s.playerId, s.points]))

  // Build rows sorted by distance ascending (closest first) for ranking
  const withDist = guessCards.map((c) => {
    const dist = c.passed || c.answer === null ? null : Math.abs(c.answer - targetAnswer)
    return { ...c, distance: dist }
  })

  // Dense rank (passed players get null rank)
  const sorted = [...withDist].sort((a, b) => {
    if (a.distance === null) return 1
    if (b.distance === null) return -1
    return a.distance - b.distance
  })
  let rank = 0
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].distance === null) { (sorted[i] as { rank?: number | null }).rank = null; continue }
    if (i > 0 && sorted[i].distance !== sorted[i - 1].distance) rank++
    ;(sorted[i] as { rank?: number | null }).rank = rank
  }

  // Biggest miss: non-passed player with largest distance, only if distance > 0
  const nonPassed = withDist.filter((c) => c.distance !== null && c.distance > 0)
  const maxDist = nonPassed.length > 0 ? Math.max(...nonPassed.map((c) => c.distance!)) : -1

  const rows: RankRow[] = sorted.map((c) => {
    const r = (c as { rank?: number | null }).rank ?? null
    const isBiggestMiss = c.distance !== null && c.distance > 0 && c.distance === maxDist && nonPassed.length > 1 && r !== 0
    return {
      playerId: c.playerId ?? '',
      playerName: c.playerName,
      answer: c.answer ?? null,
      passed: c.passed ?? false,
      distance: c.distance ?? null,
      rank: r,
      points: c.playerId ? (scoreMap.get(c.playerId) ?? 0) : 0,
      medal: r !== null && r < 3 ? MEDALS[r] : '',
      label: distanceLabel(c.distance ?? null),
      isBiggestMiss: isBiggestMiss && !c.passed,
    }
  })

  // Display order: worst first, winner(s) last
  const displayRows = [...rows].reverse()

  useEffect(() => {
    setVisibleCount(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    displayRows.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount((n) => Math.max(n, i + 1)), 350 * i + 200))
    })
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, targetAnswer])

  if (guessCards.length === 0) return null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Round Results</h3>
      </div>
      <div className="divide-y divide-slate-700/50">
        {displayRows.map((row, i) => (
          <div
            key={row.playerId}
            className={`flex items-center gap-3 px-4 py-3 transition-all duration-500 ${
              i < visibleCount ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
            } ${row.rank === 0 ? 'bg-gradient-to-r from-yellow-950/30 to-transparent' : ''}`}
          >
            {/* Medal / position */}
            <div className="w-8 text-center text-xl shrink-0">
              {row.medal || (row.passed ? '—' : <span className="text-slate-500 text-sm font-bold">#{(row.rank ?? 0) + 1}</span>)}
            </div>

            {/* Name + label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold text-sm ${row.rank === 0 ? 'text-yellow-200' : 'text-white'}`}>
                  {row.playerName}
                </span>
                {row.isBiggestMiss && (
                  <span className="text-xs bg-red-900/40 border border-red-700 text-red-400 px-1.5 py-0.5 rounded-full">
                    🎪 Biggest miss
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {row.label}
                {row.distance !== null && row.distance > 0 && (
                  <span className="text-slate-500 ml-1">· off by {row.distance}</span>
                )}
              </div>
            </div>

            {/* Answer */}
            <div className="text-right shrink-0">
              <div className={`font-black text-lg ${row.rank === 0 ? 'text-yellow-300' : 'text-slate-200'}`}>
                {row.passed ? <span className="text-slate-500 text-sm italic">Passed</span> : row.answer}
              </div>
              {row.points > 0 && (
                <div className="text-xs text-emerald-400 font-bold">+{row.points} pts</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
