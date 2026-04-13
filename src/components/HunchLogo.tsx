'use client'

/**
 * Hunch Logo — C6 variant
 * Rounded square with purple→pink gradient border + subtle glow.
 * Inner "H" lettermark in white.
 * Fully scalable via the `size` prop.
 */

interface HunchLogoProps {
  size?: number
  className?: string
}

export default function HunchLogo({ size = 40, className = '' }: HunchLogoProps) {
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
      aria-label="Hunch"
    >
      <defs>
        {/* Gradient border */}
        <linearGradient id="hunch-border" x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        {/* Subtle glow filter */}
        <filter id="hunch-glow" x="-20%" y="-20%" width="140%" height="140%">
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
        fill="#0f172a"
      />

      {/* Gradient border (drawn on top, inset so it doesn't clip) */}
      <rect
        x={inset}
        y={inset}
        width={size - sw}
        height={size - sw}
        rx={r}
        stroke="url(#hunch-border)"
        strokeWidth={sw}
        filter="url(#hunch-glow)"
      />

      {/* H lettermark */}
      {(() => {
        const lw = size * 0.12   // line thickness of H strokes
        const pad = size * 0.26  // horizontal padding from edge
        const vpad = size * 0.23 // vertical padding from edge
        const mid = size / 2

        return (
          <>
            {/* Left vertical */}
            <rect
              x={pad}
              y={vpad}
              width={lw}
              height={size - vpad * 2}
              rx={lw * 0.4}
              fill="white"
            />
            {/* Right vertical */}
            <rect
              x={size - pad - lw}
              y={vpad}
              width={lw}
              height={size - vpad * 2}
              rx={lw * 0.4}
              fill="white"
            />
            {/* Crossbar */}
            <rect
              x={pad}
              y={mid - lw * 0.5}
              width={size - pad * 2}
              height={lw}
              rx={lw * 0.4}
              fill="white"
            />
          </>
        )
      })()}
    </svg>
  )
}
