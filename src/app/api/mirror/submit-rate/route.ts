import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/mirror/submit-rate
 *
 * Submit a rating for a mirror round.
 * Handles both self-ratings (subject rates themselves) and group-ratings (others rate the subject).
 *
 * Body: {
 *   session_id: string
 *   round_number: number
 *   subject_player_id: string
 *   rater_player_id: string | null   (null = self-rating)
 *   question_id: string
 *   score: number (1-7)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, round_number, subject_player_id, rater_player_id, question_id, score } = body

    // Validate required fields
    if (!session_id || round_number == null || !subject_player_id || !question_id || score == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate score range
    const scoreNum = Number(score)
    if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 7) {
      return NextResponse.json({ error: 'Score must be an integer between 1 and 7' }, { status: 400 })
    }

    // Validate session exists and is active
    const { data: session } = await supabase
      .from('sessions').select('status').eq('id', session_id).single()
    if (!session || session.status === 'ended') {
      return NextResponse.json({ error: 'Session not found or ended' }, { status: 404 })
    }

    // For self-ratings: rater_player_id must match subject_player_id or be null
    const isSelfRating = !rater_player_id || rater_player_id === subject_player_id

    // For group-ratings: rater cannot rate themselves
    if (rater_player_id && rater_player_id === subject_player_id) {
      return NextResponse.json({ error: 'Cannot rate yourself as a group rater' }, { status: 400 })
    }

    // Upsert the rating (handles retries/double-taps gracefully)
    const { data, error } = await supabase
      .from('mirror_ratings')
      .upsert({
        session_id,
        round_number,
        subject_player_id,
        rater_player_id: isSelfRating ? null : rater_player_id,
        question_id,
        score: scoreNum,
      }, {
        onConflict: isSelfRating
          ? 'session_id,round_number,subject_player_id,question_id'
          : 'session_id,round_number,subject_player_id,rater_player_id,question_id',
      })
      .select()

    if (error) {
      console.error('submit-rate error:', error)
      return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, rating: data?.[0] })
  } catch (err) {
    console.error('submit-rate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
