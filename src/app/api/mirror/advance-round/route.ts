import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'

/**
 * POST /api/mirror/advance-round
 *
 * Advances the current mirror round to the next phase:
 *   self-rating → group-rating → mini-reveal → done
 *
 * When a round moves to 'done', the next round (if any) starts in 'self-rating'.
 * When the last round is done, the session moves to 'revealing' for AI synthesis.
 *
 * Body: {
 *   session_id: string
 *   round_id: string
 *   organizer_player_id: string
 * }
 */

const STATE_MACHINE: Record<string, string> = {
  'self-rating': 'group-rating',
  'group-rating': 'mini-reveal',
  'mini-reveal': 'done',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, round_id, organizer_player_id } = body

    if (!session_id || !round_id || !organizer_player_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Auth
    const authErr = await requireOrganizer(session_id, organizer_player_id)
    if (authErr) return authErr

    // Get current round
    const { data: round } = await supabase
      .from('rounds').select('*').eq('id', round_id).single()
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    const nextStatus = STATE_MACHINE[round.status]
    if (!nextStatus) {
      return NextResponse.json({ error: `Cannot advance from status: ${round.status}` }, { status: 409 })
    }

    // Advance the current round
    await supabase
      .from('rounds')
      .update({ status: nextStatus })
      .eq('id', round_id)

    let nextRound = null
    let sessionComplete = false

    // If round is now done, activate the next round or complete the session
    if (nextStatus === 'done') {
      // Compute mini-reveal data: self-score vs group average
      const { data: ratings } = await supabase
        .from('mirror_ratings')
        .select('*')
        .eq('session_id', session_id)
        .eq('round_number', round.round_number)

      let selfScore = null
      let groupAvg = null
      if (ratings && ratings.length > 0) {
        const selfRating = ratings.find((r) => r.rater_player_id === null)
        const groupRatings = ratings.filter((r) => r.rater_player_id !== null)
        selfScore = selfRating?.score ?? null
        groupAvg = groupRatings.length > 0
          ? groupRatings.reduce((sum, r) => sum + r.score, 0) / groupRatings.length
          : null
      }

      // Check for next round
      const { data: nextRounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('session_id', session_id)
        .eq('round_number', round.round_number + 1)
        .limit(1)

      if (nextRounds && nextRounds.length > 0) {
        // Activate next round
        const nr = nextRounds[0]
        await supabase
          .from('rounds')
          .update({ status: 'self-rating', started_at: new Date().toISOString() })
          .eq('id', nr.id)
        nextRound = { ...nr, status: 'self-rating' }
      } else {
        // No more rounds — session is ready for AI synthesis
        await supabase
          .from('sessions')
          .update({ status: 'revealing' })
          .eq('id', session_id)
        sessionComplete = true
      }

      return NextResponse.json({
        ok: true,
        round_status: nextStatus,
        self_score: selfScore,
        group_avg: groupAvg != null ? Math.round(groupAvg * 10) / 10 : null,
        gap: selfScore != null && groupAvg != null
          ? Math.round((groupAvg - selfScore) * 10) / 10
          : null,
        next_round: nextRound ? {
          id: nextRound.id,
          round_number: nextRound.round_number,
          question_text: nextRound.question_text,
          target_player_id: nextRound.target_player_id,
          status: nextRound.status,
        } : null,
        session_complete: sessionComplete,
      })
    }

    return NextResponse.json({
      ok: true,
      round_status: nextStatus,
      next_round: null,
      session_complete: false,
    })
  } catch (err) {
    console.error('advance-round error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
