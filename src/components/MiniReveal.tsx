'use client'

import { useEffect, useState } from 'react'
import { soundGapReveal } from '@/lib/sounds'

interface MiniRevealProps {
  subjectName: string
  questionText: string
  selfScore: number
  groupAvg: number
  gap: number
  /** auto-advance to next round after this many ms (0 = manual) */
  autoAdvanceMs?: number
  onComplete?: () => void
}

/**
 * MiniReveal — The dramatic per-round gap reveal.
 * Shows self-score vs group average with animated bars and gap classification.
 */
export default function MiniReveal({
  subjectName,
  questionText,
  selfScore,
  groupAvg,
  gap,
  autoAdvanceMs = 0,
  onComplete,
}: MiniRevealProps) {
  const [phase, setPhase] = useState<'self' | 'group' | 'gap'>('self')
  const absGap = Math.abs(gap)
  const gapColor = absGap < 0.8 ? '#999' : gap > 0 ? '#00B894' : '#FF4D6A'
  const gapLabel = absGap < 0.8 ? 'Aligned' : gap > 0 ? 'Blind Spot' : 'Mask'
  const gapSign = gap > 0 ? '+' : ''

  // Staggered reveal: self → group → gap
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('group'), 800)
    const t2 = setTimeout(() => { setPhase('gap'); soundGapReveal() }, 1600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Auto-advance
  useEffect(() => {
    if (autoAdvanceMs > 0 && phase === 'gap' && onComplete) {
      const t = setTimeout(onComplete, autoAdvanceMs)
      return () => clearTimeout(t)
    }
  }, [phase, autoAdvanceMs, onComplete])

  const selfPercent = ((selfScore - 1) / 6) * 100
  const groupPercent = ((groupAvg - 1) / 6) * 100

  return (
    <div className="w-full max-w-md mx-auto text-center">
      {/* Subject name */}
      <div className="mb-2">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{ background: 'rgba(255,77,106,0.1)', color: '#FF4D6A' }}>
          {subjectName}&#39;s Mirror
        </span>
      </div>

      {/* Question */}
      <div className="text-sm font-medium mb-6" style={{ color: '#888' }}>
        {questionText}
      </div>

      {/* Score bars */}
      <div className="space-y-4 mb-6">
        {/* Self score */}
        <div className={`transition-all duration-500 ${phase === 'self' || phase === 'group' || phase === 'gap' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: '#999' }}>SELF</span>
            <span className="text-sm font-black" style={{ color: '#999', fontFamily: 'monospace' }}>
              {selfScore.toFixed(1)}
            </span>
          </div>
          <div className="w-full h-8 rounded-lg overflow-hidden" style={{ background: '#F3F1ED' }}>
            <div
              className="h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-700 ease-out"
              style={{
                width: `${selfPercent}%`,
                background: '#D0CCC5',
                minWidth: '2rem',
              }}
            />
          </div>
        </div>

        {/* Group score */}
        <div className={`transition-all duration-500 ${phase === 'group' || phase === 'gap' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: '#FF4D6A' }}>FRIENDS</span>
            <span className="text-sm font-black" style={{ color: '#FF4D6A', fontFamily: 'monospace' }}>
              {groupAvg.toFixed(1)}
            </span>
          </div>
          <div className="w-full h-8 rounded-lg overflow-hidden" style={{ background: '#F3F1ED' }}>
            <div
              className="h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-700 ease-out"
              style={{
                width: `${groupPercent}%`,
                background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C)',
                minWidth: '2rem',
              }}
            />
          </div>
        </div>
      </div>

      {/* Gap reveal */}
      <div className={`transition-all duration-500 ${phase === 'gap' ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
        <div className="rounded-2xl p-5 border-2 text-center"
          style={{ borderColor: gapColor, background: `${gapColor}08` }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: gapColor }}>
            {gapLabel}
          </div>
          <div className="text-4xl font-black mb-1" style={{ color: gapColor, fontFamily: 'monospace' }}>
            {gapSign}{gap.toFixed(1)}
          </div>
          <div className="text-xs" style={{ color: '#888' }}>
            {absGap < 0.8
              ? `${subjectName} sees this clearly. Friends agree.`
              : gap > 0
                ? `Friends see more ${getTraitWord(questionText)} than ${subjectName} does.`
                : `${subjectName} rates higher than friends see.`
            }
          </div>
        </div>
      </div>
    </div>
  )
}

function getTraitWord(question: string): string {
  const q = question.toLowerCase()
  if (q.includes('adventurous') || q.includes('creative') || q.includes('curious') || q.includes('open') || q.includes('weird option')) return 'openness'
  if (q.includes('organized') || q.includes('reliable') || q.includes('plan ahead') || q.includes('punctual') || q.includes('disciplined')) return 'reliability'
  if (q.includes('light up') || q.includes('energized') || q.includes('conversation') || q.includes('loud') || q.includes('center of attention')) return 'social energy'
  if (q.includes('go along') || q.includes('empathetic') || q.includes('conflict') || q.includes('generous') || q.includes('trusting')) return 'empathy'
  if (q.includes('chill') || q.includes('overthink') || q.includes('bounce back') || q.includes('frustrated') || q.includes('worry')) return 'calmness'
  return 'this quality'
}
