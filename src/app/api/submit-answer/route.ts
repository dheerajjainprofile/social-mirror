import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { round_id, player_id, answer } = body

    if (!round_id || !player_id || answer === undefined || answer === null) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const numAnswer = Number(answer)
    if (isNaN(numAnswer)) {
      return Response.json({ error: 'Answer must be a number' }, { status: 400 })
    }

    // Check round exists and is in answering phase
    const { data: round, error: roundFetchError } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', round_id)
      .single()

    if (roundFetchError || !round) {
      return Response.json({ error: 'Round not found' }, { status: 404 })
    }

    if (round.status !== 'guessing') {
      return Response.json({ error: 'Round is not in guessing phase' }, { status: 400 })
    }

    if (round.target_player_id !== player_id) {
      return Response.json({ error: 'Only the target player can submit an answer' }, { status: 403 })
    }

    // Upsert target answer — one row per round enforced by conflict on round_id
    const { data: targetAnswer, error: insertError } = await supabase
      .from('target_answers')
      .upsert(
        { round_id, player_id, answer: numAnswer, submitted_at: new Date().toISOString() },
        { onConflict: 'round_id' }
      )
      .select()
      .single()

    if (insertError) {
      console.error('Target answer insert error:', insertError)
      return Response.json({ error: 'Failed to submit answer' }, { status: 500 })
    }

    return Response.json({ targetAnswer })
  } catch (err) {
    console.error('submit-answer error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
