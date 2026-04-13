'use client'

/**
 * Social Mirror Logo — Two overlapping face silhouettes forming a mirror reflection.
 * Gradient stroke, clean and professional.
 */

interface SocialMirrorLogoProps {
  size?: number
  className?: string
}

export default function SocialMirrorLogo({ size = 40, className = '' }: SocialMirrorLogoProps) {
  const s = size
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Social Mirror"
    >
      <defs>
        <linearGradient id="sm-g1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF4D6A" />
          <stop offset="100%" stopColor="#FF8A5C" />
        </linearGradient>
        <linearGradient id="sm-g2" x1="48" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFD166" />
          <stop offset="100%" stopColor="#FF8A5C" />
        </linearGradient>
      </defs>

      {/* Left face profile — looking right */}
      <path
        d="M10 38 C10 38 8 30 10 24 C12 18 14 14 18 12 C22 10 24 12 24 16 C24 20 22 24 20 28 C18 32 16 36 14 38"
        stroke="url(#sm-g1)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />

      {/* Right face profile — looking left (mirror reflection) */}
      <path
        d="M38 38 C38 38 40 30 38 24 C36 18 34 14 30 12 C26 10 24 12 24 16 C24 20 26 24 28 28 C30 32 32 36 34 38"
        stroke="url(#sm-g2)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />

      {/* Center mirror line — vertical axis of reflection */}
      <line
        x1="24" y1="8" x2="24" y2="42"
        stroke="#FF8A5C"
        strokeWidth="1"
        strokeDasharray="2 3"
        opacity="0.4"
      />

      {/* Top dot — like a sparkle on the mirror */}
      <circle cx="24" cy="6" r="2" fill="url(#sm-g1)" />
    </svg>
  )
}
