'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [roomCode, setRoomCode] = useState(searchParams.get('code') ?? '')
  const [playerName, setPlayerName] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gameEnded, setGameEnded] = useState(false)
  // Re-entry guard: React state updates for setLoading(true) happen after the event loop,
  // so a double-tap on iOS Safari can fire handleSubmit twice before the button disables.
  // The ref flips synchronously and blocks the second invocation immediately.
  const submitInFlightRef = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gtg_name')
      if (saved) setPlayerName(saved)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitInFlightRef.current) return
    if (!roomCode.trim()) {
      setError('Please enter a room code')
      return
    }
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    submitInFlightRef.current = true
    setLoading(true)
    setError('')
    let navigated = false

    try {
      // Send player_token only if it looks like a real UUID — stale/null strings from old sessions
      // cause false 409 "name already taken" errors on Android / multi-session devices
      const rawToken = typeof window !== 'undefined' ? localStorage.getItem('gtg_player_token') : null
      const storedToken = rawToken && /^[0-9a-f-]{36}$/i.test(rawToken) ? rawToken : null

      const res = await fetch('/api/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode.trim().toUpperCase(),
          player_name: playerName.trim(),
          player_token: storedToken ?? undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // 409 = name taken. Safe to auto-redirect ONLY if stored ID exactly matches
        // the server's existingPlayerId — means this device already joined (network drop).
        // nameMatches alone is NOT safe: storedId could be from a different game.
        if (res.status === 409 && data.existingPlayerId && data.roomCode) {
          const storedId = typeof window !== 'undefined' ? localStorage.getItem('gtg_player_id') : null
          if (storedId && storedId === data.existingPlayerId) {
            localStorage.setItem(`sm-token-${data.roomCode}`, data.existingPlayerId)
            navigated = true
            router.push(`/mirror/${data.roomCode}`)
            return
          }
        }
        if (data.redirect) {
          setGameEnded(true)
          return
        }
        setError(data.error ?? 'Failed to join room')
        return
      }

      if (rememberMe && typeof window !== 'undefined') {
        localStorage.setItem('gtg_name', playerName.trim())
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('gtg_player_id', data.player.id)
        localStorage.setItem('gtg_session_id', data.session.id)
        // Only store token if it's a real UUID — never store null/undefined as string
        if (data.player.player_token && /^[0-9a-f-]{36}$/i.test(data.player.player_token)) {
          localStorage.setItem('gtg_player_token', data.player.player_token)
        } else {
          localStorage.removeItem('gtg_player_token')
        }
        if (data.late_join) {
          localStorage.setItem('gtg_late_join', 'true')
        } else {
          localStorage.removeItem('gtg_late_join')
        }
      }

      // Store token for mirror page
      localStorage.setItem(`sm-token-${data.session.room_code}`, data.player.id)
      navigated = true
      router.push(`/mirror/${data.session.room_code}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      if (!navigated) {
        setLoading(false)
        submitInFlightRef.current = false
      }
    }
  }

  if (gameEnded) {
    return (
      <main className="min-h-screen p-6 flex flex-col items-center justify-center" style={{ background: '#FAF8F5' }}>
        <div className="w-full max-w-md text-center space-y-5">
          <div className="text-6xl">🏁</div>
          <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>This session has ended</h1>
          <p style={{ color: '#888' }}>The host has already wrapped up this session.</p>
          <Link
            href="/start"
            className="inline-block w-full py-4 text-white font-black text-lg rounded-full"
            style={{ background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)' }}
          >
            Start a new session →
          </Link>
          <Link href="/join" className="block text-sm" style={{ color: '#999' }}>
            Try a different code
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 flex flex-col items-center" style={{ background: '#FAF8F5' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-2xl" style={{ color: '#CCC' }}>←</Link>
          <SocialMirrorLogo size={36} />
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>Join Session</h1>
            <p className="text-sm" style={{ color: '#888' }}>Enter the room code to play</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Room Code */}
          <div>
            <label className="block font-semibold mb-2 text-xs uppercase tracking-wider" style={{ color: '#999' }}>
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full rounded-xl px-4 py-4 text-3xl font-black text-center tracking-[0.5em] outline-none transition-all uppercase"
              style={{ background: '#FFFFFF', border: '1.5px solid #EEEBE6', color: '#1A1A1A' }}
              onFocus={(e) => (e.target.style.borderColor = '#FF4D6A')}
              onBlur={(e) => (e.target.style.borderColor = '#EEEBE6')}
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>

          {/* Player Name */}
          <div>
            <label className="block font-semibold mb-2 text-xs uppercase tracking-wider" style={{ color: '#999' }}>
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name..."
              maxLength={30}
              autoComplete="off"
              className="w-full rounded-xl px-4 py-3.5 text-lg font-semibold outline-none transition-all"
              style={{ background: '#FFFFFF', border: '1.5px solid #EEEBE6', color: '#1A1A1A' }}
              onFocus={(e) => (e.target.style.borderColor = '#FF4D6A')}
              onBlur={(e) => (e.target.style.borderColor = '#EEEBE6')}
            />
          </div>

          {/* Remember me */}
          <button
            type="button"
            onClick={() => setRememberMe((v) => !v)}
            className="flex items-center gap-3 transition-colors"
            style={{ color: '#666' }}
          >
            <div
              className="w-5 h-5 rounded flex items-center justify-center transition-all"
              style={{
                background: rememberMe ? '#FF4D6A' : '#EEEBE6',
                border: rememberMe ? 'none' : '1.5px solid #D0CCC5',
              }}
            >
              {rememberMe && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            <span className="text-sm">Remember my name</span>
          </button>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FFF5F5', border: '1px solid #FED7D7', color: '#FF4D6A' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 text-white font-black text-lg rounded-full transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
              boxShadow: '0 4px 24px rgba(255,77,106,0.25)',
            }}
          >
            {loading ? 'Joining...' : '🪞 Join Session'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm" style={{ color: '#999' }}>
            Want to host?{' '}
            <Link href="/start" className="font-semibold" style={{ color: '#FF4D6A' }}>
              Create a room
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
