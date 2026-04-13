'use client'

import type { GroupHotTake } from '@/lib/mirrorEngine'

interface HotTakeCardProps {
  hotTake: GroupHotTake
}

/**
 * HotTakeCard — The final card of the session.
 * A group-level statistical observation in a bold dark card.
 */
export default function HotTakeCard({ hotTake }: HotTakeCardProps) {
  return (
    <div className="w-full max-w-md mx-auto rounded-3xl p-6 text-center"
      style={{ background: '#1A1A1A' }}>
      <div className="text-3xl mb-3">🔥</div>
      <div className="text-xs font-bold uppercase tracking-wider mb-4"
        style={{ color: '#FF4D6A' }}>
        Group Hot Take
      </div>
      <p className="text-lg font-black leading-snug mb-3"
        style={{ color: '#FAFAFA', letterSpacing: '-0.01em' }}>
        {applyGradient(hotTake.text)}
      </p>
      <div className="text-xs font-medium" style={{ color: '#666' }}>
        {hotTake.stat}
      </div>
      <div className="mt-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#555' }}>
        Social Mirror
      </div>
    </div>
  )
}

/** Wrap numbers in the text with gradient styling */
function applyGradient(text: string): React.ReactNode {
  // Split on numbers like "2.1" or "3"
  const parts = text.split(/(\d+\.?\d*\s*point[s]?)/gi)
  return parts.map((part, i) => {
    if (/\d+\.?\d*\s*point/i.test(part)) {
      return (
        <span key={i} style={{
          background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {part}
        </span>
      )
    }
    return part
  })
}
