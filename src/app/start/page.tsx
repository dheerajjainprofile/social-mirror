'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'

interface Pack {
  id: string
  name: string
  energy_type: string
  description: string
}

function PackPicker({
  packs,
  selectedIds,
  onChange,
}: {
  packs: Pack[]
  selectedIds: Set<string>
  onChange: (ids: Set<string>) => void
}) {
  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const allOff = selectedIds.size === 0
  const mixed = selectedIds.size > 1

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-slate-300 font-semibold text-sm">Question Packs</label>
        {mixed && (
          <span className="text-xs text-purple-400 font-semibold">Mixed mode</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 md:gap-2">
        <button
          type="button"
          onClick={() => onChange(new Set())}
          style={{ touchAction: 'manipulation' }}
          className={`py-2 px-2.5 md:px-3 rounded-xl border-2 text-[11px] md:text-xs font-bold cursor-pointer truncate ${
            allOff
              ? 'border-purple-500 bg-purple-900/40 text-purple-200'
              : 'border-slate-600 bg-slate-800 text-slate-400'
          }`}
        >
          🎲 All Mixed
        </button>
        {packs.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => toggle(pack.id)}
            style={{ touchAction: 'manipulation' }}
            className={`py-2 px-2.5 md:px-3 rounded-xl border-2 text-[11px] md:text-xs font-bold cursor-pointer text-left truncate ${
              selectedIds.has(pack.id)
                ? 'border-purple-500 bg-purple-900/40 text-purple-200'
                : 'border-slate-600 bg-slate-800 text-slate-400'
            }`}
          >
            {selectedIds.has(pack.id) && <span className="mr-1">✓</span>}
            {pack.name}
          </button>
        ))}
      </div>
      {mixed && (
        <p className="text-slate-500 text-xs mt-1.5">
          Multiple packs selected — questions will be drawn from all of them.
        </p>
      )}
    </div>
  )
}

function StartPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [organizerName, setOrganizerName] = useState('')
  const [preset, setPreset] = useState<'party' | 'custom' | null>(null)
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Pack selection — shared between both modes
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set())

  // Custom mode state
  const [organizerPlays, setOrganizerPlays] = useState(true)
  const [scoringMode, setScoringMode] = useState<'simple' | 'rich'>('simple')
  const [revealMode, setRevealMode] = useState<'self' | 'organizer'>('organizer')
  const [showReasoning, setShowReasoning] = useState(true)
  const [hotColdEnabled, setHotColdEnabled] = useState(true)
  const [timerSeconds, setTimerSeconds] = useState(60)

  // Deep link params
  const deepLinkPack = searchParams.get('pack')
  const deepLinkPreset = searchParams.get('preset')
  const acquisitionSource = searchParams.get('source') ?? 'direct'

  useEffect(() => {
    fetch('/api/packs')
      .then((r) => r.json())
      .then((d) => setPacks(d.packs ?? []))
      .catch(() => {})

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gtg_name')
      if (saved) setOrganizerName(saved)
    }

    if (deepLinkPreset === 'party') setPreset('party')
  }, [deepLinkPack, deepLinkPreset])

  // Pre-select pack from deep link, last used, or default to Office — Safe
  useEffect(() => {
    if (deepLinkPack) {
      setSelectedPackIds(new Set([deepLinkPack]))
    } else if (typeof window !== 'undefined') {
      const lastPack = localStorage.getItem('gtg_last_pack_id')
      if (lastPack) {
        setSelectedPackIds(new Set([lastPack]))
      } else if (packs.length > 0) {
        const officeSafe = packs.find((p) => p.energy_type === 'office_safe')
        if (officeSafe) setSelectedPackIds(new Set([officeSafe.id]))
      }
    }
  }, [deepLinkPack, packs])

  // Derive single pack_id for API: exactly 1 selected → use it; else null (Mixed)
  const resolvedPackId = (): string | null => {
    if (selectedPackIds.size === 1) return Array.from(selectedPackIds)[0]
    return null
  }

  const handleCreate = async () => {
    if (!organizerName.trim()) { setError('Please enter your name'); return }
    if (!preset) { setError('Please choose how you want to play'); return }

    setLoading(true)
    setError('')
    let navigated = false

    try {
      const packId = resolvedPackId()
      const body: Record<string, unknown> = {
        organizer_name: organizerName,
        preset,
        acquisition_source: acquisitionSource,
        pack_id: packId,
        organizer_plays: preset === 'party' ? true : organizerPlays,
      }

      if (preset === 'custom') {
        body.scoring_mode = scoringMode
        body.reveal_mode = revealMode
        body.show_reasoning = showReasoning
        body.hot_cold_enabled = hotColdEnabled
        body.timer_seconds = timerSeconds
      }

      const res = await fetch('/api/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create game'); return }

      if (typeof window !== 'undefined') {
        localStorage.setItem('gtg_name', organizerName)
        localStorage.setItem('gtg_player_id', data.player.id)
        localStorage.setItem('gtg_session_id', data.session.id)
        // Store token for mirror page auth
        sessionStorage.setItem(`sm-token-${data.room_code}`, data.player.id)
        if (packId) localStorage.setItem('gtg_last_pack_id', packId)
        if (data.player.player_token) {
          localStorage.setItem('gtg_player_token', data.player.player_token)
        }
      }

      navigated = true
      router.push(`/mirror/${data.room_code}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      if (!navigated) setLoading(false)
    }
  }

  // Force party preset for Social Mirror (no custom settings needed)
  useEffect(() => { setPreset('party') }, [])

  return (
    <main className="min-h-dvh p-4 md:p-6 flex flex-col items-center" style={{ background: '#FAF8F5' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <Link href="/" className="text-2xl shrink-0" style={{ color: '#CCC' }}>
            ←
          </Link>
          <SocialMirrorLogo size={40} />
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>Start a Session</h1>
            <p className="text-sm" style={{ color: '#888' }}>You&apos;ll be the organizer</p>
          </div>
        </div>

        {/* Name */}
        <div className="mb-5 md:mb-6">
          <label className="block font-semibold mb-2 text-xs uppercase tracking-wider" style={{ color: '#999' }}>
            Your Name
          </label>
          <input
            type="text"
            value={organizerName}
            onChange={(e) => setOrganizerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={30}
            autoComplete="off"
            className="w-full rounded-xl px-4 py-3.5 text-lg font-semibold outline-none transition-all"
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #EEEBE6',
              color: '#1A1A1A',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#FF4D6A')}
            onBlur={(e) => (e.target.style.borderColor = '#EEEBE6')}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        {/* Quick info */}
        <div className="mb-5 flex items-center justify-center gap-4 py-3 px-4 rounded-xl text-xs"
          style={{ background: 'rgba(255,77,106,0.04)', color: '#888' }}>
          <span>2-8 players</span>
          <span style={{ color: '#DDD' }}>·</span>
          <span>~20 min</span>
          <span style={{ color: '#DDD' }}>·</span>
          <span>Personality portraits</span>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: '#FFF5F5', border: '1px solid #FED7D7', color: '#FF4D6A' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || !organizerName.trim()}
          style={{
            touchAction: 'manipulation',
            background: loading || !organizerName.trim() ? '#D0CCC5' : 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
            boxShadow: loading || !organizerName.trim() ? 'none' : '0 4px 24px rgba(255,77,106,0.25)',
          }}
          className="w-full py-4 text-white font-black text-lg rounded-full cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Creating Room...' : 'Create Room'}
        </button>
      </div>
    </main>
  )
}

export default function StartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white animate-pulse">Loading...</div>
      </div>
    }>
      <StartPageInner />
    </Suspense>
  )
}
