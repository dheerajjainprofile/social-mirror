'use client'

import type { BiggestSurprise } from '@/lib/mirrorEngine'

interface BiggestSurpriseCardProps {
  surprise: BiggestSurprise
}

/**
 * BiggestSurpriseCard — The single most dramatic gap in the session.
 * Full-width card with large numbers, gradient border, and Johari explanation.
 */
export default function BiggestSurpriseCard({ surprise }: BiggestSurpriseCardProps) {
  const { playerName, selfScore, groupAvg, gap, insight, whatItMeans, dimension } = surprise
  const absGap = Math.abs(gap)

  if (absGap < 0.3) {
    return (
      <div className="w-full max-w-md mx-auto rounded-3xl p-6 text-center"
        style={{ background: '#F8F7F4', border: '1px solid #EEEBE6' }}>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#999' }}>
          Biggest Surprise
        </div>
        <div className="text-lg font-bold" style={{ color: '#444' }}>
          No big surprises tonight.
        </div>
        <div className="text-sm mt-1" style={{ color: '#888' }}>
          This group knows each other well. That's rare and worth celebrating.
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: '2px solid #FF4D6A',
        boxShadow: '0 0 60px rgba(255,77,106,0.1)',
      }}>

      {/* Gradient top */}
      <div className="py-4 px-6 text-center"
        style={{ background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)' }}>
        <div className="text-xs font-bold uppercase tracking-wider text-white/80 mb-1">
          ✨ Biggest Surprise of the Night ✨
        </div>
        <div className="text-sm font-medium text-white/70">
          {playerName} on {FRIENDLY_DIMS[dimension] || dimension}
        </div>
      </div>

      <div className="p-6">
        {/* Score comparison */}
        <div className="flex items-center justify-center gap-6 mb-5">
          <div className="text-center">
            <div className="text-4xl font-black" style={{ color: '#CCC', fontFamily: 'monospace' }}>
              {selfScore.toFixed(1)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: '#BBB' }}>
              Self
            </div>
          </div>
          <div className="text-2xl" style={{ color: '#FF4D6A' }}>→</div>
          <div className="text-center">
            <div className="text-4xl font-black" style={{
              fontFamily: 'monospace',
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {groupAvg.toFixed(1)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: '#FF4D6A' }}>
              Friends
            </div>
          </div>
        </div>

        {/* Insight */}
        <p className="text-sm font-semibold text-center leading-relaxed mb-4" style={{ color: '#333' }}>
          {insight}
        </p>

        {/* What it means (Johari) */}
        <div className="p-3 rounded-xl text-center" style={{ background: '#F8F7F4' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#999' }}>
            What this means
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#666' }}>
            {whatItMeans}
          </p>
        </div>
      </div>
    </div>
  )
}

const FRIENDLY_DIMS: Record<string, string> = {
  openness: 'openness',
  conscientiousness: 'reliability',
  extraversion: 'social energy',
  agreeableness: 'empathy',
  stability: 'calmness',
}
