import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase'
import { assignBadges, type GuessRecord, type RoundRecord } from '@/lib/badgeLogic'
import { loadOgFonts } from '@/lib/ogFonts'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string; playerId: string }> }
) {
  const { sessionId, playerId } = await params

  // Fetch session
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

  // Fetch players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('session_id', sessionId)

  const nonOrgPlayers = (players ?? []).filter((p) => !p.is_organizer || session.organizer_plays)
  const playerNames: Record<string, string> = {}
  for (const p of players ?? []) playerNames[p.id] = p.name

  // Fetch rounds
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: true })

  // Fetch guesses
  const roundIds = (rounds ?? []).map((r) => r.id)
  const { data: guessesData } = roundIds.length > 0
    ? await supabase.from('guesses').select('*').in('round_id', roundIds)
    : { data: [] }

  // Fetch target answers
  const { data: targetAnswers } = roundIds.length > 0
    ? await supabase.from('target_answers').select('*').in('round_id', roundIds)
    : { data: [] }

  // Fetch scores
  const { data: scoresData } = await supabase
    .from('scores')
    .select('*')
    .eq('session_id', sessionId)

  // Build typed records
  const roundRecords: RoundRecord[] = (rounds ?? []).map((r) => {
    const ta = (targetAnswers ?? []).find((t) => t.round_id === r.id)
    return {
      roundId: r.id,
      targetPlayerId: r.target_player_id,
      targetAnswer: ta ? Number(ta.answer) : 0,
    }
  }).filter((r) => r.targetAnswer !== 0 || (targetAnswers ?? []).some((t) => t.round_id === r.roundId))

  const guessRecords: GuessRecord[] = (guessesData ?? []).map((g) => ({
    playerId: g.player_id,
    roundId: g.round_id,
    answer: g.passed ? null : Number(g.answer),
    passed: g.passed,
    autoPassed: g.auto_passed === true,
    submittedAt: g.submitted_at ?? undefined,
  }))

  const scoreRecords = (scoresData ?? []).map((s) => ({
    playerId: s.player_id,
    roundId: s.round_id,
    points: s.points,
  }))

  const playerIdList = nonOrgPlayers.map((p) => p.id)
  const badges = assignBadges(playerIdList, guessRecords, roundRecords, scoreRecords, playerNames)

  const playerBadge = badges.find((b) => b.playerId === playerId)
  if (!playerBadge) {
    return new Response('Player not found', { status: 404 })
  }

  // Compute final rank and best distance for richer badge display
  const totalScores: Record<string, number> = {}
  for (const pid of playerIdList) totalScores[pid] = 0
  for (const s of scoreRecords) totalScores[s.playerId] = (totalScores[s.playerId] ?? 0) + s.points
  const ranked = [...playerIdList].sort((a, b) => (totalScores[b] ?? 0) - (totalScores[a] ?? 0))
  const rank = ranked.indexOf(playerId) + 1
  const totalPlayers = playerIdList.length

  const myGuesses = guessRecords.filter((g) => g.playerId === playerId && !g.passed && g.answer !== null)
  const distances = myGuesses.map((g) => {
    const rr = roundRecords.find((r) => r.roundId === g.roundId)
    return rr ? Math.abs(g.answer! - rr.targetAnswer) : null
  }).filter((d): d is number => d !== null)
  const bestDistance = distances.length > 0 ? Math.min(...distances) : null

  playerBadge.rank = rank > 0 ? rank : undefined
  playerBadge.totalPlayers = totalPlayers
  playerBadge.bestDistance = bestDistance

  const playerName = playerNames[playerId] ?? 'Player'

  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const fonts = await loadOgFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          background: 'linear-gradient(145deg, #0a0a0f 0%, #130d2a 40%, #0a0a0f 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow blobs */}
        <div style={{
          position: 'absolute', top: '-80px', left: '-80px',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 65%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', right: '-80px',
          width: '460px', height: '460px',
          background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Top brand pill */}
        <div style={{
          position: 'absolute', top: '52px',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(124,58,237,0.15)',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: '100px',
          padding: '8px 20px',
        }}>
          <div style={{ fontSize: '15px', color: '#a78bfa', fontWeight: 700, letterSpacing: '2px', display: 'flex' }}>
            🪞 SOCIAL MIRROR
          </div>
        </div>

        {/* Main card area */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: '32px',
          padding: '60px 80px',
          width: '840px',
          position: 'relative',
        }}>
          {/* Subtle inner glow on card top */}
          <div style={{
            position: 'absolute', top: 0, left: '50%',
            width: '400px', height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)',
            display: 'flex',
          }} />

          {/* Badge emoji */}
          <div style={{
            fontSize: '100px',
            marginBottom: '20px',
            display: 'flex',
            filter: 'drop-shadow(0 0 24px rgba(139,92,246,0.5))',
          }}>
            {playerBadge.emoji}
          </div>

          {/* Player name */}
          <div style={{
            fontSize: '22px',
            color: '#7c3aed',
            fontWeight: 700,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '10px',
            display: 'flex',
          }}>
            {playerName}
          </div>

          {/* Badge name */}
          <div style={{
            fontSize: '52px',
            fontWeight: 700,
            color: 'white',
            marginBottom: '24px',
            textAlign: 'center',
            letterSpacing: '-1px',
            lineHeight: 1.1,
            display: 'flex',
          }}>
            {playerBadge.name}
          </div>

          {/* Divider */}
          <div style={{
            width: '60px', height: '3px',
            background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), transparent)',
            marginBottom: '24px',
            display: 'flex',
          }} />

          {/* Badge copy */}
          <div style={{
            fontSize: '26px',
            color: '#c4b5fd',
            textAlign: 'center',
            maxWidth: '680px',
            lineHeight: 1.5,
            fontStyle: 'italic',
            display: 'flex',
          }}>
            {`\u201c${playerBadge.copy}\u201d`}
          </div>

          {/* Rank + best distance stat pills */}
          {(rank > 0 || bestDistance !== null) && (
            <div style={{
              display: 'flex', gap: '16px', marginTop: '28px',
            }}>
              {rank > 0 && (
                <div style={{
                  background: 'rgba(124,58,237,0.15)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  borderRadius: '100px',
                  padding: '6px 18px',
                  fontSize: '16px',
                  color: '#a78bfa',
                  fontWeight: 700,
                  display: 'flex',
                }}>
                  {`#${rank} of ${totalPlayers}`}
                </div>
              )}
              {bestDistance !== null && (
                <div style={{
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: '100px',
                  padding: '6px 18px',
                  fontSize: '16px',
                  color: '#6ee7b7',
                  fontWeight: 700,
                  display: 'flex',
                }}>
                  {bestDistance === 0 ? '🎯 Exact match!' : `Best: off by ${bestDistance}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom info */}
        <div style={{
          position: 'absolute', bottom: '52px',
          display: 'flex', alignItems: 'center', gap: '20px',
        }}>
          <div style={{ fontSize: '13px', color: '#475569', display: 'flex' }}>
            {`Room ${session.room_code} · ${date}`}
          </div>
          <div style={{
            width: '3px', height: '3px', borderRadius: '50%',
            background: '#334155', display: 'flex',
          }} />
          <div style={{ fontSize: '13px', color: '#6d28d9', fontWeight: 700, display: 'flex' }}>
            social-mirror.vercel.app
          </div>
          <div style={{
            width: '3px', height: '3px', borderRadius: '50%',
            background: '#334155', display: 'flex',
          }} />
          <div style={{ fontSize: '13px', color: '#374151', display: 'flex' }}>
            Built by Dheeraj Jain
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts,
    }
  )
}
