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

    // Verify rater is a player in this session (prevents spoofed ratings)
    if (rater_player_id) {
      const { data: rater } = await supabase
        .from('players').select('id, session_id').eq('id', rater_player_id).single()
      if (!rater || rater.session_id !== session_id) {
        return NextResponse.json({ error: 'Rater not in this session' }, { status: 403 })
      }
    }

    // Verify subject is a player in this session
    const { data: subject } = await supabase
      .from('players').select('id, session_id').eq('id', subject_player_id).single()
    if (!subject || subject.session_id !== session_id) {
      return NextResponse.json({ error: 'Subject not in this session' }, { status: 403 })
    }

    // For self-ratings: rater_player_id must match subject_player_id or be null
    const isSelfRating = !rater_player_id || rater_player_id === subject_player_id

    // For group-ratings: rater cannot rate themselves
    if (rater_player_id && rater_player_id === subject_player_id) {
      return NextResponse.json({ error: 'Cannot rate yourself as a group rater' }, { status: 400 })
    }

    // Insert the rating. Use plain insert (not upsert) because Supabase
    // doesn't support partial unique indexes in onConflict. On conflict
    // (double-tap), the DB constraint rejects the duplicate and we return OK.
    const insertData = {
      session_id,
      round_number,
      subject_player_id,
      rater_player_id: isSelfRating ? null : rater_player_id,
      question_id,
      score: scoreNum,
    }

    const { data, error } = await supabase
      .from('mirror_ratings')
      .insert(insertData)
      .select()

    // Handle duplicate rating gracefully (constraint violation = already submitted)
    if (error && (error.code === '23505' || error.message?.includes('duplicate'))) {
      // Update the existing rating instead
      let query = supabase
        .from('mirror_ratings')
        .update({ score: scoreNum })
        .eq('session_id', session_id)
        .eq('round_number', round_number)
        .eq('subject_player_id', subject_player_id)
        .eq('question_id', question_id)
      if (isSelfRating) {
        query = query.is('rater_player_id', null)
      } else {
        query = query.eq('rater_player_id', rater_player_id)
      }
      const { error: updateErr } = await query
      if (updateErr) {
        console.error('submit-rate update error:', updateErr)
        return NextResponse.json({ error: 'Failed to update rating' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, updated: true })
    }

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
