'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiBlastProps {
  trigger: boolean
}

export default function ConfettiBlast({ trigger }: ConfettiBlastProps) {
  useEffect(() => {
    if (!trigger) return

    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#a855f7', '#ec4899', '#facc15', '#22d3ee'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#a855f7', '#ec4899', '#facc15', '#22d3ee'],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [trigger])

  return null
}
