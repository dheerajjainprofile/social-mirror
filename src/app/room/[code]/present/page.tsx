'use client'

import { useEffect, useState, useCallback, use, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { encode as encodeQR } from 'uqr'
import RevealCard, { RevealCardData } from '@/components/RevealCard'
import ConfettiBlast from '@/components/ConfettiBlast'
import Timer from '@/components/Timer'
import NumberLine, { NumberLinePoint } from '@/components/NumberLine'
import RoundRanking from '@/components/RoundRanking'
import WinnerReveal from '@/components/WinnerReveal'

interface Session {
  id: string
  room_code: string
  organizer_name: string
  scoring_mode: string
  hot_cold_enabled: boolean
  timer_seconds: number
  status: string
  organizer_plays?: boolean
}

interface Player {
  id: string
  session_id: string
  name: string
  is_organizer: boolean
}

interface Round {
  id: string
  session_id: string
  question_text: string
  target_player_id: string
  round_number: number
  status: string
  winner_player_id: string | null
  started_at?: string
}

interface PlayerScore {
  playerId: string
  playerName: string
  totalPoints: number
}

export default function PresentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)

  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const playersRef = useRef<Player[]>([])
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [scores, setScores] = useState<PlayerScore[]>([])
  const [submittedCount, setSubmittedCount] = useState(0)
  const [totalEligible, setTotalEligible] = useState(0)
  const [revealCards, setRevealCards] = useState<RevealCardData[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [targetAnswer, setTargetAnswer] = useState<number | null>(null)
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showWinnerReveal, setShowWinnerReveal] = useState(false)
  const [revealWinnerNames, setRevealWinnerNames] = useState<string[]>([])
  const [numberLinePoints, setNumberLinePoints] = useState<NumberLinePoint[]>([])
  const [joinUrl, setJoinUrl] = useState('')
  const refreshPresentRef = useRef<(() => Promise<void>) | null>(null)

  const loadScores = useCallback(async (sessionId: string, playerList: Player[], orgPlays?: boolean) => {
    const { data } = await supabase.from('scores').select('*').eq('session_id', sessionId)
    if (!data) return
    const totals: Record<string, number> = {}
    for (const s of data) totals[s.player_id] = (totals[s.player_id] ?? 0) + s.points
    const lb = playerList
      .filter((p) => !p.is_organizer || orgPlays)
      .map((p) => ({ playerId: p.id, playerName: p.name, totalPoints: totals[p.id] ?? 0 }))
    setScores((prev) => {
      const same = prev.length === lb.length &&
        prev.every((s, i) => s.playerId === lb[i].playerId && s.totalPoints === lb[i].totalPoints)
      return same ? prev : lb
    })
  }, [])

  const buildRevealCards = useCallback(async (round: Round, playerList: Player[]): Promise<{ cards: RevealCardData[], targetAns: number | null }> => {
    const { data: guesses } = await supabase
      .from('guesses').select('*').eq('round_id', round.id).order('submitted_at', { ascending: true })
    const { data: ta } = await supabase
      .from('target_answers').select('*').eq('round_id', round.id).single()

    const cards: RevealCardData[] = []
    for (const g of guesses ?? []) {
      const p = playerList.find((pl) => pl.id === g.player_id)
      if (p) cards.push({ id: g.id, playerId: g.player_id, playerName: p.name, answer: g.passed ? null : Number(g.answer), reasoning: g.reasoning, passed: g.passed, autoPassed: g.auto_passed === true, isTarget: false })
    }
    let targetAns: number | null = null
    if (ta) {
      targetAns = Number(ta.answer)
      const tp = playerList.find((p) => p.id === round.target_player_id)
      cards.push({ id: `target-${ta.id}`, playerId: round.target_player_id, playerName: tp?.name ?? 'Target', answer: targetAns, isTarget: true })
      setTargetAnswer(targetAns)

      const nlPoints: NumberLinePoint[] = []
      for (const g of guesses ?? []) {
        if (!g.passed && g.answer !== null) {
          const p = playerList.find((pl) => pl.id === g.player_id)
          if (p) nlPoints.push({ playerName: p.name, answer: Number(g.answer), isTarget: false })
        }
      }
      nlPoints.push({ playerName: tp?.name ?? 'Target', answer: targetAns, isTarget: true })
      setNumberLinePoints(nlPoints)
    }
    setRevealCards(cards)
    setRevealedCount(0)
    return { cards, targetAns }
  }, [])

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join?code=${code}`)
  }, [code])

  useEffect(() => {
    const init = async () => {
      const { data: sess } = await supabase.from('sessions').select('*').eq('room_code', code).single()
      if (!sess) return
      setSession(sess)

      const { data: pData } = await supabase.from('players').select('*').eq('session_id', sess.id)
      const plist = pData ?? []
      setPlayers(plist)
      playersRef.current = plist

      const { data: rounds } = await supabase
        .from('rounds').select('*').eq('session_id', sess.id)
        .order('round_number', { ascending: false }).limit(1)

      if (rounds && rounds.length > 0) {
        const round = rounds[0]
        setCurrentRound(round)

        const eligible = plist.filter((p) => p.id !== round.target_player_id && !p.is_organizer)
        setTotalEligible(eligible.length)

        const { data: guesses } = await supabase.from('guesses').select('player_id').eq('round_id', round.id)
        setSubmittedCount((guesses ?? []).length)

        if (round.status === 'reveal' || round.status === 'done') {
          await buildRevealCards(round, plist)
        }
        if (round.winner_player_id) {
          const wp = plist.find((p) => p.id === round.winner_player_id)
          if (wp) setWinnerPlayer(wp)
        }
      }

      await loadScores(sess.id, plist, sess.organizer_plays)
    }
    init()
  }, [code, buildRevealCards, loadScores])

  useEffect(() => {
    if (!session) return

    let channel = supabase
      .channel(`present-${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` },
        (payload) => setSession((prev) => prev ? { ...prev, ...(payload.new as Session) } : null)
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' },
        (payload) => {
          const newPlayer = payload.new as Player
          if (newPlayer.session_id !== session.id) return
          setPlayers((prev) => {
            if (prev.find((p) => p.id === newPlayer.id)) return prev
            const updated = [...prev, newPlayer]
            playersRef.current = updated
            // Recompute eligible count for current round
            setCurrentRound((round) => {
              if (round && round.status === 'guessing') {
                const eligible = updated.filter((p) => p.id !== round.target_player_id && !p.is_organizer)
                setTotalEligible(eligible.length)
              }
              return round
            })
            return updated
          })
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `session_id=eq.${session.id}` },
        async (payload) => {
          const round = payload.new as Round
          setCurrentRound(round)
          setRevealCards([])
          setRevealedCount(0)
          setTargetAnswer(null)
          setWinnerPlayer(null)
          setNumberLinePoints([])
          setShowWinnerReveal(false)
          setRevealWinnerNames([])
          const eligible = playersRef.current.filter((p) => p.id !== round.target_player_id && !p.is_organizer)
          setTotalEligible(eligible.length)
          setSubmittedCount(0)
          if (round.status === 'reveal' || round.status === 'done') {
            const { cards: builtCards, targetAns: builtTarget } = await buildRevealCards(round, playersRef.current)
            if (round.winner_player_id && builtTarget !== null) {
              const wp = playersRef.current.find((p) => p.id === round.winner_player_id)
              if (wp) {
                setWinnerPlayer(wp)
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 4000)
                const guessCards = builtCards.filter((c) => !c.isTarget && !c.passed && c.answer !== null)
                if (guessCards.length > 0) {
                  const minDist = Math.min(...guessCards.map((c) => Math.abs(c.answer! - builtTarget)))
                  const names = guessCards.filter((c) => Math.abs(c.answer! - builtTarget) === minDist).map((c) => c.playerName)
                  setRevealWinnerNames(names)
                  setShowWinnerReveal(true)
                }
              }
            }
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores', filter: `session_id=eq.${session.id}` },
        () => loadScores(session.id, playersRef.current, session.organizer_plays)
      )

    if (currentRound?.id) {
      channel = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guesses', filter: `round_id=eq.${currentRound.id}` },
        () => setSubmittedCount((c) => c + 1)
      )
    }

    channel.subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session, currentRound?.id, buildRevealCards, loadScores])

  // Poll players every 3s while in lobby — realtime INSERT on players table is unreliable
  useEffect(() => {
    if (!session || session.status !== 'lobby') return
    const poll = setInterval(async () => {
      const { data } = await supabase.from('players').select('*').eq('session_id', session.id)
      if (data) {
        setPlayers(data)
        playersRef.current = data
      }
    }, 3000)
    return () => clearInterval(poll)
  }, [session?.id, session?.status])

  // Active-game fallback poll + visibilitychange — the presentation screen can lock/sleep too
  useEffect(() => {
    if (!session?.id || session.status === 'ended') return
    const sessionId = session.id

    const doRefresh = async () => {
      const { data: sess } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      if (!sess) return
      setSession(sess)
      const { data: pData } = await supabase.from('players').select('*').eq('session_id', sessionId)
      const plist = pData ?? []
      playersRef.current = plist
      setPlayers(plist)
      const { data: rounds } = await supabase
        .from('rounds').select('*').eq('session_id', sessionId)
        .order('round_number', { ascending: false }).limit(1)
      if (rounds && rounds.length > 0) {
        const round = rounds[0]
        setCurrentRound((prev) => {
          if (!prev || prev.id !== round.id || prev.status !== round.status) return round
          return prev
        })
        await loadScores(sessionId, plist, session.organizer_plays)
      }
    }
    refreshPresentRef.current = doRefresh

    const poll = setInterval(() => refreshPresentRef.current?.(), session.status === 'lobby' ? 3000 : 3000)
    const onVisible = () => { if (!document.hidden) refreshPresentRef.current?.() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session?.id, session?.status, loadScores])

  // Auto-reveal
  useEffect(() => {
    if (currentRound?.status !== 'reveal' && currentRound?.status !== 'done') return
    if (revealCards.length === 0) return
    if (revealedCount >= revealCards.length) return
    const isLast = revealedCount === revealCards.length - 1
    const delay = isLast ? 2000 : 1500
    const t = setTimeout(() => setRevealedCount((c) => c + 1), delay)
    return () => clearTimeout(t)
  }, [revealedCount, revealCards.length, currentRound?.status])

  const sortedScores = [...scores].sort((a, b) => b.totalPoints - a.totalPoints)

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <ConfettiBlast trigger={showConfetti} />
      <WinnerReveal
        winnerNames={revealWinnerNames}
        visible={showWinnerReveal}
        onDone={() => setShowWinnerReveal(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-slate-400 text-sm uppercase tracking-widest">Room Code</div>
          <div className="text-5xl font-black text-yellow-400 tracking-widest">{code}</div>
        </div>
        <div className="text-right">
          <div className="text-slate-400 text-sm">Social Mirror</div>
          {currentRound && (
            <div className="text-white font-bold text-2xl">Round {currentRound.round_number}</div>
          )}
        </div>
      </div>

      {/* Lobby */}
      {session?.status === 'lobby' && (
        <div className="text-center py-24">
          <div className="text-8xl mb-6">🎯</div>
          <h1 className="text-5xl font-black text-white mb-4">Social Mirror</h1>
          <p className="text-slate-400 text-2xl mb-8">Join with code:</p>
          <div className="text-8xl font-black text-yellow-400 tracking-widest mb-8">{code}</div>
          {joinUrl && (() => {
            const qr = encodeQR(joinUrl, { ecc: 'M' })
            const cellSize = 4
            return (
              <div className="flex justify-center mb-6">
                <div style={{ background: 'white', padding: 8, borderRadius: 8, display: 'inline-block' }}>
                  <svg
                    width={qr.size * cellSize}
                    height={qr.size * cellSize}
                    viewBox={`0 0 ${qr.size} ${qr.size}`}
                    shapeRendering="crispEdges"
                  >
                    {Array.from({ length: qr.size }, (_, y) =>
                      Array.from({ length: qr.size }, (_, x) =>
                        qr.data[y][x] ? (
                          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000" />
                        ) : null
                      )
                    )}
                  </svg>
                </div>
              </div>
            )
          })()}
          <p className="text-slate-500 text-xl">
            {players.filter((p) => !p.is_organizer).length} player(s) joined
          </p>
        </div>
      )}

      {/* Paused */}
      {session?.status === 'paused' && currentRound && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-gradient-to-br from-purple-900/50 to-slate-800 border border-purple-700 rounded-3xl p-8">
            <div className="text-purple-400 text-sm uppercase tracking-wider mb-3">Question</div>
            <p className="text-white text-4xl font-black leading-tight">{currentRound.question_text}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-slate-400">Target:</span>
              <span className="text-pink-300 font-bold text-xl">
                {players.find((p) => p.id === currentRound.target_player_id)?.name}
              </span>
            </div>
          </div>
          <div className="text-center py-6">
            <div className="text-5xl mb-3">⏸️</div>
            <p className="text-yellow-300 text-2xl font-bold">Game paused — back in a moment</p>
          </div>
        </div>
      )}

      {/* Active game */}
      {currentRound && session?.status === 'active' && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Question */}
          <div className="bg-gradient-to-br from-purple-900/50 to-slate-800 border border-purple-700 rounded-3xl p-8">
            <div className="text-purple-400 text-sm uppercase tracking-wider mb-3">Question</div>
            <p className="text-white text-4xl font-black leading-tight">
              {currentRound.question_text}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-slate-400">Target:</span>
              <span className="text-pink-300 font-bold text-xl">
                {players.find((p) => p.id === currentRound.target_player_id)?.name}
              </span>
            </div>
          </div>

          {/* Timer */}
          {session.timer_seconds > 0 && currentRound.started_at && currentRound.status !== 'done' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <Timer startedAt={currentRound.started_at ?? null} durationSeconds={session.timer_seconds} />
            </div>
          )}

          {/* Submission progress */}
          {currentRound.status === 'guessing' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center">
              <div className="text-slate-400 text-lg mb-2">Guesses submitted</div>
              <div className="text-6xl font-black text-white">
                {submittedCount}
                <span className="text-slate-500 text-3xl">/{totalEligible}</span>
              </div>
              <div className="mt-4 w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: totalEligible > 0 ? `${(submittedCount / totalEligible) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {currentRound.status === 'guessing' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">🤫</div>
              <p className="text-white text-2xl font-bold">
                {players.find((p) => p.id === currentRound.target_player_id)?.name} is answering...
              </p>
            </div>
          )}

          {/* Reveal */}
          {(currentRound.status === 'reveal' || currentRound.status === 'done') && (
            <div className="space-y-4">
              {revealCards.map((card, i) => (
                <RevealCard
                  key={card.id}
                  card={card}
                  visible={i < revealedCount}
                  targetAnswer={targetAnswer}
                  showHotCold={session.hot_cold_enabled && currentRound.status === 'reveal'}
                  winnerIds={revealWinnerNames.length > 0 ? revealCards.filter((c) => revealWinnerNames.includes(c.playerName)).map((c) => c.playerId ?? '') : winnerPlayer ? [winnerPlayer.id] : []}
                />
              ))}
              {revealedCount >= revealCards.length && revealCards.length > 0 && numberLinePoints.length > 0 && (
                <NumberLine
                  points={numberLinePoints.map((p) => ({
                    ...p,
                    isWinner: !p.isTarget && p.playerName === winnerPlayer?.name,
                  }))}
                />
              )}

              {/* Per-round ranking */}
              {revealedCount >= revealCards.length && revealCards.length > 0 && targetAnswer !== null && (
                <RoundRanking
                  cards={revealCards}
                  targetAnswer={targetAnswer}
                  scoringMode={(session.scoring_mode ?? 'simple') as 'simple' | 'rich'}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard always visible at bottom */}
      {scores.length > 0 && (
        <div className="max-w-3xl mx-auto mt-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="text-slate-300 font-black text-xl mb-4">Leaderboard</h3>
            <div className="space-y-2">
              {sortedScores.map((entry, i) => (
                <div key={entry.playerId} className="flex items-center justify-between px-4 py-3 bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{['🥇','🥈','🥉'][i] ?? `${i+1}.`}</span>
                    <span className="text-white font-bold text-lg">{entry.playerName}</span>
                  </div>
                  <span className="text-yellow-400 font-black text-2xl">{entry.totalPoints}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game ended */}
      {session?.status === 'ended' && (
        <div className="text-center mt-8">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-4xl font-black text-white mb-2">Game Over!</h2>
          <p className="text-slate-400 text-xl">Final results above</p>
        </div>
      )}
    </main>
  )
}
