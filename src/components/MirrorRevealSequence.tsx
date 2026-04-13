'use client'

import { useState, useEffect, useCallback } from 'react'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type {} from 'react' // keep react import for ViewProfileLink
import type { SessionReport } from '@/lib/mirrorEngine'
import PortraitCard from './PortraitCard'
import BiggestSurpriseCard from './BiggestSurpriseCard'
import HotTakeCard from './HotTakeCard'
import CompatibilityCard from './CompatibilityCard'
import GroupRolesCard from './GroupRolesCard'
import { soundPortraitReveal, soundSurprise, soundHotTake, soundCrowd } from '@/lib/sounds'

interface MirrorRevealSequenceProps {
  report: SessionReport
  onComplete?: () => void
}

/**
 * MirrorRevealSequence — Auto-paced reveal experience.
 *
 * Single "Begin the Reveal" button, then cards auto-play with dramatic timing.
 * Tap anywhere to skip to the next card. Swipe-like feel.
 *
 * Order: portraits (one by one) → biggest surprise → roles → compatibility → hot take
 */
export default function MirrorRevealSequence({
  report,
  onComplete,
}: MirrorRevealSequenceProps) {
  const totalSteps = report.portraits.length + 4
  const [started, setStarted] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [autoPlaying, setAutoPlaying] = useState(false)

  const visiblePortraits = report.portraits.slice(0, Math.min(currentStep, report.portraits.length))
  const showSurprise = currentStep > report.portraits.length
  const showRoles = currentStep > report.portraits.length + 1
  const showCompat = currentStep > report.portraits.length + 2
  const showHotTake = currentStep > report.portraits.length + 3
  const isComplete = currentStep >= totalSteps

  const advance = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1
      // Play sound based on what was just revealed
      if (next <= report.portraits.length) soundPortraitReveal()
      else if (next === report.portraits.length + 1) soundSurprise()
      else if (next === report.portraits.length + 2) soundCrowd()
      else if (next === report.portraits.length + 4) soundHotTake()
      if (next >= totalSteps && onComplete) onComplete()
      return Math.min(next, totalSteps)
    })
  }, [report.portraits.length, totalSteps, onComplete])

  // Auto-play timer: advance every 4 seconds for portraits, 5s for group cards
  useEffect(() => {
    if (!autoPlaying || isComplete) return
    const delay = currentStep < report.portraits.length ? 4000 : 5000
    const timer = setTimeout(advance, delay)
    return () => clearTimeout(timer)
  }, [autoPlaying, currentStep, isComplete, advance, report.portraits.length])

  const beginReveal = () => {
    setStarted(true)
    setAutoPlaying(true)
    advance() // Show first portrait immediately
  }

  // Tap to skip ahead
  const handleTap = () => {
    if (!started) return
    if (isComplete) return
    advance()
  }

  // ── Not started yet ──────────────────────────────────────
  if (!started) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(160deg, #FAF8F5 0%, #FFF5F0 40%, #F5F0FA 100%)' }}>
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🪞</div>
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1A1A1A' }}>
            Your Mirror is Ready
          </h1>
          <p className="text-sm mb-6" style={{ color: '#888' }}>
            {report.portraits.length} personality portraits. Hidden strengths. Challenge cards.
            Tap to skip ahead at any time.
          </p>
          <button
            onClick={beginReveal}
            className="w-full py-4 rounded-full font-black text-white text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
              boxShadow: '0 4px 24px rgba(255,77,106,0.3)',
            }}
          >
            ✨ Begin the Reveal
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full min-h-dvh"
      style={{ background: '#FAF8F5' }}
      onClick={handleTap}
    >
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* Progress bar */}
        <div className="sticky top-0 z-20 pt-2 pb-3" style={{ background: '#FAF8F5' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#FF4D6A' }}>
              Mirror Reveal
            </span>
            <span className="text-xs" style={{ color: '#BBB' }}>
              {currentStep}/{totalSteps} · tap to skip
            </span>
          </div>
          <div className="w-full h-1 rounded-full" style={{ background: '#EEEBE6' }}>
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(currentStep / totalSteps) * 100}%`,
                background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C, #FFD166)',
              }} />
          </div>
        </div>

        {/* Portraits */}
        {visiblePortraits.map((p, i) => (
          <div key={p.playerId} className="animate-fadeInUp" style={{ animationDelay: `${i * 100}ms` }}>
            <PortraitCard portrait={p} />
          </div>
        ))}

        {/* Biggest Surprise */}
        {showSurprise && (
          <div className="animate-fadeInUp">
            <BiggestSurpriseCard surprise={report.biggestSurprise} />
          </div>
        )}

        {/* Group Roles */}
        {showRoles && (
          <div className="animate-fadeInUp">
            <GroupRolesCard roles={report.groupRoles} />
          </div>
        )}

        {/* Compatibility */}
        {showCompat && (
          <div className="animate-fadeInUp">
            <CompatibilityCard pairs={report.compatibility} />
          </div>
        )}

        {/* Hot Take */}
        {showHotTake && (
          <div className="animate-fadeInUp">
            <HotTakeCard hotTake={report.hotTake} />
          </div>
        )}

        {/* Session complete */}
        {isComplete && (
          <div className="text-center py-6 animate-fadeInUp">
            <div className="text-3xl mb-3">🪞</div>
            <div className="text-lg font-black mb-1" style={{ color: '#1A1A1A' }}>
              That's your mirror tonight.
            </div>
            <div className="text-sm mb-4" style={{ color: '#888' }}>
              Play again with different friends. See what changes.
            </div>
            <div className="flex flex-col gap-2 items-center">
              <a
                href="/"
                className="inline-block px-8 py-3 rounded-full font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)' }}
              >
                Play Again
              </a>
              <ViewProfileLink />
            </div>
          </div>
        )}
      </div>

      {/* CSS for fadeInUp animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out both;
        }
      `}</style>
    </div>
  )
}

/** Small helper: shows "View your Mirror Profile" link if profile exists */
function ViewProfileLink() {
  const [profileId, setProfileId] = useState<string | null>(null)
  useEffect(() => {
    import('@/lib/identity').then(({ getMyProfileId }) => {
      getMyProfileId().then(setProfileId)
    })
  }, [])
  if (!profileId) return null
  return (
    <a
      href={`/profile/${profileId}`}
      className="text-xs font-semibold underline underline-offset-2"
      style={{ color: '#FF4D6A' }}
    >
      View your Mirror Profile →
    </a>
  )
}
