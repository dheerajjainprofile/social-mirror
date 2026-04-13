'use client'

import { useEffect, useState } from 'react'
import { calculateHotCold, hotColdColor, hotColdLabel } from '@/lib/utils'

export interface RevealCardData {
  id: string
  playerId?: string
  playerName: string
  answer: number | null
  reasoning?: string | null
  passed?: boolean
  autoPassed?: boolean
  isTarget?: boolean
}

interface RevealCardProps {
  card: RevealCardData
  visible: boolean
  targetAnswer?: number | null
  showHotCold?: boolean
  winnerIds?: string[]
}

export default function RevealCard({
  card,
  visible,
  targetAnswer,
  showHotCold,
  winnerIds,
}: RevealCardProps) {
  const isWinner = !card.isTarget && !!winnerIds?.length && !!card.playerId && winnerIds.includes(card.playerId)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setFlipped(true), 100)
      return () => clearTimeout(t)
    } else {
      setFlipped(false)
    }
  }, [visible])

  const hotCold =
    showHotCold &&
    !card.isTarget &&
    !card.passed &&
    card.answer !== null &&
    targetAnswer !== null &&
    targetAnswer !== undefined
      ? calculateHotCold(card.answer!, targetAnswer)
      : null

  return (
    <div
      className={`relative w-full transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div
        className={`rounded-2xl border-2 p-3 md:p-4 transition-all duration-500 ${
          card.isTarget
            ? 'border-yellow-400 bg-gradient-to-br from-yellow-950/60 to-slate-800 shadow-yellow-500/20 shadow-lg'
            : isWinner
            ? 'border-emerald-400 bg-gradient-to-br from-emerald-950/60 to-slate-800 shadow-emerald-500/20 shadow-lg'
            : 'border-slate-600 bg-slate-800'
        }`}
      >
        {/* Header: role label + player name + hot/cold -- single compact row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                card.isTarget ? 'text-yellow-400' : isWinner ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {card.isTarget ? '\ud83c\udfaf' : isWinner ? '\ud83c\udfc6' : ''}
            </span>
            <span
              className={`font-bold text-sm truncate ${
                card.isTarget ? 'text-yellow-200' : isWinner ? 'text-emerald-200' : 'text-white'
              }`}
            >
              {card.playerName}
            </span>
          </div>
          {hotCold && (
            <span className={`text-xs font-bold shrink-0 ${hotColdColor(hotCold)}`}>
              {hotColdLabel(hotCold)}
            </span>
          )}
        </div>

        {/* Answer + reasoning in a row */}
        <div
          className={`transition-all duration-300 ${
            flipped ? 'opacity-100' : 'opacity-0 blur-sm'
          }`}
        >
          {card.passed ? (
            <div className={`text-lg font-bold italic ${card.autoPassed ? 'text-slate-500' : 'text-slate-400'}`}>
              {card.autoPassed ? "Didn\u2019t answer" : 'Passed'}
            </div>
          ) : (
            <div className="flex items-baseline gap-3">
              <div
                className={`text-3xl font-black shrink-0 ${
                  card.isTarget ? 'text-yellow-300' : isWinner ? 'text-emerald-300' : 'text-white'
                }`}
              >
                {card.answer !== null ? card.answer : '\u2014'}
              </div>
              {card.reasoning && (
                <div className="text-slate-400 text-xs italic leading-snug min-w-0 border-l border-slate-700 pl-3">
                  &ldquo;{card.reasoning}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
