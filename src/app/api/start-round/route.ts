import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { session_id, question_text, target_player_id, round_number, question_id, organizer_player_id } = body

    if (!session_id || !question_text || !target_player_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const authError = await requireOrganizer(session_id, organizer_player_id)
    if (authError) return authError

    // Update session status to active
    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ status: 'active' })
      .eq('id', session_id)

    if (sessionError) {
      return Response.json({ error: 'Failed to update session' }, { status: 500 })
    }

    // Create round
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        session_id,
        question_id: question_id ?? null,
        question_text,
        target_player_id,
        round_number: round_number ?? 1,
        status: 'guessing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (roundError) {
      console.error('Round insert error:', roundError)
      return Response.json({ error: 'Failed to create round' }, { status: 500 })
    }

    return Response.json({ round })
  } catch (err) {
    console.error('start-round error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
