'use client'

import { useEffect, useState } from 'react'

interface RoundStartFlashProps {
  roundNumber: number
  trigger: boolean          // flips true to start the animation
  onDone: () => void        // called when animation finishes
}

export default function RoundStartFlash({ roundNumber, trigger, onDone }: RoundStartFlashProps) {
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden')

  useEffect(() => {
    if (!trigger) return
    setPhase('in')
    const t1 = setTimeout(() => setPhase('out'), 900)
    const t2 = setTimeout(() => { setPhase('hidden'); onDone() }, 1250)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  if (phase === 'hidden') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm pointer-events-none">
      <div className={phase === 'in' ? 'animate-round-in' : 'animate-round-out'}>
        <div className="text-center">
          <div className="text-7xl font-black text-white leading-none tracking-tight">
            ROUND {roundNumber}
          </div>
          <div className="text-3xl font-bold text-purple-400 mt-2">
            LET&apos;S GO! 🎯
          </div>
        </div>
      </div>
    </div>
  )
}
