'use client'

/**
 * Social Mirror Logo — Eye with a person silhouette in the pupil.
 * "See yourself through their eyes."
 */

interface SocialMirrorLogoProps {
  size?: number
  className?: string
}

export default function SocialMirrorLogo({ size = 40, className = '' }: SocialMirrorLogoProps) {
  const scale = size / 44
  return (
    <svg
      width={size}
      height={size * (32 / 44)}
      viewBox="0 0 44 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Social Mirror"
    >
      <defs>
        <linearGradient id="sm-eye-grad" x1="0" y1="0" x2="44" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF4D6A" />
          <stop offset="100%" stopColor="#FFD166" />
        </linearGradient>
      </defs>

      {/* Eye outline */}
      <path
        d="M2 16 C2 16 10 4 22 4 C34 4 42 16 42 16 C42 16 34 28 22 28 C10 28 2 16 2 16 Z"
        fill="none"
        stroke="url(#sm-eye-grad)"
        strokeWidth="2"
      />

      {/* Iris */}
      <circle cx="22" cy="16" r="8" fill="url(#sm-eye-grad)" opacity="0.15" />
      <circle cx="22" cy="16" r="5" fill="url(#sm-eye-grad)" opacity="0.3" />

      {/* Person silhouette in the pupil */}
      <circle cx="22" cy="13" r="2.5" fill="white" opacity="0.8" />
      <ellipse cx="22" cy="20" rx="3" ry="2" fill="white" opacity="0.6" />
    </svg>
  )
}
