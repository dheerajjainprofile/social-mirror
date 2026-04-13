import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase'
import { calculateChaosScore, getChaosScoreLabel, type ChaosGuess } from '@/lib/chaosScore'
import { loadOgFonts } from '@/lib/ogFonts'

export const runtime = 'nodejs'

const DOT_COLORS = [
  '#a855f7', '#ec4899', '#06b6d4', '#f59e0b', '#10b981',
  '#f43f5e', '#6366f1', '#f97316', '#14b8a6', '#8b5cf6',
]

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
  const { code } = await params

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('room_code', code.toUpperCase())
    .single()

  if (!session) return new Response('Room not found', { status: 404 })

  const [{ data: players }, { data: scores }, { data: rounds }] = await Promise.all([
    supabase.from('players').select('*').eq('session_id', session.id).order('created_at', { ascending: true }),
    supabase.from('scores').select('*').eq('session_id', session.id),
    supabase.from('rounds').select('*').eq('session_id', session.id).order('round_number', { ascending: true }),
  ])

  const roundIds = (rounds ?? []).map((r) => r.id)
  const [{ data: guesses }, { data: targetAnswers }] = roundIds.length > 0
    ? await Promise.all([
        supabase.from('guesses').select('*').in('round_id', roundIds),
        supabase.from('target_answers').select('*').in('round_id', roundIds),
      ])
    : [{ data: [] }, { data: [] }]

  // Build leaderboard
  const playerList = (players ?? []).filter((p) => !p.is_organizer)
  const totals: Record<string, number> = {}
  playerList.forEach((p) => { totals[p.id] = 0 })
  ;(scores ?? []).forEach((s) => { totals[s.player_id] = (totals[s.player_id] ?? 0) + s.points })

  const leaderboard = playerList
    .map((p, i) => ({ name: p.name, points: totals[p.id] ?? 0, colorDot: DOT_COLORS[i % DOT_COLORS.length] }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 6)

  const winner = leaderboard[0]

  // Chaos score
  const chaosGuesses: ChaosGuess[] = (guesses ?? []).map((g) => {
    const ta = (targetAnswers ?? []).find((t) => t.round_id === g.round_id)
    return { answer: g.answer, passed: g.passed, targetAnswer: Number(ta?.answer ?? 0) }
  })
  const chaos = calculateChaosScore(chaosGuesses)
  const chaosLabel = getChaosScoreLabel(chaos.score)

  // Highlights
  const highlights: string[] = []

  // Exact guesses
  const exactCount = (guesses ?? []).filter((g) => {
    const ta = (targetAnswers ?? []).find((t) => t.round_id === g.round_id)
    return !g.passed && ta && Math.abs(Number(g.answer) - Number(ta.answer)) === 0
  }).length
  if (exactCount > 0) highlights.push(`🔮 ${exactCount} exact guess${exactCount > 1 ? 'es' : ''} tonight`)

  // Biggest miss
  let biggestMiss = 0
  let biggestMissName = ''
  ;(guesses ?? []).forEach((g) => {
    const ta = (targetAnswers ?? []).find((t) => t.round_id === g.round_id)
    if (!g.passed && ta) {
      const dist = Math.abs(Number(g.answer) - Number(ta.answer))
      if (dist > biggestMiss) {
        biggestMiss = dist
        const p = playerList.find((pl) => pl.id === g.player_id)
        biggestMissName = p?.name ?? ''
      }
    }
  })
  if (biggestMissName) highlights.push(`😬 ${biggestMissName} was off by ${biggestMiss}`)

  // Chaos label
  highlights.push(`${chaosLabel.emoji} ${chaosLabel.label} — ${chaosLabel.description}`)

  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const roundCount = (rounds ?? []).length
  const playerCount = playerList.length

  const MEDALS = ['🥇', '🥈', '🥉']

  const fonts = await loadOgFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0f0f0f',
          display: 'flex',
          flexDirection: 'row',
          fontFamily: 'Inter, sans-serif',
          padding: '0',
          overflow: 'hidden',
        }}
      >
        {/* Left panel */}
        <div
          style={{
            width: '400px',
            background: '#1a1a2e',
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 32px',
            borderRight: '1px solid #2a2a4a',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '32px' }}>
            <div style={{ color: '#a78bfa', fontSize: '13px', fontWeight: 700, letterSpacing: '2px' }}>
              🎯 HUNCH · ROOM {code.toUpperCase()}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>
              {date} · {playerCount} players · {roundCount} rounds
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '40px' }}>
            <div style={{ color: '#fbbf24', fontSize: '28px', fontWeight: 900, lineHeight: 1.1 }}>
              {`🏆 ${winner?.name ?? '—'}`}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>
              wins with {winner?.points ?? 0} pts
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
            <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px' }}>
              {"TONIGHT'S HIGHLIGHTS"}
            </div>
            {highlights.slice(0, 3).map((h, i) => (
              <div key={i} style={{ color: '#cbd5e1', fontSize: '12px', lineHeight: 1.4, padding: '4px 0' }}>
                {h}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', color: '#475569', fontSize: '11px' }}>
            Lower score = eerily accurate · Higher = beautiful chaos
          </div>
        </div>

        {/* Right panel — leaderboard */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 40px',
          }}
        >
          <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700, letterSpacing: '1px', marginBottom: '20px' }}>
            FINAL LEADERBOARD
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {leaderboard.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: i === 0 ? '#1e1b2e' : '#161616',
                  border: i === 0 ? '1px solid #4c1d95' : '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  gap: '12px',
                }}
              >
                <div style={{ width: '28px', fontSize: '18px', textAlign: 'center' }}>
                  {i < 3 ? MEDALS[i] : `${i + 1}`}
                </div>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: entry.colorDot,
                    flexShrink: 0,
                  }}
                />
                <div style={{ color: i === 0 ? '#e2e8f0' : '#94a3b8', fontSize: '16px', fontWeight: i === 0 ? 700 : 500, flex: 1 }}>
                  {entry.name}
                </div>
                <div style={{ color: i === 0 ? '#fbbf24' : '#64748b', fontSize: '16px', fontWeight: 700 }}>
                  {entry.points} pts
                </div>
              </div>
            ))}
          </div>

          <div style={{ color: '#334155', fontSize: '11px', marginTop: '20px', textAlign: 'right' }}>
            hunch.vercel.app · Share the chaos 🎉
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts }
  )
  } catch (err) {
    console.error('[session-story] render error:', err)
    return new Response(
      `Session story unavailable: ${err instanceof Error ? err.message : 'unknown error'}`,
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    )
  }
}
