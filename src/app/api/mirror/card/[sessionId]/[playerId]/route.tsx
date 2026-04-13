import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

/**
 * GET /api/mirror/card/[sessionId]/[playerId]
 *
 * Generates a shareable OG image (1200x630) for a player's mirror portrait.
 * Shows: name, role, trait bars with gaps, headline.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; playerId: string }> }
) {
  const { sessionId, playerId } = await params

  // Fetch portrait
  const { data: portrait } = await supabase
    .from('mirror_portraits')
    .select('*')
    .eq('session_id', sessionId)
    .eq('player_id', playerId)
    .single()

  if (!portrait) {
    return new Response('Portrait not found', { status: 404 })
  }

  // Fetch player name
  const { data: player } = await supabase
    .from('players').select('name').eq('id', playerId).single()
  const name = player?.name ?? 'Player'

  const traitScores = portrait.trait_scores as Record<string, { self: number; group: number; gap: number }>
  const parsed = typeof portrait.portrait_text === 'string'
    ? JSON.parse(portrait.portrait_text)
    : portrait.portrait_text ?? {}
  const role = portrait.role ?? 'The Original'
  const roleEmoji = ROLE_EMOJI[role] ?? '✨'
  const saScore = parsed?.selfAwarenessScore ?? 50
  const headline = parsed?.headline ?? ''

  const traits = Object.entries(traitScores).slice(0, 5)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAF8F5',
          fontFamily: 'system-ui, sans-serif',
          padding: '48px',
          position: 'relative',
        }}
      >
        {/* Gradient top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
          background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C, #FFD166)',
          display: 'flex',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '42px', fontWeight: 900, color: '#1A1A1A', letterSpacing: '-1px', display: 'flex' }}>
              {name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '24px', display: 'flex' }}>{roleEmoji}</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#FF4D6A', display: 'flex' }}>{role}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#1A1A1A', display: 'flex' }}>{saScore}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex' }}>Self-awareness</div>
          </div>
        </div>

        {/* Headline */}
        {headline && (
          <div style={{ fontSize: '16px', color: '#555', marginBottom: '24px', lineHeight: 1.5, display: 'flex', maxWidth: '800px' }}>
            {headline.length > 120 ? headline.substring(0, 120) + '...' : headline}
          </div>
        )}

        {/* Trait bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          {traits.map(([dim, vals]) => {
            const gapColor = Math.abs(vals.gap) < 0.8 ? '#999' : vals.gap > 0 ? '#00B894' : '#FF4D6A'
            return (
              <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '130px', fontSize: '13px', fontWeight: 600, color: '#999', textTransform: 'uppercase', display: 'flex' }}>
                  {LABELS[dim] || dim}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Self bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '40px', fontSize: '11px', color: '#BBB', textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>You</div>
                    <div style={{ flex: 1, height: '14px', background: '#F3F1ED', borderRadius: '7px', display: 'flex', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(((vals.self - 1) / 6) * 100, 5)}%`, height: '100%', background: '#D0CCC5', borderRadius: '7px', display: 'flex' }} />
                    </div>
                    <div style={{ width: '30px', fontSize: '12px', fontWeight: 700, color: '#999', display: 'flex' }}>{vals.self?.toFixed?.(1) ?? vals.self}</div>
                  </div>
                  {/* Group bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '40px', fontSize: '11px', color: '#FF4D6A', textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>Friends</div>
                    <div style={{ flex: 1, height: '14px', background: '#F3F1ED', borderRadius: '7px', display: 'flex', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(((vals.group - 1) / 6) * 100, 5)}%`, height: '100%', background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C)', borderRadius: '7px', display: 'flex' }} />
                    </div>
                    <div style={{ width: '30px', fontSize: '12px', fontWeight: 700, color: '#FF4D6A', display: 'flex' }}>{vals.group?.toFixed?.(1) ?? vals.group}</div>
                  </div>
                </div>
                <div style={{ width: '50px', fontSize: '14px', fontWeight: 800, color: gapColor, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
                  {vals.gap > 0 ? '+' : ''}{vals.gap?.toFixed?.(1) ?? vals.gap}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #EEEBE6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', display: 'flex' }}>🪞</span>
            <span style={{ fontSize: '14px', fontWeight: 800, display: 'flex' }}>
              <span style={{ color: '#FF4D6A' }}>Social</span>
              <span style={{ color: '#FF8A5C', marginLeft: '4px' }}>Mirror</span>
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#BBB', display: 'flex' }}>
            See yourself through your friends' eyes
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
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

const LABELS: Record<string, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  stability: 'Stability',
}
