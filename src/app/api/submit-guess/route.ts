import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { round_id, player_id, answer, reasoning, passed = false } = body

    if (!round_id || !player_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!passed && (answer === undefined || answer === null)) {
      return Response.json({ error: 'Answer is required unless passing' }, { status: 400 })
    }

    const numAnswer = passed ? null : Number(answer)
    if (!passed && isNaN(numAnswer as number)) {
      return Response.json({ error: 'Answer must be a number' }, { status: 400 })
    }

    // Validate round + session state
    const { data: round } = await supabase
      .from('rounds')
      .select('status, session_id, target_player_id')
      .eq('id', round_id)
      .single()
    if (!round) return Response.json({ error: 'Round not found' }, { status: 404 })
    if (round.status !== 'guessing') {
      return Response.json({ error: 'Round is not accepting guesses' }, { status: 409 })
    }
    if (round.target_player_id === player_id) {
      return Response.json({ error: 'Target player cannot submit a guess' }, { status: 403 })
    }
    const { data: sess } = await supabase
      .from('sessions')
      .select('status')
      .eq('id', round.session_id)
      .single()
    if (sess?.status !== 'active') {
      return Response.json({ error: 'Session is not active' }, { status: 409 })
    }

    // Upsert guess
    const { data: guess, error: insertError } = await supabase
      .from('guesses')
      .upsert(
        {
          round_id,
          player_id,
          answer: numAnswer,
          reasoning: reasoning ?? null,
          passed,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'round_id,player_id' }
      )
      .select()
      .single()

    if (insertError) {
      console.error('Guess insert error:', insertError)
      return Response.json({ error: 'Failed to submit guess' }, { status: 500 })
    }

    return Response.json({ guess })
  } catch (err) {
    console.error('submit-guess error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
