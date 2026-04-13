'use client'

import type { CompatibilityPair } from '@/lib/mirrorEngine'

interface CompatibilityCardProps {
  pairs: CompatibilityPair[]
  /** Show top N most compatible + 1 least compatible */
  topN?: number
}

/**
 * CompatibilityCard — Pairwise friendship insights.
 * Shows alignment %, strongest bond, biggest difference, and friendship fuel.
 */
export default function CompatibilityCard({ pairs, topN = 3 }: CompatibilityCardProps) {
  if (pairs.length === 0) return null

  const topPairs = pairs.slice(0, topN)
  const leastPair = pairs[pairs.length - 1]
  const showLeast = leastPair && !topPairs.includes(leastPair) && leastPair.alignment < 70

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-xs font-bold uppercase tracking-wider text-center mb-4"
        style={{ color: '#999' }}>
        Compatibility Map
      </div>

      <div className="space-y-3">
        {topPairs.map((pair, i) => (
          <PairCard key={i} pair={pair} rank={i + 1} type="top" />
        ))}

        {showLeast && (
          <>
            <div className="text-xs font-bold uppercase tracking-wider text-center my-3"
              style={{ color: '#CCC' }}>
              Most Different
            </div>
            <PairCard pair={leastPair} type="contrast" />
          </>
        )}
      </div>
    </div>
  )
}

function PairCard({ pair, rank, type }: { pair: CompatibilityPair; rank?: number; type: 'top' | 'contrast' }) {
  const barColor = type === 'top'
    ? 'linear-gradient(90deg, #FF4D6A, #FF8A5C)'
    : '#D0CCC5'
  const accentColor = type === 'top' ? '#FF4D6A' : '#999'

  return (
    <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #EEEBE6' }}>
      {/* Names + alignment */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {rank && (
            <span className="text-xs font-black w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: accentColor, color: 'white' }}>
              {rank}
            </span>
          )}
          <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>
            {pair.player1} & {pair.player2}
          </span>
        </div>
        <span className="text-sm font-black" style={{ color: accentColor, fontFamily: 'monospace' }}>
          {pair.alignment}%
        </span>
      </div>

      {/* Alignment bar */}
      <div className="w-full h-2 rounded-full mb-3" style={{ background: '#F3F1ED' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pair.alignment}%`, background: barColor }} />
      </div>

      {/* Bond + difference */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <span className="text-xs mt-0.5">🤝</span>
          <span className="text-xs leading-relaxed" style={{ color: '#555' }}>{pair.strongestBond}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs mt-0.5">⚡</span>
          <span className="text-xs leading-relaxed" style={{ color: '#555' }}>{pair.biggestDifference}</span>
        </div>
      </div>

      {/* Friendship fuel */}
      <div className="mt-3 p-2.5 rounded-xl text-center" style={{ background: '#F8F7F4' }}>
        <p className="text-xs font-medium italic" style={{ color: '#666' }}>
          "{pair.friendshipFuel}"
        </p>
      </div>
    </div>
  )
}
