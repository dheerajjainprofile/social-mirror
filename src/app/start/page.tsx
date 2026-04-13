'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import HunchLogo from '@/components/HunchLogo'

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
        if (packId) localStorage.setItem('gtg_last_pack_id', packId)
        if (data.player.player_token) {
          localStorage.setItem('gtg_player_token', data.player.player_token)
        }
      }

      navigated = true
      router.push(`/room/${data.room_code}/organizer`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      if (!navigated) setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh bg-slate-950 p-4 md:p-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 md:mb-8">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors text-2xl shrink-0">
            ←
          </Link>
          <HunchLogo size={40} />
          <div>
            <h1 className="text-2xl font-black text-white">Host a Game</h1>
            <p className="text-slate-400 text-sm">You&apos;ll be the organizer</p>
          </div>
        </div>

        {/* Name */}
        <div className="mb-4 md:mb-6">
          <label className="block text-slate-300 font-semibold mb-2 text-sm uppercase tracking-wider">
            Your Name
          </label>
          <input
            type="text"
            value={organizerName}
            onChange={(e) => setOrganizerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={30}
            autoComplete="off"
            className="w-full bg-slate-800 border-2 border-slate-600 focus:border-purple-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-lg font-semibold focus:outline-none transition-colors"
          />
        </div>

        {/* Preset selection — segmented control makes mutual exclusivity clear */}
        <div className="mb-4 md:mb-6">
          <label className="block text-slate-300 font-semibold mb-3 text-sm uppercase tracking-wider">
            How do you want to play?
          </label>

          {/* Tab bar — segmented control restored from ab869aa.
              Works reliably on iPhone Safari ONLY because next.config.ts has
              allowedDevOrigins set (Next.js 16 requirement for LAN dev access).
              Without that config, React doesn't hydrate on LAN-IP requests and no
              button pattern fixes it. Do NOT add onTouchEnd+preventDefault here —
              it blocks iOS click synthesis and solves nothing. */}
          <div className="flex rounded-2xl bg-slate-900 border border-slate-700 p-1 gap-1 mb-4">
            <button
              type="button"
              onClick={() => setPreset('party')}
              style={{ touchAction: 'manipulation' }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm cursor-pointer transition-colors ${
                preset === 'party'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_24px_rgba(236,72,153,0.55)] ring-1 ring-pink-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>⚡</span> Quick Start
            </button>
            <button
              type="button"
              onClick={() => setPreset('custom')}
              style={{ touchAction: 'manipulation' }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm cursor-pointer transition-colors ${
                preset === 'custom'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-[0_0_24px_rgba(34,211,238,0.5)] ring-1 ring-cyan-300/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>⚙️</span> Custom
            </button>
          </div>

          {/* Panel under tabs */}
          <div className="space-y-3">
            {/* Quick Start panel */}
            {preset === 'party' && (
              <>
                {packs.length > 0 && (
                  <div className="px-1">
                    <PackPicker
                      packs={packs}
                      selectedIds={selectedPackIds}
                      onChange={setSelectedPackIds}
                    />
                  </div>
                )}
              </>
            )}

            {/* Custom panel */}
            {preset === 'custom' && (
              <div className="space-y-4 p-4 bg-slate-800/50 border border-slate-700 rounded-2xl">
                {/* I'll play too — shown first in custom settings */}
                <button
                  type="button"
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => setOrganizerPlays((v) => !v)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer text-left ${
                    organizerPlays
                      ? 'border-purple-500 bg-purple-900/30'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  <div className={`relative w-10 h-5 rounded-full shrink-0 ${organizerPlays ? 'bg-purple-600' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow ${organizerPlays ? 'left-5' : 'left-0.5'}`} />
                  </div>
                  <div>
                    <span className="text-white font-bold text-sm">I&apos;ll play too</span>
                    <p className="text-slate-400 text-xs">Join in and guess along with everyone</p>
                  </div>
                </button>

                {packs.length > 0 && (
                  <PackPicker
                    packs={packs}
                    selectedIds={selectedPackIds}
                    onChange={setSelectedPackIds}
                  />
                )}

                {/* Scoring Mode */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-2 text-sm">Scoring Mode</label>
                  <div className="flex gap-2">
                    {(['simple', 'rich'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        style={{ touchAction: 'manipulation' }}
                        onClick={() => setScoringMode(mode)}
                        className={`flex-1 py-2 px-3 rounded-xl border-2 font-bold text-xs cursor-pointer ${
                          scoringMode === mode
                            ? 'border-purple-500 bg-purple-900/40 text-purple-200'
                            : 'border-slate-600 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {mode === 'simple' ? '🏆 Simple (1pt)' : '🥇 Rich (3/2/1)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reveal Mode */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-2 text-sm">Reveal Mode</label>
                  <div className="flex gap-2">
                    {(['organizer', 'self'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        style={{ touchAction: 'manipulation' }}
                        onClick={() => setRevealMode(mode)}
                        className={`flex-1 py-2 px-3 rounded-xl border-2 font-bold text-xs cursor-pointer ${
                          revealMode === mode
                            ? 'border-pink-500 bg-pink-900/40 text-pink-200'
                            : 'border-slate-600 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {mode === 'organizer' ? '🎮 Organizer' : '⚡ Auto'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2">
                  {[
                    { label: 'Show Reasoning', value: showReasoning, setter: setShowReasoning },
                    { label: 'Hot/Cold Hints', value: hotColdEnabled, setter: setHotColdEnabled },
                  ].map(({ label, value, setter }) => (
                    <div key={label} className="flex items-center justify-between py-1">
                      <span className="text-slate-300 text-sm">{label}</span>
                      <button
                        type="button"
                        style={{ touchAction: 'manipulation' }}
                        onClick={() => setter(!value)}
                        className={`relative w-10 h-5 rounded-full cursor-pointer ${
                          value ? 'bg-purple-600' : 'bg-slate-600'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow ${
                            value ? 'left-5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Timer */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-2 text-sm">
                    Timer: {timerSeconds}s
                  </label>
                  <input
                    type="range"
                    min={15}
                    max={180}
                    step={15}
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-xl px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || !preset || !organizerName.trim()}
          style={{ touchAction: 'manipulation' }}
          className={`w-full py-4 text-white font-black text-lg rounded-2xl cursor-pointer transition-all ${
            loading || !preset || !organizerName.trim()
              ? 'bg-slate-600 opacity-50'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-[0_0_32px_rgba(139,92,246,0.45)] hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {loading ? 'Creating Room...' : 'Create Room 🚀'}
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
