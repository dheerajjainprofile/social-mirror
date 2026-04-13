'use client'

/**
 * Social Mirror Logo — Gradient mirror icon.
 * An oval mirror shape with a gradient border and a subtle reflection line.
 */

interface SocialMirrorLogoProps {
  size?: number
  className?: string
}

export default function SocialMirrorLogo({ size = 40, className = '' }: SocialMirrorLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Social Mirror"
    >
      <defs>
        <linearGradient id="sm-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF4D6A" />
          <stop offset="50%" stopColor="#FF8A5C" />
          <stop offset="100%" stopColor="#FFD166" />
        </linearGradient>
        <linearGradient id="sm-shine" x1="14" y1="8" x2="28" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="50%" stopColor="white" stopOpacity="0.1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Mirror shape — rounded oval */}
      <ellipse cx="24" cy="24" rx="18" ry="21" fill="#1A1A1A" />
      <ellipse cx="24" cy="24" rx="18" ry="21"
        stroke="url(#sm-grad)" strokeWidth="2.5" fill="none" />

      {/* Inner mirror surface */}
      <ellipse cx="24" cy="24" rx="14.5" ry="17.5" fill="#2A2A35" />

      {/* Reflection shine */}
      <ellipse cx="19" cy="18" rx="7" ry="10"
        fill="url(#sm-shine)" transform="rotate(-15 19 18)" />

      {/* Small sparkle dot */}
      <circle cx="17" cy="14" r="1.5" fill="white" opacity="0.8" />
    </svg>
  )
}
