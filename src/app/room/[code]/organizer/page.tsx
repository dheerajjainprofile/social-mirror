'use client'

import { useEffect, useState, useCallback, use, useRef, useMemo } from 'react'
import { encode as encodeQR } from 'uqr'
import { supabase } from '@/lib/supabase'
import Leaderboard from '@/components/Leaderboard'
import QuestionBank from '@/components/QuestionBank'
import SubmissionGrid from '@/components/SubmissionGrid'
import RevealCard, { RevealCardData } from '@/components/RevealCard'
import ConfettiBlast from '@/components/ConfettiBlast'
import Timer from '@/components/Timer'
import NumberLine, { NumberLinePoint } from '@/components/NumberLine'
import RoundRanking from '@/components/RoundRanking'
import RoundStartFlash from '@/components/RoundStartFlash'
import GameOverOrganizer from '@/components/GameOverOrganizer'
import { assignBadges, type GuessRecord, type RoundRecord, type PlayerBadge } from '@/lib/badgeLogic'
import { soundWinner, soundCrowd, soundCardReveal, unlockSound } from '@/lib/sounds'
import { useRouter } from 'next/navigation'
import WinnerReveal from '@/components/WinnerReveal'
import { getAdaptiveRevealDelay } from '@/lib/revealTiming'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'
import { getPlayerColorByIndex } from '@/lib/playerColors'
import { calculateScores } from '@/lib/utils'

interface Session {
  id: string
  room_code: string
  organizer_name: string
  scoring_mode: string
  reveal_mode: string
  show_reasoning: boolean
  hot_cold_enabled: boolean
  timer_seconds: number
  status: string
  paused_at?: string | null
  preset?: string
  pack_id?: string | null
  organizer_plays?: boolean
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
  question_id?: string | null
}

interface Question {
  id: string
  text: string
  source: string | null
  approved: boolean
  submitted_by: string | null
  energy_type?: string | null
  pack_id?: string | null
}

interface PlayerScore {
  playerId: string
  playerName: string
  totalPoints: number
  colorIndex?: number
}

export default function OrganizerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const playersRef = useRef<Player[]>([])
  const nextRoundEditorRef = useRef<HTMLDivElement>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [initialQuestionIds, setInitialQuestionIds] = useState<Set<string>>(new Set())
  const [scores, setScores] = useState<PlayerScore[]>([])
  const [submittedGuessIds, setSubmittedGuessIds] = useState<string[]>([])
  const [targetAnswerSubmitted, setTargetAnswerSubmitted] = useState(false)
  const [revealCards, setRevealCards] = useState<RevealCardData[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [targetAnswer, setTargetAnswer] = useState<number | null>(null)
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null)
  const [winners, setWinners] = useState<Player[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [numberLinePoints, setNumberLinePoints] = useState<NumberLinePoint[]>([])

  // Round setup state
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [customQuestion, setCustomQuestion] = useState('')
  const [targetPlayerId, setTargetPlayerId] = useState('')
  const [roundNumber, setRoundNumber] = useState(1)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [seedingQuestions, setSeedingQuestions] = useState(false)
  const [showRoundFlash, setShowRoundFlash] = useState(false)
  const [showWinnerReveal, setShowWinnerReveal] = useState(false)
  const [revealWinnerNames, setRevealWinnerNames] = useState<string[]>([])
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set())
  const builtCardsForRoundRef = useRef<string | null>(null)
  const refreshAllRef = useRef<((id: string) => Promise<void>) | null>(null)
  // Tracks last tab-resume timestamp — changing this forces Supabase subscription reconnect
  const [lastVisible, setLastVisible] = useState(0)

  // v3: Timer expiry prompts
  const [showTargetTimeoutPrompt, setShowTargetTimeoutPrompt] = useState(false)
  const [showGuesserTimeoutPrompt, setShowGuesserTimeoutPrompt] = useState(false)
  const timerFiredForRoundRef = useRef<string | null>(null)

  // v3: Reveal confirm dialog
  const [showRevealConfirm, setShowRevealConfirm] = useState(false)

  // v3: Suggested questions (top 3 after each round)
  const [suggestedQuestions, setSuggestedQuestions] = useState<Question[]>([])

  // v3: Auto target rotation queue
  const [rotationQueue, setRotationQueue] = useState<string[]>([])
  const rotationQueueRef = useRef<string[]>([])
  const rotationIndexRef = useRef<number>(0)

  // v3: Question event dedup — Set of keys to avoid duplicate analytics writes
  const loggedEventsRef = useRef<Set<string>>(new Set())

  const [organizerPlayerId, setOrganizerPlayerId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [skipToast, setSkipToast] = useState('')
  const [hostBadge, setHostBadge] = useState<PlayerBadge | null>(null)
  const hostBadgeComputedRef = useRef(false)

  // Host-as-player guess state
  const [orgGuessInput, setOrgGuessInput] = useState('')
  const [orgGuessReasoning, setOrgGuessReasoning] = useState('')
  const [orgGuessSubmitted, setOrgGuessSubmitted] = useState(false)
  const [orgGuessLoading, setOrgGuessLoading] = useState(false)

  // Guard: tracks which round has already had calculate-winner called — prevents infinite loop
  // when currentRound.status changes to 'done' and re-triggers the reveal effect
  const calculatedForRoundRef = useRef<string | null>(null)

  const isPartyMode = session?.preset === 'party'

  // QR code for lobby join link — uses runtime origin so local testing scans to the right host
  // (SSR-safe fallback to production URL for the server-rendered pass).
  const joinQR = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    const url = `${origin}/join?code=${code.toUpperCase()}`
    return encodeQR(url, { ecc: 'M' })
  }, [code])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSoundEnabled(localStorage.getItem('gtg_sound') !== 'false')
    }
  }, [])

  const loadScores = useCallback(async (sessionId: string, playerList: Player[], orgPlays?: boolean) => {
    const { data } = await supabase.from('scores').select('*').eq('session_id', sessionId)
    if (!data) return
    const totals: Record<string, number> = {}
    for (const s of data) totals[s.player_id] = (totals[s.player_id] ?? 0) + s.points
    const leaderboard = playerList
      .filter((p) => !p.is_organizer || orgPlays)
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      .map((p, idx) => ({ playerId: p.id, playerName: p.name, totalPoints: totals[p.id] ?? 0, colorIndex: idx }))
    setScores((prev) => {
      const same = prev.length === leaderboard.length &&
        prev.every((s, i) => s.playerId === leaderboard[i].playerId && s.totalPoints === leaderboard[i].totalPoints)
      return same ? prev : leaderboard
    })
  }, [])

  const loadRoundData = useCallback(async (round: Round) => {
    const { data: guesses } = await supabase
      .from('guesses').select('player_id').eq('round_id', round.id)
    setSubmittedGuessIds((guesses ?? []).map((g) => g.player_id))
    const { data: ta } = await supabase
      .from('target_answers').select('*').eq('round_id', round.id).single()
    setTargetAnswerSubmitted(!!ta)
    if (ta) setTargetAnswer(Number(ta.answer))
  }, [])

  const buildRevealCards = useCallback(async (round: Round, playerList: Player[]) => {
    const { data: guesses } = await supabase
      .from('guesses').select('*').eq('round_id', round.id).order('submitted_at', { ascending: true })
    const { data: ta } = await supabase
      .from('target_answers').select('*').eq('round_id', round.id).single()

    // Fetch players fresh from the DB so we don't silently drop a guesser whose row isn't in the
    // caller's stale playerList (late-joiner, reconnect, realtime lag). Merge the fresh list with
    // the passed-in one; fresh takes precedence, but any name already known is kept as fallback.
    const { data: freshPlayers } = await supabase
      .from('players').select('id, name').eq('session_id', round.session_id)
    const lookup = new Map<string, string>()
    for (const p of playerList) lookup.set(p.id, p.name)
    for (const p of freshPlayers ?? []) lookup.set(p.id, p.name)

    const cards: RevealCardData[] = []
    for (const g of guesses ?? []) {
      // Never silently drop a guess: fall back to a placeholder name so the player still appears
      // in reveal + round-results. Losing a guesser here was the root cause of the
      // "exact-match player missing from Round Results" bug.
      const playerName = lookup.get(g.player_id) ?? 'Player'
      cards.push({
        id: g.id,
        playerId: g.player_id,
        playerName,
        answer: g.passed ? null : Number(g.answer),
        reasoning: g.reasoning,
        passed: g.passed,
        autoPassed: g.auto_passed === true,
        isTarget: false,
      })
    }
    if (ta) {
      const targetPlayerName = lookup.get(round.target_player_id) ?? 'Target'
      cards.push({
        id: `target-${ta.id}`,
        playerId: round.target_player_id,
        playerName: targetPlayerName,
        answer: Number(ta.answer),
        isTarget: true,
      })
      setTargetAnswer(Number(ta.answer))

      const nlPoints: NumberLinePoint[] = []
      for (const g of guesses ?? []) {
        if (!g.passed && g.answer !== null) {
          const name = lookup.get(g.player_id) ?? 'Player'
          nlPoints.push({ playerName: name, answer: Number(g.answer), isTarget: false })
        }
      }
      nlPoints.push({ playerName: targetPlayerName, answer: Number(ta.answer), isTarget: true })
      setNumberLinePoints(nlPoints)
    }
    setRevealCards(cards)
    setRevealedCount(0)
  }, [])

  // v3: Build suggested questions for next round
  // preset is passed explicitly so this works during init() before session state is set
  const buildSuggestedQuestions = useCallback((
    allQuestions: Question[],
    usedIds: Set<string>,
    roundNum: number,
    sessionPackId: string | null | undefined,
    preset?: string | null,
    autoSelect: boolean = true
  ) => {
    const partyMode = preset != null ? preset === 'party' : isPartyMode
    if (!partyMode) {
      setSuggestedQuestions([])
      return
    }

    // Warmup phase: preloaded only. Mixed phase: also include approved player-submitted questions.
    const preloaded = allQuestions.filter(
      (q) => q.source === 'preloaded' && q.approved && !usedIds.has(q.id)
    )

    // Warm-up → Mixed transition: rounds 1-2 warmup only, 3-4 mixed (no savage), 5+ mixed + savage
    let pool: Question[]
    if (roundNum <= 2) {
      const warmup = preloaded.filter((q) => q.energy_type === 'warmup')
      pool = warmup.length >= 1 ? warmup : preloaded.filter((q) => q.energy_type !== 'savage')
    } else if (roundNum <= 4) {
      const playerSubmitted = allQuestions.filter(
        (q) => q.source !== 'preloaded' && q.approved && !usedIds.has(q.id)
      )
      pool = [
        ...preloaded.filter((q) => q.energy_type !== 'savage'),
        ...playerSubmitted,
      ]
    } else {
      // Round 5+: all packs including savage
      const playerSubmitted = allQuestions.filter(
        (q) => q.source !== 'preloaded' && q.approved && !usedIds.has(q.id)
      )
      pool = [...preloaded, ...playerSubmitted]
    }

    // If pack was selected at session level, prefer questions from that pack
    if (sessionPackId) {
      const fromPack = pool.filter((q) => q.pack_id === sessionPackId)
      if (fromPack.length >= 1) pool = fromPack
    }

    // Fallback if pool is empty: all unused approved questions
    const allUnused = allQuestions.filter((q) => q.approved && !usedIds.has(q.id))
    if (pool.length === 0) pool = allUnused
    if (pool.length === 0) {
      setSuggestedQuestions([])
      return
    }

    // Shuffle and take up to 3. Auto-select the first only if requested
    // (false when called from the "Change question" button, per DECISIONS-v3 R-9)
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const top3 = shuffled.slice(0, 3)
    setSuggestedQuestions(top3)
    if (autoSelect) {
      setSelectedQuestion(top3[0])
      setCustomQuestion('')
    }
  }, [isPartyMode])

  // v3: Build rotation queue from non-organizer players
  const buildRotationQueue = useCallback((playerList: Player[]) => {
    const nonOrg = playerList.filter((p) => !p.is_organizer)
    if (nonOrg.length === 0) return []
    // Randomise order
    const shuffled = [...nonOrg].sort(() => Math.random() - 0.5)
    return shuffled.map((p) => p.id)
  }, [])

  // Initial data load
  useEffect(() => {
    const init = async () => {
      const { data: sess } = await supabase
        .from('sessions').select('*').eq('room_code', code).single()
      if (!sess) { setError('Room not found'); setLoading(false); return }
      setSession(sess)

      const { data: playerData } = await supabase.from('players').select('*').eq('session_id', sess.id)
      const plist = playerData ?? []
      setPlayers(plist)
      playersRef.current = plist
      const orgPlayer = plist.find((p) => p.is_organizer)
      if (orgPlayer) setOrganizerPlayerId(orgPlayer.id)

      const { data: qData } = await supabase.from('questions').select('*').order('approved', { ascending: false })
      const loadedQuestions = qData ?? []
      setQuestions(loadedQuestions)
      setInitialQuestionIds(new Set(loadedQuestions.map((q) => q.id)))

      const { data: rounds } = await supabase
        .from('rounds').select('*').eq('session_id', sess.id)
        .order('round_number', { ascending: false }).limit(1)

      if (rounds && rounds.length > 0) {
        const round = rounds[0]
        setCurrentRound(round)
        setRoundNumber(round.round_number + 1)
        await loadRoundData(round)
        if (round.status === 'reveal' || round.status === 'done') {
          await buildRevealCards(round, plist)
          builtCardsForRoundRef.current = round.id
        }
        if (round.winner_player_id) {
          const wp = plist.find((p) => p.id === round.winner_player_id)
          if (wp) setWinnerPlayer(wp)
        }
        const { data: allRounds } = await supabase
          .from('rounds')
          .select('question_id')
          .eq('session_id', sess.id)
          .not('question_id', 'is', null)
        if (allRounds) {
          const usedIds = new Set(allRounds.map((r) => r.question_id as string))
          setUsedQuestionIds(usedIds)
          if (round.status === 'done') {
            buildSuggestedQuestions(loadedQuestions, usedIds, round.round_number + 1, sess.pack_id, sess.preset)
          }
        }
      } else {
        // Lobby with no rounds yet — auto-select question for round 1
        // Pass sess.preset directly (session state not yet set at this point)
        buildSuggestedQuestions(loadedQuestions, new Set(), 1, sess.pack_id, sess.preset)
      }

      // Init rotation queue for party mode
      if (sess.preset === 'party') {
        const queue = buildRotationQueue(plist)
        setRotationQueue(queue)
        rotationQueueRef.current = queue
        if (queue.length > 0 && !rounds?.length) {
          setTargetPlayerId(queue[0])
        }
      } else if (!rounds?.length) {
        // Non-party mode: auto-select a random target for round 1 so host doesn't have to
        const nonOrg = plist.filter((p) => !p.is_organizer)
        if (nonOrg.length > 0) {
          setTargetPlayerId(nonOrg[Math.floor(Math.random() * nonOrg.length)].id)
        }
      }

      await loadScores(sess.id, plist, sess.organizer_plays)
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const refreshAll = useCallback(async (sessionId: string) => {
    const { data: sessCheck } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
    if (sessCheck?.status === 'ended') return
    const { data: playerData } = await supabase.from('players').select('*').eq('session_id', sessionId)
    const plist = playerData ?? []
    setPlayers(plist)
    playersRef.current = plist

    // P0.1: Append late joiners to rotation queue if party mode is running
    const currentQueue = rotationQueueRef.current
    if (currentQueue.length > 0) {
      const nonOrg = plist.filter((p) => !p.is_organizer)
      const newPlayers = nonOrg.filter((p) => !currentQueue.includes(p.id))
      if (newPlayers.length > 0) {
        const updatedQueue = [...currentQueue, ...newPlayers.map((p) => p.id)]
        rotationQueueRef.current = updatedQueue
        setRotationQueue(updatedQueue)
      }
    }

    const { data: sess } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
    if (sess) setSession(sess)

    const { data: qData } = await supabase.from('questions').select('*').order('approved', { ascending: false })
    setQuestions(qData ?? [])

    const { data: rounds } = await supabase
      .from('rounds').select('*').eq('session_id', sessionId)
      .order('round_number', { ascending: false }).limit(1)

    if (rounds && rounds.length > 0) {
      const round = rounds[0]
      setCurrentRound(round)
      await loadRoundData(round)
      if ((round.status === 'reveal' || round.status === 'done') && builtCardsForRoundRef.current !== round.id) {
        await buildRevealCards(round, plist)
        builtCardsForRoundRef.current = round.id
      }
      if (round.winner_player_id) {
        const wp = plist.find((p) => p.id === round.winner_player_id)
        if (wp) setWinnerPlayer(wp)
        // Reconstruct winners from GUESSES (source of truth), not the derived scores table.
        // Reading scores creates a race: calculate-winner updates rounds.winner_player_id BEFORE
        // inserting scores, so a Realtime-triggered refresh can land with partial scores and
        // latch `winners` onto a subset — making only one player flash as winner in a 3-way tie.
        // Computing from guesses + target is deterministic and independent of score insert order.
        const { data: tgt } = await supabase
          .from('target_answers').select('answer').eq('round_id', round.id).maybeSingle()
        if (tgt) {
          const { data: grows } = await supabase
            .from('guesses').select('player_id, answer, submitted_at').eq('round_id', round.id).eq('passed', false)
          if (grows && grows.length > 0) {
            const entries = grows.map((g) => ({
              playerId: g.player_id,
              answer: Number(g.answer),
              submittedAt: g.submitted_at ?? '',
            }))
            const { data: sessRow } = await supabase.from('sessions').select('scoring_mode').eq('id', sessionId).single()
            const scoringMode = ((sessRow?.scoring_mode) ?? 'simple') as 'simple' | 'rich'
            const scored = calculateScores(entries, Number(tgt.answer), scoringMode)
            const maxPts = Math.max(...scored.map((s) => s.points))
            if (maxPts > 0) {
              const winnerIds = scored.filter((s) => s.points === maxPts).map((s) => s.playerId)
              const allWinners = plist.filter((p) => winnerIds.includes(p.id))
              if (allWinners.length > 0) setWinners(allWinners)
            }
          }
        }
      }
    }

    const { data: sessForScores } = await supabase.from('sessions').select('organizer_plays').eq('id', sessionId).single()
    await loadScores(sessionId, plist, sessForScores?.organizer_plays)
  }, [loadRoundData, buildRevealCards, loadScores])

  // Keep ref in sync so poll/visibilitychange always call latest refreshAll
  useEffect(() => { refreshAllRef.current = refreshAll }, [refreshAll])

  // Realtime subscriptions — reconnects when lastVisible changes (Safari kills WS in background).
  // Uses refreshAllRef.current to avoid capturing stale refreshAll closure.
  useEffect(() => {
    if (!session?.id) return
    const sessionId = session.id
    const channel = supabase
      .channel(`organizer-${sessionId}-${lastVisible}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` }, () => refreshAllRef.current?.(sessionId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, () => refreshAllRef.current?.(sessionId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `session_id=eq.${sessionId}` }, () => refreshAllRef.current?.(sessionId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guesses' }, () => refreshAllRef.current?.(sessionId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'target_answers' }, () => refreshAllRef.current?.(sessionId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `session_id=eq.${sessionId}` }, () => refreshAllRef.current?.(sessionId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session?.id, lastVisible])

  // Poll players every 3s while in lobby — realtime INSERT on players table is unreliable
  useEffect(() => {
    if (!session?.id || session.status !== 'lobby') return
    const poll = setInterval(async () => {
      const { data } = await supabase.from('players').select('*').eq('session_id', session.id)
      if (data) {
        setPlayers(data)
        playersRef.current = data
        // Auto-select target if none yet chosen (handles players joining after init())
        setTargetPlayerId((current) => {
          if (current) return current
          const nonOrg = data.filter((p: { is_organizer: boolean }) => !p.is_organizer)
          if (nonOrg.length === 0) return current
          return nonOrg[Math.floor(Math.random() * nonOrg.length)].id as string
        })
      }
    }, 3000)
    return () => clearInterval(poll)
  }, [session?.id, session?.status])

  // Active-game fallback poll — covers organizer laptop sleeping / network drop
  useEffect(() => {
    if (!session?.id || session.status === 'ended' || session.status === 'lobby') return
    const sessionId = session.id
    const poll = setInterval(() => { refreshAllRef.current?.(sessionId) }, 3000)
    return () => clearInterval(poll)
  }, [session?.id, session?.status])

  // visibilitychange — instant resync when organizer returns from lock screen / other tab
  useEffect(() => {
    if (!session?.id || session.status === 'ended') return
    const sessionId = session.id
    const onVisible = () => { if (!document.hidden) refreshAllRef.current?.(sessionId) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [session?.id, session?.status])

  // Scroll to top when game ends so organizer sees the game-over screen
  useEffect(() => {
    if (session?.status === 'ended') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [session?.status])

  // Force Supabase subscription reconnect on every tab-resume (Safari kills WS in background)
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setLastVisible(Date.now()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Poll questions every 5s
  useEffect(() => {
    if (!session) return
    const poll = setInterval(async () => {
      const { data: qData } = await supabase
        .from('questions').select('*').order('approved', { ascending: false })
      if (qData) setQuestions(qData)
    }, 5000)
    return () => clearInterval(poll)
  }, [session?.id])

  // Auto reveal cards one by one
  useEffect(() => {
    if (currentRound?.status !== 'reveal' && currentRound?.status !== 'done') return
    if (revealCards.length === 0) return
    // Freeze reveal progression while game is paused so host can actually pause mid-reveal
    if (session?.status === 'paused') return
    if (revealedCount >= revealCards.length) {
      // Guard: only call once per round. winners.length === 0 alone is not sufficient because
      // when the round has no winner (all passed), winners stays [] and the effect re-fires
      // every time currentRound.status changes (guessing→reveal→done), causing an infinite loop.
      if (calculatedForRoundRef.current !== currentRound?.id) {
        calculatedForRoundRef.current = currentRound?.id ?? null
        handleCalculateWinner()
      }
      return
    }
    const delay = getAdaptiveRevealDelay(revealedCount, revealCards.length)
    const t = setTimeout(() => {
      setRevealedCount((c) => c + 1)
      if (soundEnabled) soundCardReveal()
    }, delay)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, revealCards.length, currentRound?.status, session?.status, soundEnabled])

  // Auto-scroll to each newly revealed card
  useEffect(() => {
    if (revealedCount > 0) {
      document.getElementById(`reveal-card-${revealedCount - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [revealedCount])

  // Update number line winner markers
  useEffect(() => {
    if (!winnerPlayer || numberLinePoints.length === 0) return
    setNumberLinePoints((pts) =>
      pts.map((p) => ({ ...p, isWinner: !p.isTarget && p.playerName === winnerPlayer.name }))
    )
  }, [winnerPlayer, numberLinePoints.length])

  // P0.2: Log 'shown' event once per question per session when suggestions appear
  useEffect(() => {
    if (!session || suggestedQuestions.length === 0) return
    for (const q of suggestedQuestions) {
      const key = `shown:${q.id}`
      if (loggedEventsRef.current.has(key)) continue
      loggedEventsRef.current.add(key)
      fetch('/api/question-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          question_id: q.id,
          event_type: 'shown',
          energy_type: q.energy_type ?? null,
          pack_id: q.pack_id ?? null,
        }),
      }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedQuestions])

  // v3: Timer expiry handler
  const handleTimerExpire = useCallback(() => {
    if (!currentRound || timerFiredForRoundRef.current === currentRound.id) return
    timerFiredForRoundRef.current = currentRound.id

    if (!targetAnswerSubmitted) {
      // Case A: target hasn't answered yet
      setShowTargetTimeoutPrompt(true)
    } else {
      // Case B: target answered, not all guessers have submitted
      const nonOrgPlayers = playersRef.current.filter((p) => !p.is_organizer)
      const guessers = nonOrgPlayers.filter((p) => p.id !== currentRound.target_player_id)
      const allGuessed = guessers.every((p) => submittedGuessIds.includes(p.id))
      if (!allGuessed) {
        setShowGuesserTimeoutPrompt(true)
      }
    }
  }, [currentRound, targetAnswerSubmitted, submittedGuessIds])

  // Compute host badge for the "Share your badge" flow in GameOverOrganizer.
  // Runs once when session.status flips to 'ended' and host is an active player.
  const computeHostBadge = useCallback(async () => {
    if (hostBadgeComputedRef.current) return
    if (!session || !organizerPlayerId || !session.organizer_plays) return
    hostBadgeComputedRef.current = true

    const orgPlays = session.organizer_plays === true
    const eligiblePlayers = playersRef.current.filter((p) => !p.is_organizer || orgPlays)
    const playerNames: Record<string, string> = {}
    for (const p of eligiblePlayers) playerNames[p.id] = p.name

    const { data: allRounds } = await supabase
      .from('rounds').select('*').eq('session_id', session.id).order('round_number', { ascending: true })
    const roundIds = (allRounds ?? []).map((r) => r.id)
    const [{ data: allGuesses }, { data: allScores }, { data: allTargetAnswers }] = roundIds.length > 0
      ? await Promise.all([
          supabase.from('guesses').select('*').in('round_id', roundIds),
          supabase.from('scores').select('*').eq('session_id', session.id),
          supabase.from('target_answers').select('*').in('round_id', roundIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }]

    const roundRecords: RoundRecord[] = (allRounds ?? [])
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
      eligiblePlayers.map((p) => p.id),
      guessRecords,
      roundRecords,
      scoreRecords,
      playerNames
    )
    const mine = badges.find((b) => b.playerId === organizerPlayerId)
    if (!mine) return

    // Attach rank + bestDistance so viral copy can flex them
    const totalScores: Record<string, number> = {}
    for (const pid of eligiblePlayers.map((p) => p.id)) totalScores[pid] = 0
    for (const s of scoreRecords) totalScores[s.playerId] = (totalScores[s.playerId] ?? 0) + s.points
    const ranked = [...eligiblePlayers.map((p) => p.id)].sort((a, b) => (totalScores[b] ?? 0) - (totalScores[a] ?? 0))
    mine.rank = ranked.indexOf(organizerPlayerId) + 1 || undefined
    mine.totalPlayers = eligiblePlayers.length

    const myGuesses = guessRecords.filter((g) => g.playerId === organizerPlayerId && !g.passed && g.answer !== null)
    const distances = myGuesses.map((g) => {
      const rr = roundRecords.find((r) => r.roundId === g.roundId)
      return rr ? Math.abs(g.answer! - rr.targetAnswer) : null
    }).filter((d): d is number => d !== null)
    mine.bestDistance = distances.length > 0 ? Math.min(...distances) : null

    setHostBadge(mine)
  }, [session, organizerPlayerId])

  useEffect(() => {
    if (session?.status === 'ended') computeHostBadge()
  }, [session?.status, computeHostBadge])

  // v3: Advance rotation queue after round — returns the updated queue synchronously
  const advanceRotation = useCallback((completedTargetId: string): string[] => {
    let queue = [...rotationQueueRef.current]
    const idx = queue.indexOf(completedTargetId)
    if (idx !== -1) queue.splice(idx, 1)
    if (queue.length === 0) {
      const nonOrg = playersRef.current.filter((p) => !p.is_organizer)
      const shuffled = [...nonOrg].sort(() => Math.random() - 0.5)
      queue = shuffled.map((p) => p.id).filter((id) => id !== completedTargetId)
    }
    rotationQueueRef.current = queue
    setRotationQueue(queue)
    return queue
  }, [])

  const handleStartRound = async () => {
    if (!session) return
    // Unlock Web Audio inside the user gesture so auto-triggered sounds
    // (reveal animation, timer ticks) actually play on the host screen.
    unlockSound()
    const qText = selectedQuestion?.text || customQuestion.trim()
    if (!qText) { setError('Please select or enter a question'); return }
    if (!targetPlayerId) { setError('Please select a target player'); return }

    setActionLoading(true)
    setError('')
    setWinnerPlayer(null)
    setWinners([])
    setShowConfetti(false)
    setShowWinnerReveal(false)
    setRevealWinnerNames([])
    setNumberLinePoints([])
    setShowTargetTimeoutPrompt(false)
    setShowGuesserTimeoutPrompt(false)
    timerFiredForRoundRef.current = null
    calculatedForRoundRef.current = null

    try {
      const res = await fetch('/api/start-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          question_text: qText,
          target_player_id: targetPlayerId,
          round_number: roundNumber,
          question_id: selectedQuestion?.id ?? null,
          organizer_player_id: organizerPlayerId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to start round'); return }
      setSubmittedGuessIds([])
      setTargetAnswerSubmitted(false)
      builtCardsForRoundRef.current = null
      setRevealCards([])
      setRevealedCount(0)
      setTargetAnswer(null)
      setWinnerPlayer(null)
      setWinners([])
      setShowConfetti(false)
      setShowWinnerReveal(false)
      setRevealWinnerNames([])

      // Track used question
      if (selectedQuestion?.id) {
        setUsedQuestionIds((prev) => new Set([...prev, selectedQuestion.id]))
      }

      // P0.2: Log question_event 'picked' — now includes round_id and dedup
      if (selectedQuestion?.id && data.round?.id) {
        const key = `picked:${selectedQuestion.id}:${data.round.id}`
        if (!loggedEventsRef.current.has(key)) {
          loggedEventsRef.current.add(key)
          fetch('/api/question-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: session.id,
              round_id: data.round.id,
              question_id: selectedQuestion.id,
              event_type: 'picked',
              energy_type: selectedQuestion.energy_type ?? null,
              pack_id: selectedQuestion.pack_id ?? null,
              round_number: roundNumber,
            }),
          }).catch(() => {})
        }
      }

      setSelectedQuestion(null)
      setCustomQuestion('')
      setSuggestedQuestions([])
      setRoundNumber((n) => n + 1)
      setCurrentRound(data.round)
      // Immediately mark session active so the guessing UI renders without waiting for realtime
      setSession((s) => s ? { ...s, status: 'active' } : null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setShowRoundFlash(true)
      setOrgGuessInput('')
      setOrgGuessReasoning('')
      setOrgGuessSubmitted(false)
    } finally {
      setActionLoading(false)
    }
  }

  const handleTriggerReveal = async () => {
    if (!currentRound) return

    // v3: Confirm dialog if not all guessers have submitted
    const nonOrgPlayers = playersRef.current.filter((p) => !p.is_organizer)
    const guessers = nonOrgPlayers.filter((p) => p.id !== currentRound.target_player_id)
    const allGuessed = guessers.length === 0 || guessers.every((p) => submittedGuessIds.includes(p.id))

    if (!allGuessed && !showRevealConfirm) {
      setShowRevealConfirm(true)
      return
    }
    setShowRevealConfirm(false)
    setShowGuesserTimeoutPrompt(false)
    // Re-unlock AudioContext inside this user gesture so reveal-animation
    // sounds play even if the browser suspended audio since Start Round.
    unlockSound()

    setActionLoading(true)
    try {
      const res = await fetch('/api/trigger-reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: currentRound.id, organizer_player_id: organizerPlayerId }),
      })
      if (!res.ok) return
      await buildRevealCards(currentRound, playersRef.current)
      builtCardsForRoundRef.current = currentRound.id
      setCurrentRound((r) => r ? { ...r, status: 'reveal' } : null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleForceReveal = async () => {
    setShowRevealConfirm(false)
    setShowGuesserTimeoutPrompt(false)
    // Re-unlock AudioContext inside this user gesture (force-reveal button click).
    unlockSound()
    if (!currentRound) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/trigger-reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: currentRound.id, organizer_player_id: organizerPlayerId }),
      })
      if (!res.ok) return
      await buildRevealCards(currentRound, playersRef.current)
      builtCardsForRoundRef.current = currentRound.id
      setCurrentRound((r) => r ? { ...r, status: 'reveal' } : null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCalculateWinner = async () => {
    if (!currentRound) return
    const roundIdSnapshot = currentRound.id
    const questionIdSnapshot = currentRound.question_id ?? null
    const res = await fetch('/api/calculate-winner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round_id: roundIdSnapshot, organizer_player_id: organizerPlayerId }),
    })
    if (!res.ok) return
    const data = await res.json()

    // P0.2: Log 'completed' event after winner is determined
    if (session) {
      const key = `completed:${roundIdSnapshot}`
      if (!loggedEventsRef.current.has(key)) {
        loggedEventsRef.current.add(key)
        fetch('/api/question-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            round_id: roundIdSnapshot,
            question_id: questionIdSnapshot,
            event_type: 'completed',
          }),
        }).catch(() => {})
      }
    }

    if (data.winner) {
      const allWinners: Player[] = data.winners && data.winners.length > 0 ? data.winners : [data.winner]
      setWinnerPlayer(data.winner)
      setWinners(allWinners)
      setRevealWinnerNames(allWinners.map((w: Player) => w.name))
      setShowWinnerReveal(true)
      // Confetti only if organizer is playing AND is one of the winners
      const orgIsWinner = session?.organizer_plays && organizerPlayerId &&
        allWinners.some((w: Player) => w.id === organizerPlayerId)
      if (orgIsWinner) {
        setShowConfetti(true)
        if (soundEnabled) { soundWinner(); soundCrowd() }
        setTimeout(() => setShowConfetti(false), 5000)
      } else if (soundEnabled) {
        // Still play sounds for the reveal even if host didn't win
        soundCrowd()
      }
    }

    // v3: advance rotation and suggest next questions
    if (isPartyMode) {
      const nextQueue = advanceRotation(currentRound.target_player_id)
      const nextTarget = nextQueue[0] ?? ''
      if (nextTarget) setTargetPlayerId(nextTarget)
    }

    await loadScores(session!.id, playersRef.current, session?.organizer_plays)

    // Build suggestions for next round
    const nextRoundNum = roundNumber
    setUsedQuestionIds((prev) => {
      const updated = new Set(prev)
      if (currentRound.id) {/* already tracked at start */}
      buildSuggestedQuestions(questions, updated, nextRoundNum, session?.pack_id, session?.preset)
      return updated
    })
  }

  const handleSkipRound = async () => {
    if (!currentRound || !confirm('Skip this round? No points will be awarded.')) return
    setShowTargetTimeoutPrompt(false)
    setShowGuesserTimeoutPrompt(false)
    setActionLoading(true)
    const roundIdSnapshot = currentRound.id
    const questionIdSnapshot = currentRound.question_id ?? null
    try {
      await fetch('/api/skip-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: roundIdSnapshot, organizer_player_id: organizerPlayerId }),
      })
      setWinnerPlayer(null)
      setWinners([])

      // P0.2: Log 'skipped' event
      if (session) {
        const key = `skipped:${roundIdSnapshot}`
        if (!loggedEventsRef.current.has(key)) {
          loggedEventsRef.current.add(key)
          fetch('/api/question-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: session.id,
              round_id: roundIdSnapshot,
              question_id: questionIdSnapshot,
              event_type: 'skipped',
            }),
          }).catch(() => {})
        }
      }

      // Still advance rotation
      if (isPartyMode) {
        const nextQueue = advanceRotation(currentRound.target_player_id)
        const nextTarget = nextQueue[0] ?? ''
        if (nextTarget) setTargetPlayerId(nextTarget)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleOrgGuess = async (passed = false) => {
    if (!currentRound || !organizerPlayerId) return
    if (session?.status === 'paused') return
    const numAnswer = passed ? null : Number(orgGuessInput)
    if (!passed && (orgGuessInput.trim() === '' || isNaN(numAnswer as number))) return
    setOrgGuessLoading(true)
    try {
      const res = await fetch('/api/submit-guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round_id: currentRound.id,
          player_id: organizerPlayerId,
          answer: passed ? null : numAnswer,
          passed,
          reasoning: orgGuessReasoning.trim() || null,
        }),
      })
      if (res.ok) setOrgGuessSubmitted(true)
    } finally {
      setOrgGuessLoading(false)
    }
  }

  const handleRemovePlayer = async (removedId: string, playerName: string) => {
    if (!confirm(`Remove ${playerName} from the lobby?`)) return
    await fetch('/api/remove-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: removedId, organizer_player_id: organizerPlayerId }),
    })
    // Remove from rotation queue
    const updatedQueue = rotationQueueRef.current.filter((id) => id !== removedId)
    rotationQueueRef.current = updatedQueue
    setRotationQueue(updatedQueue)
    // If removed player was current target, skip the round
    if (currentRound && currentRound.target_player_id === removedId && currentRound.status === 'guessing') {
      await fetch('/api/skip-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: currentRound.id, organizer_player_id: organizerPlayerId }),
      })
      setSkipToast('Target player was removed — round skipped')
      setTimeout(() => setSkipToast(''), 4000)
    }
  }

  const handleToggleHotCold = async () => {
    if (!session) return
    const newValue = !session.hot_cold_enabled
    const res = await fetch('/api/update-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, updates: { hot_cold_enabled: newValue }, organizer_player_id: organizerPlayerId }),
    })
    if (res.ok) setSession((s) => s ? { ...s, hot_cold_enabled: newValue } : null)
  }

  // v3: Pause/resume
  // Client sends its last-known paused_at on resume as a fallback so the server can still shift
  // started_at correctly even if the sessions.paused_at column read returns stale/null.
  const handlePauseResume = async () => {
    if (!session) return
    const action = session.status === 'paused' ? 'resume' : 'pause'
    const body: Record<string, unknown> = { action, organizer_player_id: organizerPlayerId }
    if (action === 'resume' && session.paused_at) {
      body.paused_at = session.paused_at
    }
    const res = await fetch(`/api/session/${code}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      if (action === 'pause') {
        // Stamp paused_at locally so resume can reference it even before Realtime syncs the column.
        const nowIso = new Date().toISOString()
        setSession((s) => s ? { ...s, status: data.status, paused_at: nowIso } : null)
      } else {
        setSession((s) => s ? { ...s, status: data.status, paused_at: null } : null)
        if (data.started_at && currentRound) {
          setCurrentRound((r) => r ? { ...r, started_at: data.started_at } : null)
        }
      }
    }
  }

  const handleSaveImage = async () => {
    try {
      const res = await fetch(`/api/export-image/${code}`)
      if (!res.ok) { alert('Failed to generate image. Please try again.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `social-mirror-${code}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to save image. Please try again.')
    }
  }

  const handleEndGame = async () => {
    if (!session || !confirm('End the game? This cannot be undone.')) return
    setActionLoading(true)
    try {
      await fetch('/api/end-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, organizer_player_id: organizerPlayerId }),
      })
      setSession((s) => s ? { ...s, status: 'ended' } : null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddQuestion = async (text: string, source: string) => {
    const res = await fetch('/api/add-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source, auto_approve: true }),
    })
    const data = await res.json()
    if (data.question) setQuestions((prev) => [...prev, data.question])
  }

  const handleApproveQuestion = async (id: string) => {
    const res = await fetch('/api/approve-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: id }),
    })
    const data = await res.json()
    if (data.question) setQuestions((prev) => prev.map((q) => (q.id === id ? data.question : q)))
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return
    const res = await fetch('/api/delete-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: id }),
    })
    if (res.ok) setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const handleSeedQuestions = async () => {
    setSeedingQuestions(true)
    try {
      const res = await fetch('/api/seed-questions', { method: 'POST' })
      const data = await res.json()
      if (data.questions) {
        setQuestions((prev) => [
          ...prev.filter((q) => q.source !== 'preloaded'),
          ...data.questions,
        ])
        setInitialQuestionIds((prev) => {
          const updated = new Set(prev)
          ;(data.questions as Question[]).forEach((q) => updated.add(q.id))
          return updated
        })
      }
    } finally {
      setSeedingQuestions(false)
    }
  }

  const exportResults = async () => {
    if (!session) return
    const { data: rounds } = await supabase
      .from('rounds').select('*').eq('session_id', session.id).order('round_number', { ascending: true })

    const lines = [
      `Social Mirror — Room ${code}`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Organizer: ${session.organizer_name}`,
      `Scoring Mode: ${session.scoring_mode}`,
      '',
      '=== FINAL SCORES ===',
      ...scores
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .map((s, i) => `${i + 1}. ${s.playerName}: ${s.totalPoints} pts`),
      '',
    ]

    for (const round of rounds ?? []) {
      lines.push(`--- ROUND ${round.round_number}: ${round.question_text} ---`)
      const targetPlayer = playersRef.current.find((p) => p.id === round.target_player_id)
      lines.push(`Target: ${targetPlayer?.name ?? '?'}`)

      const { data: ta } = await supabase
        .from('target_answers').select('*').eq('round_id', round.id).single()
      if (ta) lines.push(`Target's answer: ${ta.answer}`)

      const { data: guesses } = await supabase
        .from('guesses').select('*').eq('round_id', round.id).order('submitted_at')
      for (const g of guesses ?? []) {
        const gPlayer = playersRef.current.find((p) => p.id === g.player_id)
        const status = g.passed
          ? 'Passed'
          : `Guessed: ${g.answer}${g.reasoning ? ` ("${g.reasoning}")` : ''}`
        lines.push(`  ${gPlayer?.name ?? '?'}: ${status}`)
      }

      if (round.winner_player_id) {
        const winner = playersRef.current.find((p) => p.id === round.winner_player_id)
        lines.push(`Winner: ${winner?.name ?? '?'}`)
      } else {
        lines.push('Winner: None (skipped or no guesses)')
      }
      lines.push('')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `social-mirror-${code}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl font-bold animate-pulse">Loading room...</div>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    )
  }

  const allRevealed = revealedCount >= revealCards.length && revealCards.length > 0
  const nonOrgPlayers = players.filter((p) => !p.is_organizer)
  const guessers = currentRound
    ? nonOrgPlayers.filter((p) => p.id !== currentRound.target_player_id)
    : []
  const submittedCount = guessers.filter((p) => submittedGuessIds.includes(p.id)).length

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <ConfettiBlast trigger={showConfetti} />
      <WinnerReveal
        winnerNames={revealWinnerNames}
        visible={showWinnerReveal}
        onDone={() => setShowWinnerReveal(false)}
      />
      <RoundStartFlash
        roundNumber={currentRound?.round_number ?? roundNumber}
        trigger={showRoundFlash}
        onDone={() => setShowRoundFlash(false)}
      />

      {/* Header — Option A: two-row stack.
          Row 1 = identity (logo + room code) left, icon-only actions right.
          Row 2 = mode chip + status. Keeps alignment on all viewports; never wraps. */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        {/* Row 1: identity ↔ actions */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <SocialMirrorLogo size={36} />
            <div className="min-w-0">
              <div className="text-white font-black text-sm tracking-tight leading-none">Social Mirror</div>
              <div className="text-xl font-black text-yellow-400 tracking-widest leading-none mt-0.5">{code}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled
                setSoundEnabled(next)
                if (next) unlockSound()
                if (typeof window !== 'undefined') localStorage.setItem('gtg_sound', next ? 'true' : 'false')
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-base"
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
              aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? '🔔' : '🔕'}
            </button>
            <a
              href={`/room/${code}/present`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-base"
              title="Open presenter view"
              aria-label="Open presenter view"
            >
              📺
            </a>
            {session?.status === 'active' && (
              <button
                type="button"
                onClick={handlePauseResume}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-yellow-900/60 hover:bg-yellow-800/80 text-yellow-300 text-base"
                title="Pause game"
                aria-label="Pause game"
              >
                ⏸
              </button>
            )}
            {session?.status === 'paused' && (
              <button
                type="button"
                onClick={handlePauseResume}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-900/60 hover:bg-green-800/80 text-green-300 text-base"
                title="Resume game"
                aria-label="Resume game"
              >
                ▶
              </button>
            )}
            <button
              type="button"
              onClick={handleEndGame}
              disabled={actionLoading || session?.status === 'ended'}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-900/60 hover:bg-red-800/80 disabled:opacity-40 text-red-300 text-base"
              title="End game"
              aria-label="End game"
            >
              ⛔
            </button>
          </div>
        </div>

        {/* Row 2: mode chip + status */}
        <div className="px-4 pb-2 flex items-center gap-2 text-xs">
          {isPartyMode ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-200 font-bold">
              ⚡ Quick Start
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 font-bold">
              ⚙️ Custom
            </span>
          )}
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 font-semibold">
            {session?.status === 'lobby' ? 'Lobby'
              : session?.status === 'ended' ? 'Game Ended'
              : session?.status === 'paused' ? '⏸ Paused'
              : `Round ${currentRound?.round_number ?? 1}`}
          </span>
        </div>
      </header>

      {/* Paused banner on all screens */}
      {session?.status === 'paused' && (
        <div className="bg-yellow-900/40 border-b border-yellow-700 px-4 py-3 text-center">
          <div className="text-yellow-300 font-bold">⏸ Game is paused</div>
          <button
            onClick={handlePauseResume}
            className="mt-2 px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg text-sm"
          >
            ▶ Resume Game
          </button>
        </div>
      )}

      <div className={`max-w-2xl mx-auto p-4 space-y-4 ${currentRound?.status === 'done' ? 'pb-28' : ''}`}>
        {error && (
          <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {skipToast && (
          <div className="bg-yellow-900/40 border border-yellow-600 text-yellow-300 rounded-xl px-4 py-3 text-sm text-center">
            {skipToast}
          </div>
        )}

        {/* v3: Timer expiry — Case A: target hasn't answered */}
        {showTargetTimeoutPrompt && currentRound && (
          <div className="bg-orange-900/40 border-2 border-orange-500 rounded-2xl p-5 text-center">
            <div className="text-3xl mb-2">⏱️</div>
            <div className="text-orange-300 font-black text-lg mb-1">Time&apos;s up!</div>
            <p className="text-slate-300 text-sm mb-4">
              <span className="text-pink-300 font-bold">
                {players.find((p) => p.id === currentRound.target_player_id)?.name}
              </span>{' '}
              hasn&apos;t answered yet.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSkipRound}
                disabled={actionLoading}
                className="px-5 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all"
              >
                Skip this round
              </button>
              <button
                onClick={() => setShowTargetTimeoutPrompt(false)}
                className="px-5 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl text-sm transition-all"
              >
                Wait for them
              </button>
            </div>
          </div>
        )}

        {/* v3: Timer expiry — Case B: guessers haven't all submitted */}
        {showGuesserTimeoutPrompt && currentRound && !showTargetTimeoutPrompt && (
          <div className="bg-yellow-900/40 border-2 border-yellow-600 rounded-2xl p-5 text-center">
            <div className="text-3xl mb-2">⏱️</div>
            <div className="text-yellow-300 font-black text-lg mb-1">Time&apos;s up!</div>
            <p className="text-slate-300 text-sm mb-4">
              {submittedCount} of {guessers.length} players have guessed.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleForceReveal}
                disabled={actionLoading || !targetAnswerSubmitted}
                className="px-5 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all"
              >
                Reveal now
              </button>
              <button
                onClick={() => setShowGuesserTimeoutPrompt(false)}
                className="px-5 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl text-sm transition-all"
              >
                Wait a moment
              </button>
            </div>
          </div>
        )}

        {/* v3: Reveal confirm dialog */}
        {showRevealConfirm && currentRound && (
          <div className="bg-slate-800 border-2 border-yellow-600 rounded-2xl p-5 text-center">
            <div className="text-yellow-300 font-black text-lg mb-2">
              Only {submittedCount} of {guessers.length} players have guessed.
            </div>
            <p className="text-slate-400 text-sm mb-4">Reveal anyway?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleForceReveal}
                disabled={actionLoading}
                className="px-5 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl text-sm"
              >
                Yes, reveal now
              </button>
              <button
                onClick={() => setShowRevealConfirm(false)}
                className="px-5 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl text-sm"
              >
                Keep waiting
              </button>
            </div>
          </div>
        )}

        {/* Game Ended */}
        {session?.status === 'ended' && (
          <GameOverOrganizer
            sessionId={session.id}
            organizerName={session.organizer_name}
            roomCode={code}
            scoringMode={session.scoring_mode}
            roundsPlayed={roundNumber - 1}
            playerCount={players.filter((p) => !p.is_organizer).length}
            packId={session.pack_id ?? null}
            organizerPlayerId={organizerPlayerId}
            organizerPlays={session.organizer_plays}
            hostBadge={hostBadge}
            winnerName={[...scores].sort((a, b) => b.totalPoints - a.totalPoints)[0]?.playerName}
            winnerPoints={[...scores].sort((a, b) => b.totalPoints - a.totalPoints)[0]?.totalPoints}
            onSaveImage={handleSaveImage}
            onExportTxt={exportResults}
          />
        )}

        {/* Lobby */}
        {session?.status === 'lobby' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-xl font-black text-white mb-1">Lobby</h2>
            <p className="text-slate-400 text-sm mb-4">
              Share the code or link below so players can join
            </p>

            {/* QR code + share */}
            <div className="flex items-start gap-5 mb-4">
              <div className="bg-white p-2 rounded-xl inline-block shrink-0">
                <div style={{ lineHeight: 0 }}>
                  {Array.from({ length: joinQR.size }, (_, y) => (
                    <div key={y} style={{ display: 'flex', height: 4 }}>
                      {Array.from({ length: joinQR.size }, (_, x) => (
                        <div
                          key={x}
                          style={{
                            width: 4,
                            height: 4,
                            flexShrink: 0,
                            background: joinQR.data[y][x] ? '#000' : '#fff',
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-1 flex flex-col gap-2">
                <div className="text-slate-300 text-xs font-semibold">Scan to join</div>
                <button
                  type="button"
                  onClick={async () => {
                    const joinUrl = `${window.location.origin}/join?code=${code.toUpperCase()}`
                    // 1. Try Web Share API (works in secure contexts on iOS / Android / Chrome)
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: 'Join my Social Mirror session!', url: joinUrl })
                        return
                      }
                    } catch (err) {
                      // User dismissed the share sheet → stop here, don't cascade into fallbacks.
                      // AbortError is thrown by navigator.share when the user cancels.
                      if ((err as Error)?.name === 'AbortError') return
                      // Any other error — fall through to clipboard.
                    }
                    // 2. Try Clipboard API (HTTPS/localhost only — undefined on LAN-IP HTTP)
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard?.writeText(joinUrl)
                        alert('Link copied!')
                        return
                      }
                    } catch { /* clipboard write denied or unavailable */ }
                    // 3. Last resort — show the URL in a prompt so the user can long-press to copy.
                    //    This path is what runs on iOS Safari over plain HTTP (dev LAN testing),
                    //    where both navigator.share and navigator.clipboard are undefined.
                    window.prompt('Copy this join link:', joinUrl)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                  style={{ touchAction: 'manipulation' }}
                >
                  📤 Share join link
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-slate-300 text-sm font-semibold mb-2">
                Players joined ({players.filter((p) => !p.is_organizer).length})
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <div key={p.id} className="flex items-center gap-1 px-3 py-1 bg-slate-700 rounded-full text-sm text-white border border-slate-600">
                    {p.name}
                    {p.is_organizer && <span className="text-purple-400 ml-1">(host)</span>}
                    {!p.is_organizer && (
                      <button
                        onClick={() => handleRemovePlayer(p.id, p.name)}
                        className="text-slate-500 hover:text-red-400 ml-1 transition-colors text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {players.filter((p) => !p.is_organizer).length < 1 ? (
              <p className="text-slate-500 text-sm italic">Waiting for at least 1 player to join...</p>
            ) : (() => {
              const nonOrgCount = players.filter((p) => !p.is_organizer).length
              const noGuessers = nonOrgCount <= 1 && !session?.organizer_plays
              return (
              <div className="space-y-3">
                {noGuessers && (
                  <div className="bg-amber-900/40 border border-amber-600 text-amber-300 rounded-xl px-4 py-3 text-sm">
                    With only 1 player and you not playing, there&apos;s nobody to guess! Either turn on &quot;I&apos;ll play too&quot; in game settings or wait for more players.
                  </div>
                )}
                <div>
                  <label className="block text-slate-300 text-sm font-semibold mb-2">First Question</label>
                  {selectedQuestion ? (
                    <div className="flex items-start justify-between gap-2 p-3 bg-purple-900/60 border border-purple-500 rounded-xl">
                      <span className="text-purple-100 text-sm">{selectedQuestion.text}</span>
                      <button onClick={() => setSelectedQuestion(null)} className="text-slate-400 hover:text-white text-lg shrink-0">×</button>
                    </div>
                  ) : (
                    <textarea
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      placeholder="Type a question or pick from Question Bank below..."
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white placeholder-slate-400 text-sm resize-none focus:outline-none focus:border-purple-500"
                      rows={2}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-semibold mb-2">
                    Target Player (who will answer)
                    {isPartyMode && <span className="text-purple-400 ml-2 font-normal text-xs">Auto-rotation on</span>}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {players.filter((p) => !p.is_organizer).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setTargetPlayerId(p.id)}
                        className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                          targetPlayerId === p.id
                            ? 'bg-pink-900/50 border-pink-500 text-pink-200'
                            : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleStartRound}
                  disabled={actionLoading || (!selectedQuestion && !customQuestion.trim()) || !targetPlayerId || noGuessers}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-black text-lg rounded-xl transition-all"
                >
                  {actionLoading ? 'Starting...' : 'Start Game!'}
                </button>
              </div>
              )
            })()}
          </div>
        )}

        {/* Active Round */}
        {currentRound && (session?.status === 'active' || session?.status === 'paused') && (
          <div className="space-y-4">
            {/* Question display + hot/cold toggle */}
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-800 border border-purple-700 rounded-2xl p-4 md:p-5">
              {/* Row 1: Round label + Hot/Cold button inline */}
              <div className="flex items-center justify-between mb-2">
                <div className="text-purple-400 text-xs uppercase tracking-wider">
                  Round {currentRound.round_number}
                </div>
                <button
                  onClick={handleToggleHotCold}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    session?.hot_cold_enabled
                      ? 'bg-orange-900/60 border border-orange-500 text-orange-300'
                      : 'bg-slate-700 border border-slate-600 text-slate-400'
                  }`}
                >
                  {session?.hot_cold_enabled ? '🔥 Hot/Cold ON' : '❄️ Hot/Cold OFF'}
                </button>
              </div>
              {/* When organizer is playing and is NOT the target, show player-style "GUESS WHAT" header */}
              {session?.organizer_plays && organizerPlayerId && currentRound.target_player_id !== organizerPlayerId && (() => {
                const targetIdx = players.filter(p => !p.is_organizer).findIndex(p => p.id === currentRound.target_player_id)
                const targetColor = getPlayerColorByIndex(targetIdx >= 0 ? targetIdx : 0)
                const targetName = players.find((p) => p.id === currentRound.target_player_id)?.name ?? '?'
                return (
                  <div className="mb-2">
                    <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">🎯 Guess what </span>
                    <span className={`text-lg font-black ${targetColor.text}`}>{targetName}</span>
                    <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider"> will say</span>
                  </div>
                )
              })()}
              <p className="text-white text-xl font-bold leading-snug">{currentRound.question_text}</p>
              {/* Show target name in small text only when organizer is NOT playing (already shown above otherwise) */}
              {(!session?.organizer_plays || currentRound.target_player_id === organizerPlayerId) && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-slate-400 text-sm">Target:</span>
                  <span className="text-pink-300 font-semibold text-sm">
                    {players.find((p) => p.id === currentRound.target_player_id)?.name ?? '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Timer — in guessing phase */}
            {session && session.timer_seconds > 0 && currentRound.started_at && currentRound.status === 'guessing' && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <Timer
                  startedAt={currentRound.started_at ?? null}
                  durationSeconds={session.timer_seconds}
                  onExpire={handleTimerExpire}
                  paused={session.status === 'paused'}
                />
              </div>
            )}

            {/* Guessing phase */}
            {currentRound.status === 'guessing' && (
              <div className="space-y-4">
                <SubmissionGrid
                  players={players}
                  submittedIds={submittedGuessIds}
                  targetPlayerId={currentRound.target_player_id}
                  label="Guesses submitted"
                  organizerPlays={session?.organizer_plays}
                />

                {/* Host guess input — only when organizer_plays and not the target */}
                {session?.organizer_plays && organizerPlayerId && currentRound.target_player_id !== organizerPlayerId && (
                  <div className="bg-purple-900/20 border-2 border-purple-500/40 rounded-2xl p-4">
                    <div className="text-purple-300 text-xs font-bold uppercase tracking-wider mb-3">
                      🎮 Your guess (host)
                    </div>
                    {orgGuessSubmitted ? (
                      <div className="text-center py-3">
                        <span className="text-green-400 font-bold">✓ Guess submitted!</span>
                      </div>
                    ) : session?.status === 'paused' ? (
                      <div className="text-center py-3 text-yellow-400 text-sm font-semibold">⏸ Paused — resume to submit</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                            value={orgGuessInput}
                            onChange={(e) => setOrgGuessInput(e.target.value.replace(/[^0-9]/g, ''))}
                            onKeyDown={(e) => e.key === 'Enter' && orgGuessInput.trim() && handleOrgGuess()}
                            placeholder="Your number…"
                            className="flex-1 min-w-0 bg-slate-800 border border-purple-500/50 focus:border-purple-400 rounded-xl px-3 py-2 text-white placeholder-slate-500 text-lg font-bold focus:outline-none"
                          />
                          <button
                            onClick={() => handleOrgGuess()}
                            disabled={orgGuessLoading || orgGuessInput.trim() === ''}
                            className="shrink-0 px-4 sm:px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
                          >
                            {orgGuessLoading ? '…' : 'Submit'}
                          </button>
                          <button
                            onClick={() => handleOrgGuess(true)}
                            disabled={orgGuessLoading}
                            className="shrink-0 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold rounded-xl transition-all text-sm"
                          >
                            Pass
                          </button>
                        </div>
                        {session?.show_reasoning && (
                          <input
                            type="text"
                            value={orgGuessReasoning}
                            onChange={(e) => setOrgGuessReasoning(e.target.value)}
                            placeholder="Your reasoning (optional)..."
                            maxLength={120}
                            className="w-full bg-slate-800 border border-slate-600 focus:border-purple-400 rounded-xl px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!targetAnswerSubmitted && (
                  <div className="text-center text-slate-400 text-sm py-2">
                    ⏳ Waiting for <span className="text-pink-300 font-semibold">{players.find((p) => p.id === currentRound.target_player_id)?.name}</span> to submit their answer...
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleTriggerReveal}
                    disabled={actionLoading || !targetAnswerSubmitted}
                    className="flex-1 min-w-0 py-4 px-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-black text-base sm:text-lg rounded-xl transition-all truncate"
                  >
                    {actionLoading ? 'Loading…' : !targetAnswerSubmitted ? 'Waiting for target…' : 'Reveal Answers! 🎭'}
                  </button>
                  <button
                    onClick={handleSkipRound}
                    disabled={actionLoading}
                    className="shrink-0 px-4 py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 font-bold rounded-xl transition-all text-sm"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* Reveal / Done phase */}
            {(currentRound.status === 'reveal' || currentRound.status === 'done') && (
              <div className="space-y-3">
                {revealCards.map((card, i) => (
                  <div key={card.id} id={`reveal-card-${i}`}>
                  <RevealCard
                    card={card}
                    visible={i < revealedCount}
                    targetAnswer={targetAnswer}
                    showHotCold={session?.hot_cold_enabled && currentRound.status === 'reveal'}
                    winnerIds={allRevealed ? winners.map((w) => w.id) : []}
                  />
                  </div>
                ))}

                {allRevealed && numberLinePoints.length > 0 && (
                  <NumberLine points={numberLinePoints} />
                )}

                {allRevealed && targetAnswer !== null && (
                  <RoundRanking
                    cards={revealCards}
                    targetAnswer={targetAnswer}
                    scoringMode={(session?.scoring_mode ?? 'simple') as 'simple' | 'rich'}
                  />
                )}

                {currentRound.status === 'done' && (
                  <div className="pt-4 space-y-3">
                    <div ref={nextRoundEditorRef} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 scroll-mt-24">
                      <h3 className="text-white font-bold">Start Next Round</h3>

                      {/* v3: Suggested questions (Party Mode) */}
                      {isPartyMode && (
                        <div>
                          {selectedQuestion ? (
                            <div className="flex items-start justify-between gap-2 p-3 bg-purple-900/60 border border-purple-500 rounded-xl">
                              <div>
                                <div className="text-xs text-purple-400 font-semibold mb-1">✅ Selected</div>
                                <span className="text-purple-100 text-sm">{selectedQuestion.text}</span>
                              </div>
                              <button
                                onClick={() => { setSelectedQuestion(null); setCustomQuestion(''); setSuggestedQuestions([]); buildSuggestedQuestions(questions, usedQuestionIds, roundNumber, session?.pack_id, session?.preset, false) }}
                                className="text-slate-400 hover:text-white text-xs shrink-0 underline"
                              >
                                ✕ Change question
                              </button>
                            </div>
                          ) : suggestedQuestions.length > 0 ? (
                            <>
                              <label className="block text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">
                                ✨ Suggested for next round
                              </label>
                              <div className="space-y-2">
                                {suggestedQuestions.map((q) => (
                                  <button
                                    key={q.id}
                                    onClick={() => { setSelectedQuestion(q); setCustomQuestion('') }}
                                    className="w-full text-left p-3 rounded-xl border text-sm transition-all bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500"
                                  >
                                    {q.text}
                                    {q.energy_type && (
                                      <span className="ml-2 text-xs text-slate-500 capitalize">[{q.energy_type}]</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => setSuggestedQuestions([])}
                                className="text-slate-500 hover:text-slate-400 text-xs mt-1 underline"
                              >
                                Browse all questions ↓
                              </button>
                            </>
                          ) : null}
                        </div>
                      )}

                      {(!isPartyMode || suggestedQuestions.length === 0) && (
                        <div>
                          <label className="block text-slate-300 text-sm font-semibold mb-2">Question</label>
                          {selectedQuestion ? (
                            <div className="flex items-start justify-between gap-2 p-3 bg-purple-900/60 border border-purple-500 rounded-xl">
                              <span className="text-purple-100 text-sm">{selectedQuestion.text}</span>
                              <button onClick={() => setSelectedQuestion(null)} className="text-slate-400 hover:text-white text-lg shrink-0">×</button>
                            </div>
                          ) : (
                            <textarea
                              value={customQuestion}
                              onChange={(e) => setCustomQuestion(e.target.value)}
                              placeholder="Type a question or pick from Question Bank..."
                              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white placeholder-slate-400 text-sm resize-none focus:outline-none focus:border-purple-500"
                              rows={2}
                            />
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-slate-300 text-sm font-semibold mb-2">
                          Target Player
                          {isPartyMode && rotationQueue.length > 0 && (
                            <span className="text-purple-400 ml-2 font-normal text-xs">
                              Auto: {players.find((p) => p.id === rotationQueue[0])?.name ?? '?'}
                            </span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {players.filter((p) => !p.is_organizer).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => setTargetPlayerId(p.id)}
                              className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                                targetPlayerId === p.id
                                  ? 'bg-pink-900/50 border-pink-500 text-pink-200'
                                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard — only when round is done or ended (context for next round) */}
        {(session?.status === 'ended' || currentRound?.status === 'done') && (
          <Leaderboard scores={scores} />
        )}

        {/* Question Bank — only in lobby or when preparing next round */}
        {(session?.status === 'lobby' || currentRound?.status === 'done') && (
          <QuestionBank
            questions={questions}
            onSelect={(q) => { setSelectedQuestion(q); setCustomQuestion('') }}
            onApprove={handleApproveQuestion}
            onAdd={handleAddQuestion}
            onDelete={handleDeleteQuestion}
            onSeed={process.env.NEXT_PUBLIC_DEV_MODE === 'true' ? handleSeedQuestions : undefined}
            seedingQuestions={seedingQuestions}
            selectedId={selectedQuestion?.id}
            initialQuestionIds={initialQuestionIds}
            usedQuestionIds={usedQuestionIds}
            sessionPackId={session?.pack_id}
          />
        )}
      </div>

      {/* Sticky Next Round CTA — floats at bottom when a round is done.
          Hidden while WinnerReveal is visible so the two don't stack at the bottom of the viewport. */}
      {currentRound?.status === 'done' && session?.status !== 'ended' && !showWinnerReveal && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto space-y-2">
            {/* Question preview — shows what's queued so host doesn't need to scroll */}
            {(selectedQuestion || customQuestion.trim()) && (
              <button
                type="button"
                onClick={() => nextRoundEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="w-full px-4 py-2.5 bg-purple-950/80 border border-purple-500/50 rounded-xl text-left flex items-center gap-2 hover:bg-purple-900/60 transition-colors"
              >
                <span className="text-purple-400 font-bold text-xs uppercase tracking-wider shrink-0">Next Q</span>
                <span className="text-purple-200 text-xs font-semibold truncate flex-1">{selectedQuestion?.text ?? customQuestion.trim()}</span>
                <span className="text-purple-500 text-xs shrink-0">↑ change</span>
              </button>
            )}
            <button
              onClick={handleStartRound}
              disabled={actionLoading || (!selectedQuestion && !customQuestion.trim()) || !targetPlayerId}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 text-white font-black text-lg rounded-2xl shadow-[0_0_32px_rgba(139,92,246,0.35)] cursor-pointer"
            >
              {actionLoading
                ? 'Starting...'
                : !targetPlayerId
                ? '👆 Pick a target player above'
                : !selectedQuestion && !customQuestion.trim()
                ? '👆 Pick a question above'
                : `▶ Start Round ${roundNumber}`}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
