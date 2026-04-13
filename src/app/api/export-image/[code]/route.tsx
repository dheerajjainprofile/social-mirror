import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase'
import { calculateChaosScore, type ChaosGuess } from '@/lib/chaosScore'
import { encode as encodeQR } from 'uqr'
import { loadOgFonts } from '@/lib/ogFonts'

export const runtime = 'nodejs'

const MEDALS = ['🥇', '🥈', '🥉']

function distLabel(dist: number): string {
  if (dist === 0) return '🎯 EXACT'
  if (dist <= 5) return 'So close'
  if (dist <= 20) return 'Not bad'
  if (dist <= 50) return 'Off track'
  return 'Way off'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
  const { code } = await params

  // Fetch session
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('room_code', code.toUpperCase())
    .single()

  if (!session) {
    return new Response('Room not found', { status: 404 })
  }

  // Fetch pack name if available
  let packName: string | null = null
  if (session.pack_id) {
    const { data: pack } = await supabase
      .from('packs')
      .select('name')
      .eq('id', session.pack_id)
      .single()
    packName = pack?.name ?? null
  }

  // Fetch players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('session_id', session.id)

  // Fetch scores
  const { data: scores } = await supabase
    .from('scores')
    .select('*')
    .eq('session_id', session.id)

  // Build leaderboard
  const playerMap = new Map((players ?? []).map((p) => [p.id, p]))
  const totals: Record<string, number> = {}
  for (const s of scores ?? []) totals[s.player_id] = (totals[s.player_id] ?? 0) + s.points
  const leaderboard = (players ?? [])
    .filter((p) => !p.is_organizer)
    .map((p) => ({ name: p.name, points: totals[p.id] ?? 0, id: p.id }))
    .sort((a, b) => b.points - a.points)

  // Find best guess + biggest miss + collect chaos data across all rounds
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', session.id)
    .order('round_number', { ascending: true })

  let bestGuessPlayer = ''
  let bestGuessDist = Infinity
  let biggestMissPlayer = ''
  let biggestMissDist = -1
  let roundCount = 0
  const chaosGuesses: ChaosGuess[] = []

  for (const round of rounds ?? []) {
    roundCount++
    const { data: ta } = await supabase
      .from('target_answers').select('answer').eq('round_id', round.id).single()
    if (!ta) continue
    const target = Number(ta.answer)
    const { data: guesses } = await supabase
      .from('guesses').select('*').eq('round_id', round.id)
    for (const g of guesses ?? []) {
      chaosGuesses.push({ answer: g.passed ? null : Number(g.answer), passed: g.passed, targetAnswer: target })
      if (g.passed || g.answer === null) continue
      const dist = Math.abs(Number(g.answer) - target)
      const pName = playerMap.get(g.player_id)?.name ?? '?'
      if (dist < bestGuessDist) { bestGuessDist = dist; bestGuessPlayer = pName }
      if (dist > biggestMissDist) { biggestMissDist = dist; biggestMissPlayer = pName }
    }
  }

  const chaos = calculateChaosScore(chaosGuesses)
  const winner = leaderboard[0]
  const topTied = winner ? leaderboard.filter((p) => p.points === winner.points) : []
  const winnerLabel = topTied.length > 1
    ? `${topTied.map((p) => p.name).join(' & ')} know their friends best!`
    : winner
    ? `${winner.name} knows their friends best!`
    : ''
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // Deep link for QR — /start?pack=ID if pack exists, otherwise /start
  const baseUrl = 'hunch.vercel.app'
  const deepLink = session.pack_id
    ? `https://${baseUrl}/start?pack=${session.pack_id}`
    : `https://${baseUrl}/start`

  // P0.4: Generate QR matrix for inline rendering (edge-runtime compatible via uqr)
  const qr = encodeQR(deepLink, { ecc: 'M' })

  // Pre-compute strings to avoid multiple JSX expression children (satori constraint)
  const subtitleText = `Room ${code.toUpperCase()} · ${date} · ${session.scoring_mode} mode · ${roundCount} rounds · ${leaderboard.length} players${packName ? ` · ${packName} Pack` : ''}`
  const chaosDisplay = `${chaos.emoji} ${chaos.score}`
  const winnerSubline = `${winner?.points ?? 0} pts · Can your group beat this?`

  const fonts = await loadOgFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1035 50%, #0f172a 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '-100px', left: '-100px',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: '-100px', right: '-100px',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>
              🎯 Hunch
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              {subtitleText}
            </div>
          </div>
          {/* Chaos score */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '12px',
            padding: '10px 18px',
          }}>
            <div style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Chaos Score
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'white' }}>
              {chaosDisplay}
            </div>
            <div style={{ fontSize: '11px', color: '#7c3aed' }}>{chaos.label}</div>
          </div>
        </div>

        {/* Winner banner */}
        {winner && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: '12px',
            padding: '12px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '30px' }}>👑</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#fde68a' }}>
                {winnerLabel}
              </div>
              <div style={{ fontSize: '13px', color: '#92400e' }}>
                {winnerSubline}
              </div>
            </div>
          </div>
        )}

        {/* Main content: leaderboard left, callouts right */}
        <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
          {/* Leaderboard */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              Final Scores
            </div>
            {leaderboard.slice(0, 6).map((entry, i) => (
              <div key={entry.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: i === 0 ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)',
                borderRadius: '8px',
                padding: '8px 12px',
                border: i === 0 ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: '16px', width: '24px' }}>{MEDALS[i] ?? `${i + 1}.`}</span>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: i === 0 ? '#c4b5fd' : 'white' }}>
                  {entry.name}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#fbbf24' }}>
                  {`${entry.points} pts`}
                </span>
              </div>
            ))}
          </div>

          {/* Callouts */}
          <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {bestGuessPlayer && (
              <div style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}>
                <div style={{ fontSize: '10px', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  🎯 Best guess
                </div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: 'white' }}>{bestGuessPlayer}</div>
                <div style={{ fontSize: '11px', color: '#6ee7b7' }}>
                  {bestGuessDist === 0 ? 'Exact!' : `Off by ${bestGuessDist} · ${distLabel(bestGuessDist)}`}
                </div>
              </div>
            )}
            {biggestMissPlayer && biggestMissPlayer !== bestGuessPlayer && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}>
                <div style={{ fontSize: '10px', color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  😬 Biggest miss
                </div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: 'white' }}>{biggestMissPlayer}</div>
                <div style={{ fontSize: '11px', color: '#fca5a5' }}>{`Off by ${biggestMissDist}`}</div>
              </div>
            )}
            {/* QR code callout */}
            <div style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '10px',
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              marginTop: 'auto',
            }}>
              <div style={{ fontSize: '10px', color: '#a5b4fc', fontWeight: 700, display: 'flex' }}>
                Scan to play →
              </div>
              {/* Inline QR matrix — satori-compatible */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'white',
                padding: '4px',
                borderRadius: '4px',
              }}>
                {Array.from({ length: qr.size }, (_, y) => (
                  <div key={y} style={{ display: 'flex' }}>
                    {Array.from({ length: qr.size }, (_, x) => (
                      <div
                        key={x}
                        style={{
                          width: 3,
                          height: 3,
                          background: qr.data[y][x] ? '#000' : '#fff',
                          display: 'flex',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '9px', color: '#6366f1', display: 'flex' }}>
                {baseUrl}/start
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '11px', color: '#475569' }}>
            Built by Dheeraj Jain · linkedin.com/in/dheerajjain-gim
          </div>
          <div style={{ fontSize: '11px', color: '#334155' }}>
            {deepLink}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    }
  )
  } catch (err) {
    console.error('[export-image] render error:', err)
    return new Response(
      `Game card unavailable: ${err instanceof Error ? err.message : 'unknown error'}`,
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    )
  }
}
