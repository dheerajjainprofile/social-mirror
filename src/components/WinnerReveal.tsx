'use client'

import { useEffect, useRef, useState } from 'react'

interface WinnerRevealProps {
  winnerNames: string[]
  visible: boolean
  onDone: () => void
}

export default function WinnerReveal({ winnerNames, visible, onDone }: WinnerRevealProps) {
  const [mounted, setMounted] = useState(false)
  // Ref pattern: capture the latest onDone so scheduled setTimeouts fire the current
  // callback, not a stale closure from when the effect ran. Guards against the parent
  // passing a new handler while the reveal animation is still in progress.
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    if (!visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(false)
      return
    }
    const t1 = setTimeout(() => setMounted(true), 50)
    const t2 = setTimeout(() => {
      setMounted(false)
      setTimeout(() => onDoneRef.current(), 600)
    }, 4500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [visible])

  if (!visible && !mounted) return null

  const isTie = winnerNames.length > 1
  const names = winnerNames.join(' & ')

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[60] transition-transform duration-500 ease-out ${
        mounted ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto max-w-2xl px-4 pb-0">
        <div className="bg-gradient-to-br from-yellow-950 via-slate-900 to-slate-900 border-2 border-t-4 border-yellow-400 rounded-t-3xl p-6 text-center shadow-2xl shadow-yellow-900/60">
          <div className="text-6xl mb-3">
            {isTie ? '🥇🥇' : '🥇'}
          </div>
          <div className="text-white font-black text-3xl leading-tight mb-1 tracking-tight">
            {names}
          </div>
          <div className="text-yellow-300 font-bold text-xl">
            {isTie ? 'TIED for the win!' : 'wins this round!'}
          </div>
        </div>
      </div>
    </div>
  )
}
