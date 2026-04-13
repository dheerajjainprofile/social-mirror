'use client'

import { useEffect, useRef, useState } from 'react'
import { getPlayerColorByIndex } from '@/lib/playerColors'

interface PlayerScore {
  playerId: string
  playerName: string
  totalPoints: number
  colorIndex?: number
}

interface LeaderboardProps {
  scores: PlayerScore[]
  highlightId?: string
}

const medals = ['🥇', '🥈', '🥉']

export default function Leaderboard({ scores, highlightId }: LeaderboardProps) {
  const sorted = [...scores].sort((a, b) => b.totalPoints - a.totalPoints)

  // Track previous positions for ↑↓ indicators
  const prevRankRef = useRef<Map<string, number>>(new Map())
  const [posChanges, setPosChanges] = useState<Map<string, number>>(new Map())
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const newRanks = new Map(sorted.map((e, i) => [e.playerId, i]))
    const changes = new Map<string, number>()
    newRanks.forEach((rank, id) => {
      const prev = prevRankRef.current.get(id)
      if (prev !== undefined && prev !== rank) changes.set(id, prev - rank) // positive = moved up
    })
    setPosChanges(changes)
    prevRankRef.current = newRanks

    // Stagger slide-in animations
    const ids = sorted.map((e) => e.playerId)
    setVisibleIds(new Set())
    ids.forEach((id, i) => {
      setTimeout(() => setVisibleIds((prev) => new Set([...prev, id])), i * 80)
    })

    // Clear position indicators after 2s
    const t = setTimeout(() => setPosChanges(new Map()), 2000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores])

  if (sorted.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-slate-300 font-bold mb-3 text-lg">Leaderboard</h3>
        <p className="text-slate-500 text-sm">No scores yet</p>
      </div>
    )
  }

  const isLeader = (id: string) => sorted[0]?.playerId === id && sorted[0]?.totalPoints > 0

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-slate-300 font-bold mb-3 text-lg">Leaderboard</h3>
      <div className="space-y-2">
        {sorted.map((entry, i) => {
          const isMe = entry.playerId === highlightId
          const color = getPlayerColorByIndex(entry.colorIndex ?? i)
          const posChange = posChanges.get(entry.playerId) ?? 0
          const visible = visibleIds.has(entry.playerId)

          return (
            <div
              key={entry.playerId}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-500 ${
                visible ? 'animate-lb-slide' : 'opacity-0'
              } ${
                isMe
                  ? `bg-purple-900/40 border-purple-500/60`
                  : `bg-slate-700/50 border-slate-600/40`
              }`}
              style={{ borderLeftColor: color.dot, borderLeftWidth: '3px' }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg w-6 text-center shrink-0">
                  {isLeader(entry.playerId) && i === 0 ? '👑' : (medals[i] ?? `${i + 1}.`)}
                </span>
                <span className={`font-bold ${isMe ? 'text-purple-200' : 'text-white'}`}>
                  {entry.playerName}
                  {isMe && <span className="text-purple-400 text-xs ml-1">(you)</span>}
                </span>
                {posChange !== 0 && (
                  <span className={`text-xs font-bold ${posChange > 0 ? 'animate-pos-up' : 'animate-pos-down'}`}>
                    {posChange > 0 ? `↑${posChange}` : `↓${Math.abs(posChange)}`}
                  </span>
                )}
              </div>
              <span className={`font-black text-lg tabular-nums ${isMe ? 'text-yellow-300' : 'text-yellow-400'}`}>
                {entry.totalPoints}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
