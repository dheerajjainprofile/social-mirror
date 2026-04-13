'use client'

import { useEffect, useState, useCallback, use, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'
import MirrorRatingSlider from '@/components/MirrorRatingSlider'
import MiniReveal from '@/components/MiniReveal'
import MirrorRevealSequence from '@/components/MirrorRevealSequence'
import type { SessionReport } from '@/lib/mirrorEngine'
import { encode as encodeQR } from 'uqr'

// ─── Types ──────────────────────────────────────────────────────

interface Session {
  id: string
  room_code: string
  organizer_name: string
  status: string
  timer_seconds: number
}

interface Player {
  id: string
  name: string
  is_organizer: boolean
  session_id: string
}

interface MirrorRound {
  id: string
  session_id: string
  round_number: number
  question_text: string
  target_player_id: string
  status: string // waiting | self-rating | group-rating | mini-reveal | done
  question_id: string
}

// ─── Component ──────────────────────────────────────────────────

export default function MirrorGamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)

  // Core state
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [me, setMe] = useState<Player | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [currentRound, setCurrentRound] = useState<MirrorRound | null>(null)
  const [allRounds, setAllRounds] = useState<MirrorRound[]>([])
  const [report, setReport] = useState<SessionReport | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [starting, setStarting] = useState(false)
  const [synthesizing, setSynthesizing] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  // Mini-reveal data for current round
  const [miniRevealData, setMiniRevealData] = useState<{
    selfScore: number; groupAvg: number; gap: number
  } | null>(null)

  // Realtime reconnect
  const [lastVisible, setLastVisible] = useState(0)
  const refreshRef = useRef<(() => void) | null>(null)

  // ─── Load session ───────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: sess } = await supabase
        .from('sessions').select('*').eq('room_code', code).single()
      if (!sess) { setError('Room not found'); setLoading(false); return }
      setSession(sess)

      const { data: plist } = await supabase
        .from('players').select('*').eq('session_id', sess.id).eq('removed', false)
      setPlayers(plist ?? [])

      // Check if we're already a player (localStorage token)
      const token = localStorage.getItem(`sm-token-${code}`)
      if (token) {
        const existing = (plist ?? []).find((p) => p.id === token)
        if (existing) {
          setMe(existing)
          setIsOrganizer(existing.is_organizer)
        }
      }

      // Load rounds
      const { data: rounds } = await supabase
        .from('rounds').select('*').eq('session_id', sess.id)
        .order('round_number', { ascending: true })
      if (rounds && rounds.length > 0) {
        setAllRounds(rounds)
        const active = rounds.find((r) =>
          r.status === 'self-rating' || r.status === 'group-rating' || r.status === 'mini-reveal'
        ) || rounds[rounds.length - 1]
        setCurrentRound(active)
      }

      // Load report if session is in revealing/ended
      if (sess.status === 'revealing' || sess.status === 'ended') {
        const { data: portraits } = await supabase
          .from('mirror_portraits').select('*').eq('session_id', sess.id)
        const { data: sessData } = await supabase
          .from('sessions').select('group_dynamics_result').eq('id', sess.id).single()
        if (portraits && portraits.length > 0 && sessData?.group_dynamics_result) {
          // Reconstruct report from stored data
          const gd = sessData.group_dynamics_result as Record<string, unknown>
          setReport({
            portraits: portraits.map((p) => {
              const parsed = typeof p.portrait_text === 'string' ? JSON.parse(p.portrait_text) : p.portrait_text
              const traitScores = p.trait_scores as Record<string, { self: number; group: number; gap: number; raterCount?: number; consensus?: number }>
              return {
                playerName: (plist ?? []).find((pl) => pl.id === p.player_id)?.name ?? 'Player',
                playerId: p.player_id,
                traits: Object.entries(traitScores).map(([dim, v]) => ({
                  dimension: dim as 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'stability',
                  selfScore: v.self,
                  groupAvg: v.group,
                  gap: v.gap,
                  raterCount: v.raterCount ?? 0,
                  consensus: v.consensus ?? 0,
                })),
                jopiMap: Object.entries(traitScores).map(([dim, v]) => ({
                  dimension: dim as 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'stability',
                  quadrant: (Math.abs(v.gap) <= 0.8 ? 'arena' : v.gap > 0.8 ? 'blind_spot' : 'mask') as 'arena' | 'blind_spot' | 'mask',
                  gap: v.gap,
                })),
                role: { name: p.role || 'The Original', emoji: ROLE_EMOJI[p.role as string] || '✨', description: '' },
                hiddenStrengths: parsed?.hiddenStrengths ?? [],
                masks: parsed?.masks ?? [],
                challengeCard: parsed?.challengeCard ?? { dimension: 'openness', direction: 'blind_spot', challenge: '' },
                reflectionPrompt: parsed?.reflectionPrompt ?? { dimension: 'openness', question: '' },
                headline: parsed?.headline ?? '',
                selfAwarenessScore: parsed?.selfAwarenessScore ?? 50,
              }
            }),
            compatibility: (gd.compatibility ?? []) as SessionReport['compatibility'],
            biggestSurprise: (gd.biggestSurprise ?? {}) as SessionReport['biggestSurprise'],
            hotTake: (gd.hotTake ?? {}) as SessionReport['hotTake'],
            groupRoles: (gd.groupRoles ?? []) as SessionReport['groupRoles'],
          })
        }
      }

      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // ─── Realtime ─────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!session?.id) return
    const { data: sess } = await supabase.from('sessions').select('*').eq('id', session.id).single()
    if (sess) setSession(sess)

    const { data: plist } = await supabase
      .from('players').select('*').eq('session_id', session.id).eq('removed', false)
    if (plist) setPlayers(plist)

    const { data: rounds } = await supabase
      .from('rounds').select('*').eq('session_id', session.id)
      .order('round_number', { ascending: true })
    if (rounds && rounds.length > 0) {
      setAllRounds(rounds)
      const active = rounds.find((r) =>
        r.status === 'self-rating' || r.status === 'group-rating' || r.status === 'mini-reveal'
      ) || rounds[rounds.length - 1]
      setCurrentRound(active)
    }
  }, [session?.id])

  useEffect(() => { refreshRef.current = refresh }, [refresh])

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') setLastVisible(Date.now())
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  useEffect(() => {
    if (!session?.id) return
    const channel = supabase
      .channel(`mirror-${session.id}-${lastVisible}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` }, () => refreshRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` }, () => refreshRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `session_id=eq.${session.id}` }, () => refreshRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mirror_ratings' }, () => refreshRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mirror_portraits' }, () => refreshRef.current?.())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session?.id, lastVisible])

  // ─── Actions ──────────────────────────────────────────────────

  const joinRoom = async () => {
    if (!session?.id || !nameInput.trim()) return
    setJoining(true)
    try {
      const res = await fetch('/api/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: code, player_name: nameInput.trim() }),
      })
      const data = await res.json()
      if (data.player) {
        setMe(data.player)
        setIsOrganizer(data.player.is_organizer)
        localStorage.setItem(`sm-token-${code}`, data.player.id)
        await refresh()
      }
    } catch (e) {
      setError('Failed to join')
    }
    setJoining(false)
  }

  const startMirrorSession = async () => {
    if (!session?.id || !me?.id) return
    setStarting(true)
    try {
      const res = await fetch('/api/mirror/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, organizer_player_id: me.id }),
      })
      const data = await res.json()
      if (data.ok) await refresh()
      else setError(data.error || 'Failed to start')
    } catch (e) {
      setError('Failed to start session')
    }
    setStarting(false)
  }

  const submitRating = async (score: number) => {
    if (!session?.id || !me?.id || !currentRound) return
    const isSelfRating = currentRound.target_player_id === me.id
    await fetch('/api/mirror/submit-rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: currentRound.round_number,
        subject_player_id: currentRound.target_player_id,
        rater_player_id: isSelfRating ? null : me.id,
        question_id: currentRound.question_id,
        score,
      }),
    })
  }

  const advanceRound = async () => {
    if (!session?.id || !me?.id || !currentRound || advancing) return
    setAdvancing(true)
    try {
      const res = await fetch('/api/mirror/advance-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_id: currentRound.id,
          organizer_player_id: me.id,
        }),
      })
      const data = await res.json()
      if (data.self_score != null && data.group_avg != null) {
        setMiniRevealData({ selfScore: data.self_score, groupAvg: data.group_avg, gap: data.gap })
      }
      if (data.session_complete) {
        // Trigger synthesis
        setSynthesizing(true)
        const synthRes = await fetch('/api/mirror/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id, organizer_player_id: me.id }),
        })
        const synthData = await synthRes.json()
        if (synthData.report) setReport(synthData.report)
        setSynthesizing(false)
      }
      await refresh()
    } catch (e) {
      setError('Failed to advance')
    }
    setAdvancing(false)
  }

  // ─── Derived state ────────────────────────────────────────────

  const nonOrgPlayers = players.filter((p) => !p.is_organizer)
  const isMyTurn = currentRound?.target_player_id === me?.id
  const subjectName = players.find((p) => p.id === currentRound?.target_player_id)?.name ?? 'Someone'
  const totalRounds = allRounds.length
  const currentRoundNum = currentRound?.round_number ?? 0

  const joinQR = session ? (() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return encodeQR(`${origin}/mirror/${code}`, { ecc: 'M' })
  })() : null

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <div className="text-center">
          <SocialMirrorLogo size={48} />
          <div className="mt-3 text-sm" style={{ color: '#888' }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: '#FAF8F5' }}>
        <div className="text-center">
          <div className="text-2xl mb-2">😬</div>
          <div className="text-sm font-bold" style={{ color: '#FF4D6A' }}>{error}</div>
        </div>
      </div>
    )
  }

  // ── Reveal phase ────────────────────────────────────────────
  if (report && (session?.status === 'revealing' || session?.status === 'ended')) {
    return <MirrorRevealSequence report={report} organizerPaced={isOrganizer} />
  }

  // ── Synthesizing ────────────────────────────────────────────
  if (synthesizing || session?.status === 'revealing') {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <div className="text-center max-w-xs">
          <div className="text-4xl mb-4 animate-pulse">🪞</div>
          <div className="text-lg font-black mb-2" style={{ color: '#1A1A1A' }}>Mirror is forming...</div>
          <div className="text-sm" style={{ color: '#888' }}>Analyzing {nonOrgPlayers.length} personalities</div>
          <div className="w-48 h-1.5 rounded-full mx-auto mt-4 overflow-hidden" style={{ background: '#EEEBE6' }}>
            <div className="h-full rounded-full animate-pulse"
              style={{ width: '60%', background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C, #FFD166)' }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Not joined yet ──────────────────────────────────────────
  if (!me) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: '#FAF8F5' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <SocialMirrorLogo size={48} />
            <h1 className="text-2xl font-black mt-3" style={{ color: '#1A1A1A' }}>Join Session</h1>
            <p className="text-sm mt-1" style={{ color: '#888' }}>Room: {code.toUpperCase()}</p>
          </div>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            className="w-full py-3.5 px-4 rounded-xl text-base font-medium outline-none transition-all"
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #EEEBE6',
              color: '#1A1A1A',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#FF4D6A')}
            onBlur={(e) => (e.target.style.borderColor = '#EEEBE6')}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          />
          <button
            onClick={joinRoom}
            disabled={!nameInput.trim() || joining}
            className="w-full mt-3 py-3.5 rounded-full font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)' }}
          >
            {joining ? 'Joining...' : 'Join'}
          </button>
        </div>
      </div>
    )
  }

  // ── Lobby ───────────────────────────────────────────────────
  if (session?.status === 'lobby') {
    return (
      <div className="min-h-dvh p-4" style={{ background: '#FAF8F5' }}>
        <div className="max-w-sm mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <SocialMirrorLogo size={36} />
            <div>
              <div className="text-sm font-black" style={{ color: '#1A1A1A' }}>Social Mirror</div>
              <div className="text-xs" style={{ color: '#888' }}>Room: {code.toUpperCase()}</div>
            </div>
          </div>

          {/* QR Code */}
          {joinQR && isOrganizer && (
            <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: '#FFFFFF', border: '1px solid #EEEBE6' }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#999' }}>
                Scan to join
              </div>
              <svg viewBox={`0 0 ${joinQR.size} ${joinQR.size}`} className="w-32 h-32 mx-auto">
                {joinQR.data.map((row, y) =>
                  row.map((cell, x) =>
                    cell ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#1A1A1A" /> : null
                  )
                )}
              </svg>
            </div>
          )}

          {/* Players */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#FFFFFF', border: '1px solid #EEEBE6' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#999' }}>
              Players ({nonOrgPlayers.length})
              {nonOrgPlayers.length < 3 && (
                <span className="ml-2 normal-case" style={{ color: '#FF4D6A' }}>Need {3 - nonOrgPlayers.length} more</span>
              )}
            </div>
            <div className="space-y-2">
              {nonOrgPlayers.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)' }}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                    {p.name} {p.id === me.id ? '(you)' : ''}
                  </span>
                </div>
              ))}
              {nonOrgPlayers.length === 0 && (
                <div className="text-sm py-2" style={{ color: '#CCC' }}>Waiting for players...</div>
              )}
            </div>
          </div>

          {/* Start button (organizer only) */}
          {isOrganizer && (
            <button
              onClick={startMirrorSession}
              disabled={nonOrgPlayers.length < 3 || starting}
              className="w-full py-4 rounded-full font-black text-white text-base transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
                boxShadow: '0 4px 24px rgba(255,77,106,0.25)',
              }}
            >
              {starting ? 'Starting...' : `Start Mirror Session (${nonOrgPlayers.length} players)`}
            </button>
          )}

          {/* Non-organizer waiting */}
          {!isOrganizer && (
            <div className="text-center py-4 rounded-2xl" style={{ background: '#F8F7F4' }}>
              <div className="text-sm font-medium" style={{ color: '#888' }}>
                Waiting for {session.organizer_name} to start...
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Active game ─────────────────────────────────────────────
  if (session?.status === 'active' && currentRound) {
    const roundPhase = currentRound.status

    return (
      <div className="min-h-dvh p-4" style={{ background: '#FAF8F5' }}>
        <div className="max-w-md mx-auto">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <SocialMirrorLogo size={28} />
              <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>Round {currentRoundNum}/{totalRounds}</span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: roundPhase === 'self-rating' ? 'rgba(255,77,106,0.1)' : 'rgba(255,138,92,0.1)',
                color: roundPhase === 'self-rating' ? '#FF4D6A' : '#FF8A5C',
              }}>
              {roundPhase === 'self-rating' ? 'Self-Rating' : roundPhase === 'group-rating' ? 'Group Rating' : roundPhase === 'mini-reveal' ? 'Reveal' : 'Done'}
            </span>
          </div>

          {/* Self-rating phase */}
          {roundPhase === 'self-rating' && isMyTurn && (
            <MirrorRatingSlider
              question={currentRound.question_text}
              subjectName={me.name}
              anchorLow="1 — Not at all"
              anchorHigh="7 — Extremely"
              isSelfRating={true}
              onSubmit={submitRating}
            />
          )}

          {roundPhase === 'self-rating' && !isMyTurn && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">🪞</div>
              <div className="text-base font-bold mb-1" style={{ color: '#1A1A1A' }}>
                {subjectName} is rating themselves...
              </div>
              <div className="text-sm" style={{ color: '#888' }}>
                Your turn to rate them is next
              </div>
            </div>
          )}

          {/* Group-rating phase */}
          {roundPhase === 'group-rating' && !isMyTurn && (
            <MirrorRatingSlider
              question={currentRound.question_text}
              subjectName={subjectName}
              anchorLow="1 — Not at all"
              anchorHigh="7 — Extremely"
              isSelfRating={false}
              onSubmit={submitRating}
            />
          )}

          {roundPhase === 'group-rating' && isMyTurn && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">👀</div>
              <div className="text-base font-bold mb-1" style={{ color: '#1A1A1A' }}>
                Your friends are rating you...
              </div>
              <div className="text-sm" style={{ color: '#888' }}>
                {currentRound.question_text}
              </div>
            </div>
          )}

          {/* Mini-reveal phase */}
          {roundPhase === 'mini-reveal' && miniRevealData && (
            <MiniReveal
              subjectName={subjectName}
              questionText={currentRound.question_text}
              selfScore={miniRevealData.selfScore}
              groupAvg={miniRevealData.groupAvg}
              gap={miniRevealData.gap}
            />
          )}

          {roundPhase === 'mini-reveal' && !miniRevealData && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">📊</div>
              <div className="text-base font-bold" style={{ color: '#1A1A1A' }}>
                Revealing the gap...
              </div>
            </div>
          )}

          {/* Round done, waiting for next */}
          {roundPhase === 'done' && (
            <div className="text-center py-12">
              <div className="text-sm" style={{ color: '#888' }}>
                Waiting for next round...
              </div>
            </div>
          )}

          {/* Organizer advance button */}
          {isOrganizer && (roundPhase === 'self-rating' || roundPhase === 'group-rating' || roundPhase === 'mini-reveal') && (
            <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
              <button
                onClick={advanceRound}
                disabled={advancing}
                className="w-full py-3.5 rounded-full font-bold text-white text-sm transition-all"
                style={{
                  background: '#1A1A1A',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}
              >
                {advancing ? 'Advancing...' : roundPhase === 'self-rating' ? 'Start Group Rating →' : roundPhase === 'group-rating' ? 'Reveal Gap →' : 'Next Round →'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Fallback ────────────────────────────────────────────────
  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: '#FAF8F5' }}>
      <div className="text-center">
        <SocialMirrorLogo size={48} />
        <div className="mt-3 text-sm" style={{ color: '#888' }}>Loading session...</div>
      </div>
    </div>
  )
}

const ROLE_EMOJI: Record<string, string> = {
  'The Spark': '⚡',
  'The Glue': '🤝',
  'The Wildcard': '🎲',
  'The Anchor': '⚓',
  'The Rock': '🪨',
  'The Mirror': '🪞',
  'The Explorer': '🧭',
  'The Original': '✨',
}
