'use client'

import { useState, useCallback } from 'react'
import { soundRatingSubmit } from '@/lib/sounds'

interface MirrorRatingSliderProps {
  question: string
  subjectName: string
  anchorLow: string
  anchorHigh: string
  isSelfRating: boolean
  onSubmit: (score: number) => void
  disabled?: boolean
}

/**
 * MirrorRatingSlider — The core rating interaction.
 * A 1-7 scale with fun anchor labels and a gradient fill.
 */
export default function MirrorRatingSlider({
  question,
  subjectName,
  anchorLow,
  anchorHigh,
  isSelfRating,
  onSubmit,
  disabled = false,
}: MirrorRatingSliderProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSelect = useCallback((val: number) => {
    if (disabled || submitted) return
    setSelected(val)
  }, [disabled, submitted])

  const handleSubmit = useCallback(() => {
    if (selected === null || submitted || disabled) return
    setSubmitted(true)
    soundRatingSubmit()
    onSubmit(selected)
  }, [selected, submitted, disabled, onSubmit])

  const fillPercent = selected ? ((selected - 1) / 6) * 100 : 0

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Label */}
      <div className="text-center mb-2">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{
            background: isSelfRating ? 'rgba(255,77,106,0.1)' : 'rgba(255,138,92,0.1)',
            color: isSelfRating ? '#FF4D6A' : '#FF8A5C',
          }}>
          {isSelfRating ? 'Rate yourself' : `Rate ${subjectName}`}
        </span>
      </div>

      {/* Question */}
      <h2 className="text-xl md:text-2xl font-black text-center mb-6 leading-snug"
        style={{ color: '#1A1A1A', letterSpacing: '-0.02em' }}>
        {question}
      </h2>

      {/* Score buttons */}
      <div className="flex justify-between gap-1.5 mb-3">
        {[1, 2, 3, 4, 5, 6, 7].map((val) => {
          const isSelected = selected === val
          const isBelow = selected !== null && val <= selected
          return (
            <button
              key={val}
              onClick={() => handleSelect(val)}
              disabled={disabled || submitted}
              className="flex-1 aspect-square rounded-xl flex items-center justify-center text-lg font-black transition-all duration-200"
              style={{
                background: isSelected
                  ? 'linear-gradient(135deg, #FF4D6A, #FF8A5C)'
                  : isBelow
                    ? 'rgba(255,77,106,0.15)'
                    : '#F3F1ED',
                color: isSelected ? 'white' : isBelow ? '#FF4D6A' : '#999',
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                boxShadow: isSelected ? '0 4px 16px rgba(255,77,106,0.3)' : 'none',
              }}
            >
              {val}
            </button>
          )
        })}
      </div>

      {/* Anchor labels */}
      <div className="flex justify-between text-xs font-medium mb-6 px-1"
        style={{ color: '#999' }}>
        <span className="max-w-[45%]">{anchorLow}</span>
        <span className="max-w-[45%] text-right">{anchorHigh}</span>
      </div>

      {/* Gradient progress bar */}
      <div className="w-full h-2 rounded-full mb-6" style={{ background: '#F3F1ED' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${fillPercent}%`,
            background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C, #FFD166)',
          }}
        />
      </div>

      {/* Submit button */}
      {selected !== null && !submitted && (
        <button
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-full font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
            boxShadow: '0 4px 20px rgba(255,77,106,0.25)',
          }}
        >
          Lock it in
        </button>
      )}

      {/* Submitted state */}
      {submitted && (
        <div className="text-center py-3.5 rounded-full font-bold"
          style={{ background: '#F3F1ED', color: '#00B894' }}>
          ✓ Submitted
        </div>
      )}
    </div>
  )
}
