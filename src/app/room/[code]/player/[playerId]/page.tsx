'use client'

import { useEffect, useState, useCallback, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Timer from '@/components/Timer'
import RevealCard, { RevealCardData } from '@/components/RevealCard'
import ConfettiBlast from '@/components/ConfettiBlast'
import Leaderboard from '@/components/Leaderboard'
import HowToPlay from '@/components/HowToPlay'
import NumberLine, { NumberLinePoint } from '@/components/NumberLine'
import RoundRanking from '@/components/RoundRanking'
import RoundStartFlash from '@/components/RoundStartFlash'
import { soundCardReveal, soundGuessSubmit, soundWinner, soundCrowd } from '@/lib/sounds'
import WinnerReveal from '@/components/WinnerReveal'
import GameOverPlayer from '@/components/GameOverPlayer'
import { assignBadges, type PlayerBadge, type GuessRecord, type RoundRecord } from '@/lib/badgeLogic'
import { getAdaptiveRevealDelay } from '@/lib/revealTiming'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'

interface Session {
  id: string
  room_code: string
  organizer_name: string
  scoring_mode: string
  show_reasoning: boolean
  hot_cold_enabled: boolean
  timer_seconds: number
  status: string
  pack_id: string | null
}

interface Player {
  id: string
  session_id: string
  name: string
  is_organizer: boolean
  created_at?: string
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
  colorIndex?: number
}

export default function PlayerPage({
  params,
}: {
  params: Promise<{ code: string; playerId: string }>
}) {
  const { code, playerId } = use(params)
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Player | null>(null)
  const [removed, setRemoved] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const playersRef = useRef<Player[]>([])
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [skipToast, setSkipToast] = useState('')
  const [scores, setScores] = useState<PlayerScore[]>([])

  // Form state
  const [myAnswer, setMyAnswer] = useState('')
  const [myReasoning, setMyReasoning] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Reveal state
  const [revealCards, setRevealCards] = useState<RevealCardData[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [targetAnswer, setTargetAnswer] = useState<number | null>(null)
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [myPoints, setMyPoints] = useState<number | null>(null)
  const [numberLinePoints, setNumberLinePoints] = useState<NumberLinePoint[]>([])

  const [loading, setLoading] = useState(true)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showRoundFlash, setShowRoundFlash] = useState(false)
  const [showWinnerReveal, setShowWinnerReveal] = useState(false)
  const [revealWinnerNames, setRevealWinnerNames] = useState<string[]>([])
  const lastRoundIdRef = useRef<string | null>(null)
  const builtCardsForRoundRef = useRef<string | null>(null)
  const shownRevealForRoundRef = useRef<string | null>(null)
  // Tracks which round has already fired confetti for this player — prevents re-fire on every poll
  // while keeping the check window open until scores arrive (handles tie race condition)
  const confettiFiredForRoundRef = useRef<string | null>(null)
  const organizerPlaysRef = useRef(false)

  // Rotating tips
  const LOBBY_TIPS = [
    '💡 Think about how THEY think, not how you\'d answer',
    '💡 Rich Mode: 1st=3pts, 2nd=2pts, 3rd=1pt',
    '💡 You can Pass any round — but no points for passing',
    '💡 Reasoning is half the fun — make it creative',
    '💡 The closest guess wins — not the highest or lowest',
  ]
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    if (session?.status !== 'lobby') return
    const t = setInterval(() => setTipIndex((i) => (i + 1) % LOBBY_TIPS.length), 3000)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status])

  // Track question bank submission
  const [newQuestion, setNewQuestion] = useState('')
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [questionAdded, setQuestionAdded] = useState(false)
  const [showQuestionForm, setShowQuestionForm] = useState(false)

  // Badge state — computed on game over
  const [myBadge, setMyBadge] = useState<PlayerBadge | null>(null)
  const badgeComputedRef = useRef(false)

  // P0.3: Replay — new room code if organizer started a replay session
  const [replayCode, setReplayCode] = useState<string | null>(null)
  const replayCheckedRef = useRef(false)
  const [replayJoinError, setReplayJoinError] = useState(false)
  const [replaySkipped, setReplaySkipped] = useState(false)

  // Late join — player joined mid-game
  const [isLateJoiner, setIsLateJoiner] = useState(false)

  // Track previous round status to avoid confetti on reload / every refresh
  const prevRoundStatusRef = useRef<string | null>(null)
  // Stable ref to always-current refreshAll — keeps subscription from tearing down on every render
  const refreshAllRef = useRef<((id: string) => Promise<void>) | null>(null)
  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  // Tracks last time the page became visible — changing this forces a fresh Supabase channel.
  // Safari on iPhone kills WebSocket connections in the background; this reconnects them on resume.
  const [lastVisible, setLastVisible] = useState(0)

  const computeBadge = useCallback(async (sessionId: string, playerList: Player[]) => {
    if (badgeComputedRef.current) return
    badgeComputedRef.current = true

    const { data: sessionMeta } = await supabase.from('sessions').select('organizer_plays').eq('id', sessionId).single()
    const orgPlays = sessionMeta?.organizer_plays === true
    const nonOrgPlayers = playerList.filter((p) => !p.is_organizer || orgPlays)
    const playerNames: Record<string, string> = {}
    for (const p of nonOrgPlayers) playerNames[p.id] = p.name

    const { data: allRounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', sessionId)
      .order('round_number', { ascending: true })

    const roundIds = (allRounds ?? []).map((r) => r.id)

    const [{ data: allGuesses }, { data: allScores }, { data: allTargetAnswers }] =
      roundIds.length > 0
        ? await Promise.all([
            supabase.from('guesses').select('*').in('round_id', roundIds),
            supabase.from('scores').select('*').eq('session_id', sessionId),
            supabase.from('target_answers').select('*').in('round_id', roundIds),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }]

    if (!allRounds) return

    const roundRecords: RoundRecord[] = allRounds
      .map((r) => {
        const ta = (allTargetAnswers ?? []).find((t) => t.round_id === r.id)
        if (!ta) return null
        return { roundId: r.id, targetPlayerId: r.target_player_id, targetAnswer: Number(ta.answer) }
      })
      .filter((r): r is RoundRecord => r !== null)

    const guessRecords: GuessRecord[] = (allGuesses ?? []).map((g) => ({
      playerId: g.player_id,
      roundId: g.round_id,
      answer: g.passed ? null : Number(g.answer),
      passed: g.passed,
      autoPassed: g.auto_passed === true,
      submittedAt: g.submitted_at ?? undefined,
    }))

    const scoreRecords = (allScores ?? []).map((s) => ({
      playerId: s.player_id,
      roundId: s.round_id,
      points: s.points,
    }))

    const badges = assignBadges(
      nonOrgPlayers.map((p) => p.id),
      guessRecords,
      roundRecords,
      scoreRecords,
      playerNames
    )

    const mine = badges.find((b) => b.playerId === playerId)
    if (mine) {
      // Attach rank, totalPlayers, bestDistance so BadgeCard can show them
      const playerIdList = nonOrgPlayers.map((p) => p.id)
      const totalScores: Record<string, number> = {}
      for (const pid of playerIdList) totalScores[pid] = 0
      for (const s of scoreRecords) totalScores[s.playerId] = (totalScores[s.playerId] ?? 0) + s.points
      const ranked = [...playerIdList].sort((a, b) => (totalScores[b] ?? 0) - (totalScores[a] ?? 0))
      mine.rank = ranked.indexOf(playerId) + 1 || undefined
      mine.totalPlayers = playerIdList.length

      const myGuesses = guessRecords.filter((g) => g.playerId === playerId && !g.passed && g.answer !== null)
      const distances = myGuesses.map((g) => {
        const rr = roundRecords.find((r) => r.roundId === g.roundId)
        return rr ? Math.abs(g.answer! - rr.targetAnswer) : null
      }).filter((d): d is number => d !== null)
      mine.bestDistance = distances.length > 0 ? Math.min(...distances) : null

      setMyBadge(mine)
    }
  }, [playerId])

  const loadScores = useCallback(async (sessionId: string, playerList: Player[]) => {
    const { data } = await supabase
      .from('scores')
      .select('*')
      .eq('session_id', sessionId)

    if (!data) return

    const totals: Record<string, number> = {}
    for (const s of data) {
      totals[s.player_id] = (totals[s.player_id] ?? 0) + s.points
    }

    const leaderboard = playerList
      .filter((p) => !p.is_organizer || organizerPlaysRef.current)
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      .map((p, idx) => ({
        playerId: p.id,
        playerName: p.name,
        totalPoints: totals[p.id] ?? 0,
        colorIndex: idx,
      }))
    // Only update state if scores actually changed — avoids leaderboard flashing on every 2s poll
    setScores((prev) => {
      const same = prev.length === leaderboard.length &&
        prev.every((s, i) => s.playerId === leaderboard[i].playerId && s.totalPoints === leaderboard[i].totalPoints)
      return same ? prev : leaderboard
    })
  }, [])

  const buildRevealCards = useCallback(
    async (round: Round, playerList: Player[]) => {
      const { data: guesses } = await supabase
        .from('guesses')
        .select('*')
        .eq('round_id', round.id)
        .order('submitted_at', { ascending: true })

      const { data: ta } = await supabase
        .from('target_answers')
        .select('*')
        .eq('round_id', round.id)
        .single()

      const cards: RevealCardData[] = []
      for (const g of guesses ?? []) {
        const p = playerList.find((pl) => pl.id === g.player_id)
        if (p) {
          cards.push({
            id: g.id,
            playerId: g.player_id,
            playerName: p.name,
            answer: g.passed ? null : Number(g.answer),
            reasoning: g.reasoning,
            passed: g.passed,
            autoPassed: g.auto_passed === true,
            isTarget: false,
          })
        }
      }
      if (ta) {
        const targetPlayer = playerList.find((p) => p.id === round.target_player_id)
        cards.push({
          id: `target-${ta.id}`,
          playerId: round.target_player_id,
          playerName: targetPlayer?.name ?? 'Target',
          answer: Number(ta.answer),
          isTarget: true,
        })
        setTargetAnswer(Number(ta.answer))

        // Build number line points
        const nlPoints: NumberLinePoint[] = []
        for (const g of guesses ?? []) {
          if (!g.passed && g.answer !== null) {
            const p = playerList.find((pl) => pl.id === g.player_id)
            if (p) nlPoints.push({ playerName: p.name, answer: Number(g.answer), isTarget: false })
          }
        }
        nlPoints.push({ playerName: targetPlayer?.name ?? 'Target', answer: Number(ta.answer), isTarget: true })
        setNumberLinePoints(nlPoints)
      }
      setRevealCards(cards)
      setRevealedCount(0)
    },
    []
  )

  const checkMySubmission = useCallback(async (roundId: string, isTarget: boolean) => {
    if (isTarget) {
      const { data } = await supabase
        .from('target_answers')
        .select('id')
        .eq('round_id', roundId)
        .eq('player_id', playerId)
        .single()
      setSubmitted(!!data)
    } else {
      const { data } = await supabase
        .from('guesses')
        .select('id')
        .eq('round_id', roundId)
        .eq('player_id', playerId)
        .single()
      setSubmitted(!!data)
    }
  }, [playerId])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSoundEnabled(localStorage.getItem('gtg_sound') !== 'false')
      if (localStorage.getItem('gtg_late_join') === 'true') {
        setIsLateJoiner(true)
        localStorage.removeItem('gtg_late_join')
      }
    }
  }, [])

  // Initial load
  useEffect(() => {
    const init = async () => {
      // Retry up to 3 times — on iPhone Safari, network may be unavailable for 1-2s after
      // the page becomes visible (resume from lock screen / tab switch).
      let sess = null
      for (let attempt = 0; attempt < 3 && !sess; attempt++) {
        if (attempt > 0) await new Promise<void>((r) => setTimeout(r, 1500 * attempt))
        const { data } = await supabase.from('sessions').select('*').eq('room_code', code).single()
        sess = data
      }

      if (!sess) { setLoading(false); return }
      setSession(sess)
      organizerPlaysRef.current = !!sess.organizer_plays

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sess.id)
      const plist = playerData ?? []
      setPlayers(plist)
      playersRef.current = plist

      const myPlayer = plist.find((p) => p.id === playerId)
      setMe(myPlayer ?? null)

      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('session_id', sess.id)
        .order('round_number', { ascending: false })
        .limit(1)

      if (rounds && rounds.length > 0) {
        const round = rounds[0]
        setCurrentRound(round)
        lastRoundIdRef.current = round.id
        const isTarget = round.target_player_id === playerId
        await checkMySubmission(round.id, isTarget)

        if (round.status === 'reveal' || round.status === 'done') {
          await buildRevealCards(round, plist)
          builtCardsForRoundRef.current = round.id
          if (round.status === 'done' && round.winner_player_id) {
            const wp = plist.find((p) => p.id === round.winner_player_id)
            if (wp) setWinnerPlayer(wp)
          }
        }
        // Set refs so refreshAll doesn't fire confetti/winner reveal for already-done rounds on reload
        prevRoundStatusRef.current = round.status
        if (round.status === 'done') shownRevealForRoundRef.current = round.id
      }

      await loadScores(sess.id, plist)

      // If session already ended on load, compute badge immediately
      if (sess.status === 'ended') {
        await computeBadge(sess.id, plist)
        const { data: child } = await supabase
          .from('sessions')
          .select('room_code')
          .eq('parent_session_id', sess.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (child?.room_code) {
          setReplayCode(child.room_code)
          replayCheckedRef.current = true
        }
      }

      setLoading(false)
    }

    init()
  }, [code, playerId, checkMySubmission, buildRevealCards, loadScores])

  const refreshAll = useCallback(async (sessionId: string) => {
    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    if (sess) { setSession(sess); organizerPlaysRef.current = !!sess.organizer_plays }

    // If session ended, compute badge + reload final scores, then stop
    if (sess?.status === 'ended') {
      const { data: playerData } = await supabase.from('players').select('*').eq('session_id', sessionId)
      const plist = playerData ?? []
      setPlayers(plist)
      playersRef.current = plist
      await computeBadge(sessionId, plist)
      await loadScores(sessionId, plist)  // ensure game-over leaderboard is up to date
      return
    }

    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId)
    const plist = playerData ?? []
    setPlayers(plist)
    playersRef.current = plist

    // Detect if this player was removed by the organizer
    if (plist.length > 0 && !plist.find((p) => p.id === playerId)) {
      setRemoved(true)
      return
    }

    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', sessionId)
      .order('round_number', { ascending: false })
      .limit(1)

    if (rounds && rounds.length > 0) {
      const round = rounds[0]
      setCurrentRound((prev) => {
        // Reset form state when round changes
        if (!prev || prev.id !== round.id) {
          setSubmitted(false)
          setMyAnswer('')
          setMyReasoning('')
          builtCardsForRoundRef.current = null
          shownRevealForRoundRef.current = null
          setRevealCards([])
          setRevealedCount(0)
          setTargetAnswer(null)
          setWinnerPlayer(null)
          setMyPoints(null)
          setNumberLinePoints([])
          setRevealWinnerNames([])
          setShowWinnerReveal(false)
          prevRoundStatusRef.current = null
          // Show round start flash for new rounds (not on initial page load)
          if (lastRoundIdRef.current !== null && lastRoundIdRef.current !== round.id) {
            setShowRoundFlash(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
          lastRoundIdRef.current = round.id
        }
        return round
      })

      const isTarget = round.target_player_id === playerId
      await checkMySubmission(round.id, isTarget)

      if ((round.status === 'reveal' || round.status === 'done') && builtCardsForRoundRef.current !== round.id) {
        await buildRevealCards(round, plist)
        builtCardsForRoundRef.current = round.id
      }

      if (round.status === 'done' && round.winner_player_id) {
        const wp = plist.find((p) => p.id === round.winner_player_id)
        if (wp) setWinnerPlayer(wp)
        // Fire confetti only if this player won AND we haven't already fired for this round.
        // Guard uses per-round-id ref (not status transition) so the check window stays open
        // until scores arrive — fixes the tie race condition where scores land after first poll.
        if (confettiFiredForRoundRef.current !== round.id) {
          const [{ data: myRoundScore }, { data: topScore }] = await Promise.all([
            supabase.from('scores').select('points').eq('round_id', round.id).eq('player_id', playerId).maybeSingle(),
            supabase.from('scores').select('points').eq('round_id', round.id).order('points', { ascending: false }).limit(1).maybeSingle(),
          ])
          // Only fire confetti for true winner(s) — points must equal the highest score in the round
          const isTopScorer = myRoundScore && topScore &&
            myRoundScore.points > 0 && myRoundScore.points === topScore.points
          if (isTopScorer) {
            confettiFiredForRoundRef.current = round.id
            setShowConfetti(true)
            if (soundEnabledRef.current) { soundWinner(); soundCrowd() }
            setTimeout(() => setShowConfetti(false), 5000)
          } else if (!myRoundScore && round.winner_player_id === playerId) {
            // Scores not yet inserted — fire via winner_player_id fallback (singular winner only)
            confettiFiredForRoundRef.current = round.id
            setShowConfetti(true)
            if (soundEnabledRef.current) { soundWinner(); soundCrowd() }
            setTimeout(() => setShowConfetti(false), 5000)
          }
          // If neither condition met, leave confettiFiredForRoundRef unset so next poll retries
        }
      }
      // Show skip toast when round transitions to done with no winner
      if (round.status === 'done' && !round.winner_player_id && prevRoundStatusRef.current !== 'done') {
        setSkipToast('Round skipped — no points awarded')
        setTimeout(() => setSkipToast(''), 4000)
      }
      prevRoundStatusRef.current = round.status
      // Clear late-joiner flag once the first round they see finishes
      if (round.status === 'done') setIsLateJoiner(false)
    }

    await loadScores(sessionId, plist)

    // Compute badge once when session ends
    if (sess?.status === 'ended') {
      await computeBadge(sessionId, plist)

      // Check for replay session; keep checking until found
      if (!replayCheckedRef.current) {
        const { data: child } = await supabase
          .from('sessions')
          .select('room_code')
          .eq('parent_session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (child?.room_code) {
          setReplayCode(child.room_code)
          replayCheckedRef.current = true
        }
      }
    }
  }, [playerId, checkMySubmission, buildRevealCards, loadScores, computeBadge])

  // Keep ref in sync with the latest refreshAll so the subscription doesn't tear down on every render
  useEffect(() => {
    refreshAllRef.current = refreshAll
  }, [refreshAll])

  // Scroll to top when game ends so players see the game-over screen immediately
  useEffect(() => {
    if (session?.status === 'ended') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [session?.status])

  // Realtime — reconnects when lastVisible changes (Safari kills WebSocket in background)
  useEffect(() => {
    if (!session?.id) return
    const sessionId = session.id

    // Unique channel name per visibility epoch forces Supabase to create a fresh WebSocket
    // connection rather than reusing a potentially dead one from before the lock screen.
    const channel = supabase
      .channel(`player-${sessionId}-${playerId}-${lastVisible}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        () => { refreshAllRef.current?.(sessionId) }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` },
        () => { refreshAllRef.current?.(sessionId) }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `session_id=eq.${sessionId}` },
        () => { refreshAllRef.current?.(sessionId) }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          if (payload.new && (payload.new as { player_id: string }).player_id === playerId) {
            setMyPoints((payload.new as { points: number }).points)
          }
          refreshAllRef.current?.(sessionId)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.id, playerId, lastVisible])  // lastVisible forces reconnect on each tab-resume

  // Fallback poll for ALL active game states — Safari on iPhone drops WebSocket when screen dims
  // Without this, players freeze on submitted/guessing screen and never see reveal/done/next round
  useEffect(() => {
    if (!session?.id || session.status === 'ended') return
    const interval = session.status === 'lobby' ? 4000 : 2000
    const poll = setInterval(() => {
      refreshAllRef.current?.(session.id)
    }, interval)
    return () => clearInterval(poll)
  }, [session?.id, session?.status])

  // Instant refresh when user returns to tab/app — Safari throttles timers in background
  // so the 2s poll may not fire for 30s+. visibilitychange fires immediately on resume.
  useEffect(() => {
    if (!session?.id || session.status === 'ended') return
    const sessionId = session.id
    const onVisible = () => {
      if (!document.hidden) refreshAllRef.current?.(sessionId)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [session?.id, session?.status])

  // Force Supabase subscription reconnect on every tab-resume.
  // Safari kills WebSocket connections in the background. Updating lastVisible triggers
  // the subscription effect to remove the dead channel and create a fresh one.
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setLastVisible(Date.now()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Poll for replay session every 5s while ended and not yet found
  useEffect(() => {
    if (!session?.id || session.status !== 'ended' || replayCheckedRef.current) return
    const poll = setInterval(async () => {
      if (replayCheckedRef.current) { clearInterval(poll); return }
      const { data: child } = await supabase
        .from('sessions')
        .select('room_code')
        .eq('parent_session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (child?.room_code) {
        setReplayCode(child.room_code)
        replayCheckedRef.current = true
        clearInterval(poll)
      }
    }, 5000)
    return () => clearInterval(poll)
  }, [session?.id, session?.status])

  // Compute winner names for WinnerReveal and card highlighting
  // Runs when winnerPlayer is set — uses revealCards + targetAnswer (already populated by this point)
  useEffect(() => {
    if (!winnerPlayer || !currentRound) return
    if (shownRevealForRoundRef.current === currentRound.id) return
    if (revealCards.length === 0 || targetAnswer === null) return
    const guessCards = revealCards.filter((c) => !c.isTarget && !c.passed && c.answer !== null)
    if (guessCards.length === 0) return
    const minDist = Math.min(...guessCards.map((c) => Math.abs(c.answer! - targetAnswer)))
    const names = guessCards
      .filter((c) => Math.abs(c.answer! - targetAnswer) === minDist)
      .map((c) => c.playerName)
    setRevealWinnerNames(names)
    setShowWinnerReveal(true)
    shownRevealForRoundRef.current = currentRound.id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerPlayer?.id, currentRound?.id, revealCards.length, targetAnswer])

  // Auto-reveal cards
  useEffect(() => {
    if (currentRound?.status !== 'reveal' && currentRound?.status !== 'done') return
    if (revealCards.length === 0) return
    if (revealedCount >= revealCards.length) return

    const delay = getAdaptiveRevealDelay(revealedCount, revealCards.length)

    const t = setTimeout(() => {
      setRevealedCount((c) => c + 1)
      if (soundEnabled) soundCardReveal()
    }, delay)
    return () => clearTimeout(t)
  }, [revealedCount, revealCards.length, currentRound?.status, soundEnabled])

  // Auto-scroll to each newly revealed card
  useEffect(() => {
    if (revealedCount > 0) {
      document.getElementById(`reveal-card-${revealedCount - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [revealedCount])

  const handleSubmitAnswer = async () => {
    if (!currentRound) return
    const num = Number(myAnswer)
    if (isNaN(num) || myAnswer.trim() === '') {
      setSubmitError('Please enter a valid number')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: currentRound.id, player_id: playerId, answer: num }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to submit')
        return
      }
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitGuess = async (pass = false) => {
    if (!currentRound) return
    if (!pass) {
      const num = Number(myAnswer)
      if (isNaN(num) || myAnswer.trim() === '') {
        setSubmitError('Please enter a valid number')
        return
      }
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/submit-guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round_id: currentRound.id,
          player_id: playerId,
          answer: pass ? null : Number(myAnswer),
          reasoning: myReasoning.trim() || null,
          passed: pass,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to submit')
        return
      }
      setSubmitted(true)
      if (soundEnabled) soundGuessSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSilentRejoin = async (newRoomCode: string) => {
    if (typeof window === 'undefined') return
    const storedName = localStorage.getItem('gtg_name')
    const storedToken = localStorage.getItem('gtg_player_token')
    if (!storedName || !storedToken) {
      router.push(`/join?code=${newRoomCode}&name=${encodeURIComponent(storedName ?? '')}`)
      return
    }
    try {
      const res = await fetch('/api/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-player-token': storedToken },
        body: JSON.stringify({ room_code: newRoomCode, player_name: storedName, player_token: storedToken }),
      })
      const data = await res.json()
      if (res.ok && data.player?.id) {
        router.push(`/room/${newRoomCode}/player/${data.player.id}`)
      } else {
        setReplayJoinError(true)
      }
    } catch {
      setReplayJoinError(true)
    }
  }

  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) return
    setAddingQuestion(true)
    try {
      const res = await fetch('/api/add-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newQuestion.trim(),
          source: me?.name ?? null,
          submitted_by: me?.name ?? null,
          auto_approve: true,
        }),
      })
      if (res.ok) {
        setNewQuestion('')
        setQuestionAdded(true)
        setTimeout(() => setQuestionAdded(false), 3000)
      }
    } finally {
      setAddingQuestion(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-3xl">📡</div>
          <div className="text-white font-bold">Couldn&apos;t connect to room</div>
          <p className="text-slate-400 text-sm">Room &quot;{code}&quot; may not exist, or check your connection.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (removed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-2xl font-black text-white mb-2">You&apos;ve been removed</h2>
          <p className="text-slate-400">The organizer removed you from this game.</p>
        </div>
      </div>
    )
  }

  const isTarget = currentRound?.target_player_id === playerId

  const isTargetGuessing = isTarget && currentRound?.status === 'guessing'

  return (
    <main className={`min-h-screen ${isTargetGuessing ? 'bg-rose-950' : 'bg-slate-950'} text-white pb-20`}>
      <ConfettiBlast trigger={showConfetti} />
      <WinnerReveal
        winnerNames={revealWinnerNames}
        visible={showWinnerReveal}
        onDone={() => setShowWinnerReveal(false)}
      />
      <RoundStartFlash
        roundNumber={currentRound?.round_number ?? 1}
        trigger={showRoundFlash}
        onDone={() => setShowRoundFlash(false)}
      />

      {/* Header */}
      <div className={`${isTargetGuessing ? 'bg-rose-900 border-rose-700' : 'bg-slate-900 border-slate-800'} border-b px-4 py-4 flex items-center justify-between sticky top-0 z-40`}>
        <div className="flex items-center gap-2.5">
          <SocialMirrorLogo size={36} />
          <div>
            <div className="text-white font-black text-sm tracking-tight leading-none">Social Mirror</div>
            <div className="text-xl font-black text-yellow-400 tracking-widest leading-none mt-0.5">{code}</div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-white font-bold">{me?.name ?? 'Player'}</div>
          <div className="text-slate-400 text-xs">
            {session?.status === 'lobby' ? 'In Lobby' : `Round ${currentRound?.round_number ?? 1}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !soundEnabled
              setSoundEnabled(next)
              if (typeof window !== 'undefined') localStorage.setItem('gtg_sound', next ? 'true' : 'false')
            }}
            className="text-slate-400 hover:text-white text-sm"
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? '🔔' : '🔕'}
          </button>
          <button
            onClick={() => setShowHowToPlay(true)}
            className="text-slate-400 hover:text-white text-xs underline"
          >
            How to Play
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Lobby */}
        {session?.status === 'lobby' && (
          <div className="text-center py-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <SocialMirrorLogo size={48} />
              <span className="text-white font-black text-3xl tracking-tight">Social Mirror</span>
            </div>
            <h2 className="text-xl font-bold text-slate-300 mb-2">Waiting for game to start...</h2>
            <p className="text-slate-400 mb-4">
              The organizer will start the game soon.
            </p>
            <div className="text-slate-500 text-sm">
              {players.filter((p) => !p.is_organizer).length} player(s) in lobby
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {players.filter((p) => !p.is_organizer).map((p) => (
                <span
                  key={p.id}
                  className={`px-3 py-1 rounded-full text-sm ${
                    p.id === playerId
                      ? 'bg-purple-900/50 border border-purple-500 text-purple-200'
                      : 'bg-slate-800 border border-slate-700 text-slate-300'
                  }`}
                >
                  {p.name} {p.id === playerId && '(you)'}
                </span>
              ))}
            </div>
            <div className="mt-6 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-400 text-sm text-center min-h-[48px] transition-all">
              {LOBBY_TIPS[tipIndex]}
            </div>
          </div>
        )}

        {/* Late joiner — hang tight until current round ends */}
        {isLateJoiner && currentRound?.status === 'guessing' && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-black text-white mb-2">Hang tight!</h2>
            <p className="text-slate-400">A round is already in progress. You&apos;ll jump in from the next round.</p>
          </div>
        )}

        {/* Skip toast */}
        {skipToast && (
          <div className="bg-yellow-900/40 border border-yellow-600 text-yellow-300 rounded-xl px-4 py-3 text-sm text-center">
            {skipToast}
          </div>
        )}

        {/* Paused banner — small pill, non-blocking */}
        {session?.status === 'paused' && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-900/50 border border-yellow-700 rounded-full text-yellow-300 text-sm font-semibold">
              ⏸️ Paused — organizer will resume shortly
            </div>
          </div>
        )}

        {/* P0.3: Replay banner — shown when organizer has started a new session */}
        {session?.status === 'ended' && replayCode && !replaySkipped && (
          <div className="bg-purple-900/60 border-2 border-purple-400 rounded-2xl p-4 text-center space-y-3 mt-2">
            <div className="text-2xl">🔁</div>
            <div className="text-white font-black text-lg">New game started!</div>
            <p className="text-purple-300 text-sm">The organizer just kicked off a rematch. Tap to rejoin.</p>
            {replayJoinError ? (
              <button
                onClick={() => { setReplayJoinError(false); handleSilentRejoin(replayCode) }}
                className="block w-full py-3 bg-red-700 hover:bg-red-600 text-white font-black rounded-xl text-sm"
              >
                Couldn&apos;t join — tap to try again
              </button>
            ) : (
              <button
                onClick={() => handleSilentRejoin(replayCode)}
                className="block w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black rounded-xl text-sm"
              >
                Join {replayCode} →
              </button>
            )}
            <button
              onClick={() => setReplaySkipped(true)}
              className="text-slate-500 hover:text-slate-400 text-xs underline"
            >
              Skip
            </button>
          </div>
        )}
        {/* 4E: Rejoin banner after skipping */}
        {session?.status === 'ended' && replayCode && replaySkipped && (
          <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-800 border border-purple-500 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-slate-300 text-sm">🔁 {session?.organizer_name ?? 'Organizer'} started a new game</span>
            <button
              onClick={() => { setReplaySkipped(false); handleSilentRejoin(replayCode) }}
              className="text-purple-400 font-bold text-sm shrink-0 underline"
            >
              Rejoin
            </button>
          </div>
        )}

        {/* Game Ended */}
        {session?.status === 'ended' && (
          <GameOverPlayer
            sessionId={session.id}
            playerId={playerId}
            playerName={me?.name ?? 'Player'}
            roomCode={code}
            scoringMode={session.scoring_mode}
            roundsPlayed={currentRound?.round_number ?? 0}
            playerCount={players.filter((p) => !p.is_organizer).length}
            packId={session.pack_id ?? null}
            badge={myBadge}
            scores={scores}
          />
        )}

        {/* Active round (also shown when paused so submitted state is visible) */}
        {currentRound && (session?.status === 'active' || session?.status === 'paused') && (
          <div className="space-y-4">
            {/* Target player prominent banner */}
            {isTargetGuessing && (
              <div className="bg-rose-600 border-2 border-rose-400 rounded-2xl p-4 text-center animate-pulse">
                <div className="text-white font-black text-2xl">🎯 YOU ARE THE TARGET THIS ROUND! 🎯</div>
                <div className="text-rose-200 text-sm mt-1">Everyone is guessing YOUR answer!</div>
              </div>
            )}

            {/* Question */}
            <div className={`bg-gradient-to-br ${isTargetGuessing ? 'from-rose-900/40 to-slate-800 border-rose-700' : 'from-purple-900/40 to-slate-800 border-purple-700'} border rounded-2xl p-5`}>
              <div className="text-purple-400 text-xs uppercase tracking-wider mb-2">
                Round {currentRound.round_number}
              </div>
              {!isTarget && currentRound.status === 'guessing' && (
                <div className="mb-3">
                  <div className="text-lg font-black text-pink-300 uppercase tracking-wide">
                    🎯 GUESS WHAT{' '}
                    <span className="text-pink-200">
                      {players.find((p) => p.id === currentRound.target_player_id)?.name?.toUpperCase() ?? 'TARGET'}
                    </span>{' '}
                    WILL SAY
                  </div>
                </div>
              )}
              <p className="text-white text-xl font-bold leading-snug">
                {currentRound.question_text}
              </p>
            </div>

            {/* Timer — only show while guessing, active, and not yet submitted */}
            {session.timer_seconds > 0 && currentRound.started_at && currentRound.status === 'guessing' && !submitted && (session.status === 'active' || session.status === 'paused') && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <Timer
                  startedAt={currentRound.started_at ?? null}
                  durationSeconds={session.timer_seconds}
                  paused={session.status === 'paused'}
                />
              </div>
            )}

            {/* Target player — submit their real answer */}
            {isTarget && currentRound.status === 'guessing' && !submitted && session?.status === 'active' && (
              <div className="bg-slate-800 border-2 border-pink-600 rounded-2xl p-5">
                <div className="text-pink-400 font-black text-lg mb-1">You are the Target!</div>
                <p className="text-slate-300 text-sm mb-4">
                  Submit your real, honest answer. Everyone else is guessing it right now!
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={myAnswer}
                  onChange={(e) => setMyAnswer(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && myAnswer.trim() && handleSubmitAnswer()}
                  placeholder="Your answer..."
                  className="w-full bg-slate-700 border-2 border-slate-600 focus:border-pink-500 rounded-xl px-4 py-4 text-white text-3xl font-black text-center focus:outline-none transition-colors mb-3"
                  autoFocus
                />
                {submitError && (
                  <p className="text-red-400 text-sm mb-2">{submitError}</p>
                )}
                <button
                  onClick={handleSubmitAnswer}
                  disabled={submitting || !myAnswer.trim()}
                  className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-black text-lg rounded-xl transition-all"
                >
                  {submitting ? 'Submitting...' : 'Submit My Answer 🔒'}
                </button>
              </div>
            )}

            {/* Target — submitted, waiting for reveal */}
            {isTarget && currentRound.status === 'guessing' && submitted && (
              <div className="bg-green-900/40 border border-green-500 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-green-300 font-black text-xl">Answer locked in!</div>
                <p className="text-slate-400 text-sm mt-2">
                  Everyone is guessing... waiting for the organizer to reveal.
                </p>
              </div>
            )}

            {/* Non-target — guessing phase */}
            {!isTarget && currentRound.status === 'guessing' && !submitted && session?.status === 'active' && (
              <div className="bg-slate-800 border-2 border-purple-600 rounded-2xl p-5">
                <div className="text-purple-400 font-black text-lg mb-1">Make your guess!</div>
                <p className="text-slate-300 text-sm mb-4">
                  What will{' '}
                  <span className="text-pink-300 font-bold">
                    {players.find((p) => p.id === currentRound.target_player_id)?.name}
                  </span>{' '}
                  answer?
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={myAnswer}
                  onChange={(e) => setMyAnswer(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && myAnswer.trim() && handleSubmitGuess(false)}
                  placeholder="Your guess..."
                  className="w-full bg-slate-700 border-2 border-slate-600 focus:border-purple-500 rounded-xl px-4 py-4 text-white text-3xl font-black text-center focus:outline-none transition-colors mb-3"
                  autoFocus
                />
                {session.show_reasoning && (
                  <textarea
                    value={myReasoning}
                    onChange={(e) => setMyReasoning(e.target.value)}
                    placeholder="Why? (optional reasoning...)"
                    className="w-full bg-slate-700 border border-slate-600 focus:border-purple-500 rounded-xl px-3 py-2 text-white placeholder-slate-400 text-sm resize-none focus:outline-none transition-colors mb-3"
                    rows={2}
                  />
                )}
                {submitError && (
                  <p className="text-red-400 text-sm mb-2">{submitError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSubmitGuess(false)}
                    disabled={submitting || !myAnswer.trim()}
                    className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-black text-lg rounded-xl transition-all"
                  >
                    {submitting ? 'Submitting...' : 'Submit Guess!'}
                  </button>
                  <button
                    onClick={() => handleSubmitGuess(true)}
                    disabled={submitting}
                    className="px-4 py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 font-bold rounded-xl transition-all text-sm"
                  >
                    Pass
                  </button>
                </div>
              </div>
            )}

            {/* Non-target — submitted, waiting for reveal */}
            {!isTarget && currentRound.status === 'guessing' && submitted && (
              <div className="bg-green-900/40 border border-green-500 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-green-300 font-black text-xl">Guess submitted!</div>
                <p className="text-slate-400 text-sm mt-2">
                  Waiting for the organizer to reveal answers...
                </p>
              </div>
            )}

            {/* Reveal phase */}
            {(currentRound.status === 'reveal' || currentRound.status === 'done') && (
              <div className="space-y-3">
                {revealCards.map((card, i) => (
                  <div key={card.id} id={`reveal-card-${i}`}>
                  <RevealCard
                    card={card}
                    visible={i < revealedCount}
                    targetAnswer={targetAnswer}
                    showHotCold={session.hot_cold_enabled && currentRound.status === 'reveal'}
                    winnerIds={(revealedCount >= revealCards.length && revealCards.length > 0) ? (revealWinnerNames.length > 0 ? revealCards.filter((c) => revealWinnerNames.includes(c.playerName)).map((c) => c.playerId ?? '') : winnerPlayer ? [winnerPlayer.id] : []) : []}
                  />
                  </div>
                ))}

                {/* Number line — shown when all cards revealed */}
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

                {currentRound.status === 'done' && (
                  <Leaderboard scores={scores} highlightId={playerId} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Question Bank submission — collapsible, hidden once game ends */}
        {session?.status !== 'ended' && <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <button
            onClick={() => {
              setShowQuestionForm((v) => !v)
              setQuestionAdded(false)
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
          >
            <span className="text-slate-300 text-sm font-semibold">📝 Suggest a question</span>
            <span className="text-slate-500 text-xs">{showQuestionForm ? '▲ close' : '▼ open'}</span>
          </button>

          {showQuestionForm && (
            <div className="px-4 pb-4 border-t border-slate-700">
              <p className="text-slate-400 text-xs mt-3 mb-2">
                The organizer can pick it for a future round.
              </p>
              {questionAdded ? (
                <div className="text-green-400 text-sm font-semibold text-center py-2">
                  ✅ Added to the question bank!
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
                    placeholder="How many X does [Target] have?"
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                  <button
                    onClick={handleAddQuestion}
                    disabled={addingQuestion || !newQuestion.trim()}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 text-white font-bold rounded-lg text-sm transition-colors shrink-0"
                  >
                    {addingQuestion ? '...' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>}
      </div>

      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
    </main>
  )
}
