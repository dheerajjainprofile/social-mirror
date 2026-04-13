'use client'

/**
 * Social Mirror Logo
 * Rounded square with coral→orange→gold gradient border + subtle glow.
 * Inner "SM" lettermark in white.
 * Fully scalable via the `size` prop.
 */

interface SocialMirrorLogoProps {
  size?: number
  className?: string
}

export default function SocialMirrorLogo({ size = 40, className = '' }: SocialMirrorLogoProps) {
  const r = size * 0.22   // corner radius
  const sw = size * 0.055 // stroke width
  const inset = sw / 2    // keep stroke inside viewBox

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Social Mirror"
    >
      <defs>
        <linearGradient id="sm-border" x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF4D6A" />
          <stop offset="50%" stopColor="#FF8A5C" />
          <stop offset="100%" stopColor="#FFD166" />
        </linearGradient>
        <filter id="sm-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.05} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background fill */}
      <rect
        x={inset}
        y={inset}
        width={size - sw}
        height={size - sw}
        rx={r}
        fill="#1A1A1A"
      />

      {/* Gradient border */}
      <rect
        x={inset}
        y={inset}
        width={size - sw}
        height={size - sw}
        rx={r}
        stroke="url(#sm-border)"
        strokeWidth={sw}
        filter="url(#sm-glow)"
      />

      {/* SM lettermark */}
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        fontFamily="system-ui, sans-serif"
        fontWeight="800"
        fontSize={size * 0.35}
        letterSpacing={-size * 0.02}
      >
        SM
      </text>
    </svg>
  )
}
