'use client'

import type { PlayerPortrait } from '@/lib/mirrorEngine'

interface PortraitCardProps {
  portrait: PlayerPortrait
  animDelay?: number
}

/**
 * PortraitCard — Full personality reveal for one player.
 * Everything visible by default. No collapsed sections.
 */
export default function PortraitCard({ portrait, animDelay = 0 }: PortraitCardProps) {
  const {
    playerName, role, traits, jopiMap, hiddenStrengths, masks,
    challengeCard, reflectionPrompt, headline, selfAwarenessScore,
  } = portrait

  return (
    <div
      className="w-full max-w-md mx-auto rounded-3xl overflow-hidden transition-all duration-700"
      style={{
        background: '#FFFFFF',
        border: '1px solid #EEEBE6',
        animationDelay: `${animDelay}ms`,
      }}
    >
      {/* Gradient top bar */}
      <div className="h-1" style={{ background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C, #FFD166)' }} />

      <div className="p-6">
        {/* Header: name + role */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-2xl font-black" style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}>
              {playerName}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-lg">{role.emoji}</span>
              <span className="text-sm font-bold" style={{ color: '#FF4D6A' }}>{role.name}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black" style={{ color: '#1A1A1A' }}>{selfAwarenessScore}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#999' }}>Self-awareness</div>
          </div>
        </div>

        {/* Role description */}
        <p className="text-xs mb-4" style={{ color: '#888' }}>{role.description}</p>

        {/* Headline */}
        <p className="text-sm font-semibold mb-5 leading-relaxed" style={{ color: '#444' }}>
          {headline}
        </p>

        {/* Trait bars */}
        <div className="space-y-3 mb-5">
          {traits.map((t) => {
            const selfPct = ((t.selfScore - 1) / 6) * 100
            const groupPct = ((t.groupAvg - 1) / 6) * 100
            const absGap = Math.abs(t.gap)
            const gapColor = absGap < 0.8 ? '#999' : t.gap > 0 ? '#00B894' : '#FF4D6A'
            const quadrant = jopiMap.find((j) => j.dimension === t.dimension)?.quadrant ?? 'arena'
            // Plain English labels instead of Johari jargon
            const quadrantLabel = quadrant === 'arena' ? 'In Sync' : quadrant === 'blind_spot' ? 'Hidden Strength' : 'Your Mask'

            return (
              <div key={t.dimension}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#999' }}>
                    {DIMENSION_LABELS[t.dimension]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${gapColor}12`, color: gapColor }}>
                      {quadrantLabel}
                    </span>
                    <span className="text-xs font-black" style={{ color: gapColor, fontFamily: 'monospace' }}>
                      {t.gap > 0 ? '+' : ''}{t.gap.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-12 text-right font-medium" style={{ color: '#BBB' }}>You</span>
                    <div className="flex-1 h-4 rounded-md overflow-hidden" style={{ background: '#F3F1ED' }}>
                      <div className="h-full rounded-md transition-all duration-700"
                        style={{ width: `${Math.max(selfPct, 5)}%`, background: '#D0CCC5' }} />
                    </div>
                    <span className="text-xs font-bold w-8 text-right" style={{ color: '#999', fontFamily: 'monospace' }}>
                      {t.selfScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-12 text-right font-medium" style={{ color: '#FF4D6A' }}>Friends</span>
                    <div className="flex-1 h-4 rounded-md overflow-hidden" style={{ background: '#F3F1ED' }}>
                      <div className="h-full rounded-md transition-all duration-700"
                        style={{
                          width: `${Math.max(groupPct, 5)}%`,
                          background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C)',
                        }} />
                    </div>
                    <span className="text-xs font-bold w-8 text-right" style={{ color: '#FF4D6A', fontFamily: 'monospace' }}>
                      {t.groupAvg.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Hidden Strengths — plain English */}
        {hiddenStrengths.length > 0 && (
          <div className="mb-4 p-4 rounded-2xl" style={{ background: '#F0FDF9', border: '1px solid #D1FAE5' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#00B894' }}>
              Hidden Strengths
            </div>
            <div className="text-[10px] mb-2" style={{ color: '#66CDAA' }}>
              Your friends rated these higher than you rated yourself. They see something you're missing.
            </div>
            {hiddenStrengths.map((hs, i) => (
              <p key={i} className="text-sm leading-relaxed mb-2 last:mb-0" style={{ color: '#444' }}>
                {hs.insight}
              </p>
            ))}
          </div>
        )}

        {/* Masks — plain English */}
        {masks.length > 0 && (
          <div className="mb-4 p-4 rounded-2xl" style={{ background: '#FFF5F5', border: '1px solid #FED7D7' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#FF4D6A' }}>
              Your Mask
            </div>
            <div className="text-[10px] mb-2" style={{ color: '#FF9999' }}>
              You rated these higher than your friends did. The version you project vs. what they see.
            </div>
            {masks.map((m, i) => (
              <p key={i} className="text-sm leading-relaxed mb-2 last:mb-0" style={{ color: '#444' }}>
                {m.insight}
              </p>
            ))}
          </div>
        )}

        {/* Challenge Card — ALWAYS visible */}
        <div className="mb-4 p-4 rounded-2xl" style={{ background: '#1A1A1A' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: '#FFD166' }}>
            🎯 Your Challenge This Week
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#E5E5E5' }}>
            {challengeCard.challenge}
          </p>
        </div>

        {/* Reflection Prompt — ALWAYS visible */}
        <div className="p-4 rounded-2xl" style={{ background: '#F8F7F4', border: '1px solid #EEEBE6' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#888' }}>
            💭 One Question to Sit With
          </div>
          <p className="text-sm leading-relaxed italic" style={{ color: '#555' }}>
            "{reflectionPrompt.question}"
          </p>
        </div>
      </div>
    </div>
  )
}

const DIMENSION_LABELS: Record<string, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  stability: 'Emotional Stability',
}
