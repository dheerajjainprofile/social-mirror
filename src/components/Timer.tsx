'use client'

import { useEffect, useState, useRef } from 'react'
import { soundTick } from '@/lib/sounds'

interface TimerProps {
  startedAt: string | null
  durationSeconds: number
  onExpire?: () => void
  paused?: boolean
}

// After resume, the Realtime event for session.status='active' may arrive before the
// rounds.started_at update propagates to the client. During that gap the old started_at makes
// elapsed look huge (pause duration is counted), driving remaining to 0 and firing onExpire.
// RESUME_BUFFER_MS keeps the displayed value floored at the frozen value for long enough for
// the started_at correction to arrive, even under slow Realtime propagation or brief network hitches.
const RESUME_BUFFER_MS = 6000

export default function Timer({ startedAt, durationSeconds, onExpire, paused }: TimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds)
  const hasExpiredRef = useRef(false)
  const frozenRemRef = useRef<number>(durationSeconds)
  const mountedRef = useRef(true)
  const resumedAtRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Track when we transition out of paused to apply the resume buffer
  const prevPausedRef = useRef(paused)
  useEffect(() => {
    if (prevPausedRef.current && !paused) {
      resumedAtRef.current = Date.now()
    }
    prevPausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (!startedAt) return

    const tick = () => {
      if (!mountedRef.current) return
      if (paused) {
        setRemaining(frozenRemRef.current)
        return
      }
      const startMs = new Date(startedAt).getTime()
      if (isNaN(startMs)) return
      const elapsed = (Date.now() - startMs) / 1000
      const calculated = Math.max(0, Math.ceil(durationSeconds - elapsed))

      // Apply resume buffer: don't let value drop below frozen during propagation window
      const inBuffer = resumedAtRef.current !== null &&
        (Date.now() - resumedAtRef.current) < RESUME_BUFFER_MS
      const rem = inBuffer ? Math.max(calculated, frozenRemRef.current) : calculated

      frozenRemRef.current = rem
      setRemaining(rem)

      if (rem <= 5 && rem > 0) {
        soundTick()
      }

      if (rem === 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true
        onExpire?.()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt, durationSeconds, onExpire, paused])

  const pct = durationSeconds > 0 ? (remaining / durationSeconds) * 100 : 0
  const isUrgent = remaining <= 10

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`text-5xl font-bold tabular-nums transition-colors ${
          isUrgent ? 'text-red-400 animate-pulse' : 'text-white'
        }`}
      >
        {remaining}
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isUrgent ? 'bg-red-500' : 'bg-purple-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
