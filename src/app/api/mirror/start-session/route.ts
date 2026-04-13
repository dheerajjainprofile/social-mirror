import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { selectMirrorQuestions } from '@/lib/mirrorQuestions'

/**
 * POST /api/mirror/start-session
 *
 * Transitions a session from lobby to active and generates the mirror round plan.
 * Creates the full sequence of rounds upfront so all clients know the schedule.
 *
 * Body: {
 *   session_id: string
 *   organizer_player_id: string
 * }
 *
 * Returns: {
 *   ok: true,
 *   rounds: Array<{ round_number, subject_player_id, question_id, question_text }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, organizer_player_id } = body

    if (!session_id || !organizer_player_id) {
      return NextResponse.json({ error: 'Missing session_id or organizer_player_id' }, { status: 400 })
    }

    // Auth: verify organizer
    const { data: orgPlayer } = await supabase
      .from('players')
      .select('id, is_organizer, session_id')
      .eq('id', organizer_player_id)
      .single()

    if (!orgPlayer || !orgPlayer.is_organizer || orgPlayer.session_id !== session_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Verify session is in lobby
    const { data: session } = await supabase
      .from('sessions').select('*').eq('id', session_id).single()
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.status !== 'lobby') {
      return NextResponse.json({ error: 'Session already started' }, { status: 409 })
    }

    // Get non-organizer players (subjects for mirror rounds)
    const { data: allPlayers } = await supabase
      .from('players').select('*').eq('session_id', session_id).eq('removed', false)
    const subjects = (allPlayers ?? []).filter((p) => !p.is_organizer)

    if (subjects.length < 3) {
      return NextResponse.json({ error: 'Need at least 4 players (3 non-organizer) to start' }, { status: 400 })
    }

    // Shuffle subjects for random ordering
    const shuffledSubjects = [...subjects].sort(() => Math.random() - 0.5)

    // Select questions: 2 per subject from different Big Five dimensions
    const assignments = await selectMirrorQuestions(shuffledSubjects.length, 2)

    // Create rounds in the database
    // Note: question_id FK on rounds table references the old 'questions' table.
    // For mirror rounds, we store the mirror_question_id in the question_text field
    // as a prefix: "mq:{id}|{text}" and parse it where needed. question_id stays null.
    const roundInserts = assignments.map((a, idx) => ({
      session_id,
      round_number: idx + 1,
      target_player_id: shuffledSubjects[a.subjectIndex].id,
      question_text: `mq:${a.question.id}|${a.question.text.replace('{player}', shuffledSubjects[a.subjectIndex].name)}`,
      question_id: null, // null because FK references old questions table, not mirror_questions
      status: idx === 0 ? 'self-rating' : 'waiting',
      started_at: idx === 0 ? new Date().toISOString() : null,
    }))

    const { data: rounds, error: roundsErr } = await supabase
      .from('rounds')
      .insert(roundInserts)
      .select()

    if (roundsErr) {
      console.error('Failed to create rounds:', roundsErr)
      return NextResponse.json({ error: 'Failed to create rounds' }, { status: 500 })
    }

    // Transition session to active
    await supabase
      .from('sessions')
      .update({ status: 'active' })
      .eq('id', session_id)

    return NextResponse.json({
      ok: true,
      rounds: (rounds ?? []).map((r) => ({
        round_number: r.round_number,
        subject_player_id: r.target_player_id,
        question_id: r.question_id,
        question_text: r.question_text,
        status: r.status,
      })),
      total_rounds: roundInserts.length,
    })
  } catch (err) {
    console.error('start-session error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
