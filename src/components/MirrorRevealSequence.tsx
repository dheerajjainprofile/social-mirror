'use client'

import { useState, useCallback } from 'react'
import type { SessionReport } from '@/lib/mirrorEngine'
import { soundPortraitReveal, soundSurprise, soundHotTake, soundCrowd } from '@/lib/sounds'
import PortraitCard from './PortraitCard'
import BiggestSurpriseCard from './BiggestSurpriseCard'
import HotTakeCard from './HotTakeCard'
import CompatibilityCard from './CompatibilityCard'
import GroupRolesCard from './GroupRolesCard'

interface MirrorRevealSequenceProps {
  report: SessionReport
  /** If true, organizer controls pacing. If false, all revealed at once. */
  organizerPaced?: boolean
  onComplete?: () => void
}

/**
 * MirrorRevealSequence — Orchestrates the full post-game reveal.
 *
 * Order:
 * 1. Each player's portrait (one at a time if organizer-paced)
 * 2. Biggest Surprise card
 * 3. Group Roles
 * 4. Compatibility Map
 * 5. Hot Take (finale)
 */
export default function MirrorRevealSequence({
  report,
  organizerPaced = true,
  onComplete,
}: MirrorRevealSequenceProps) {
  const totalSteps = report.portraits.length + 4 // portraits + surprise + roles + compat + hottake
  const [currentStep, setCurrentStep] = useState(organizerPaced ? 0 : totalSteps)

  const visiblePortraits = organizerPaced
    ? report.portraits.slice(0, currentStep)
    : report.portraits

  const showSurprise = currentStep > report.portraits.length || !organizerPaced
  const showRoles = currentStep > report.portraits.length + 1 || !organizerPaced
  const showCompat = currentStep > report.portraits.length + 2 || !organizerPaced
  const showHotTake = currentStep > report.portraits.length + 3 || !organizerPaced
  const isComplete = currentStep >= totalSteps

  const advance = useCallback(() => {
    const next = currentStep + 1
    setCurrentStep(next)
    // Play sound based on what was just revealed
    if (next <= report.portraits.length) soundPortraitReveal()
    else if (next === report.portraits.length + 1) soundSurprise()
    else if (next === report.portraits.length + 2) soundCrowd()
    else if (next === report.portraits.length + 4) soundHotTake()
    if (next >= totalSteps && onComplete) onComplete()
  }, [currentStep, report.portraits.length, totalSteps, onComplete])

  const stepLabel = () => {
    if (currentStep < report.portraits.length) {
      return `Reveal ${report.portraits[currentStep]?.playerName}'s Portrait`
    }
    if (currentStep === report.portraits.length) return 'Reveal Biggest Surprise'
    if (currentStep === report.portraits.length + 1) return "Reveal Tonight's Cast"
    if (currentStep === report.portraits.length + 2) return 'Reveal Compatibility Map'
    if (currentStep === report.portraits.length + 3) return 'Reveal Hot Take'
    return 'Done'
  }

  return (
    <div className="w-full" style={{ background: '#FAF8F5', minHeight: '100dvh' }}>
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#FF4D6A' }}>
            Mirror Reveal
          </div>
          <div className="text-sm" style={{ color: '#888' }}>
            {currentStep} of {totalSteps} revealed
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full mt-2" style={{ background: '#EEEBE6' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(currentStep / totalSteps) * 100}%`,
                background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C, #FFD166)',
              }} />
          </div>
        </div>

        {/* Portraits */}
        {visiblePortraits.map((p, i) => (
          <PortraitCard key={p.playerId} portrait={p} animDelay={i * 100} />
        ))}

        {/* Biggest Surprise */}
        {showSurprise && (
          <BiggestSurpriseCard surprise={report.biggestSurprise} />
        )}

        {/* Group Roles */}
        {showRoles && (
          <GroupRolesCard roles={report.groupRoles} />
        )}

        {/* Compatibility */}
        {showCompat && (
          <CompatibilityCard pairs={report.compatibility} />
        )}

        {/* Hot Take */}
        {showHotTake && (
          <HotTakeCard hotTake={report.hotTake} />
        )}

        {/* Advance button (organizer only) */}
        {organizerPaced && !isComplete && (
          <div className="sticky bottom-4 pt-2">
            <button
              onClick={advance}
              className="w-full py-4 rounded-full font-black text-white text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
                boxShadow: '0 4px 24px rgba(255,77,106,0.3)',
              }}
            >
              {stepLabel()}
            </button>
          </div>
        )}

        {/* Session complete */}
        {isComplete && (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">🪞</div>
            <div className="text-sm font-bold" style={{ color: '#1A1A1A' }}>
              That's your mirror tonight.
            </div>
            <div className="text-xs mt-1" style={{ color: '#888' }}>
              Play again with different friends. See what changes.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
