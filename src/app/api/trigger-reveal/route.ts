import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { round_id, organizer_player_id } = body

    if (!round_id) {
      return Response.json({ error: 'round_id is required' }, { status: 400 })
    }

    const { data: roundCheck } = await supabase
      .from('rounds')
      .select('session_id, target_player_id, status')
      .eq('id', round_id)
      .single()
    if (!roundCheck) return Response.json({ error: 'Round not found' }, { status: 404 })
    const authError = await requireOrganizer(roundCheck.session_id, organizer_player_id)
    if (authError) return authError

    // Idempotency guard: if the round is already in reveal or done, return the current
    // round without re-inserting auto-pass rows. Without this, a double-tapped Reveal
    // button (common on spotty networks) inserts duplicate "Didn't answer" cards.
    if (roundCheck.status !== 'guessing') {
      const { data: existing } = await supabase
        .from('rounds').select('*').eq('id', round_id).single()
      return Response.json({ round: existing })
    }

    // Auto-create pass rows for any eligible guesser who never submitted.
    // Done here (not in calculate-winner) so the reveal animation can actually
    // render a "Didn't answer" card for those players. Distinguished from an
    // explicit pass via auto_passed=true.
    const { data: session } = await supabase
      .from('sessions')
      .select('organizer_plays')
      .eq('id', roundCheck.session_id)
      .single()
    const sessionOrganizerPlays = session?.organizer_plays === true

    const { data: allPlayers } = await supabase
      .from('players')
      .select('id, is_organizer')
      .eq('session_id', roundCheck.session_id)

    const eligibleGuessers = (allPlayers ?? [])
      .filter((p) => p.id !== roundCheck.target_player_id)
      .filter((p) => !p.is_organizer || sessionOrganizerPlays)
      .map((p) => p.id)

    const { data: existingGuesses } = await supabase
      .from('guesses')
      .select('player_id')
      .eq('round_id', round_id)

    const submittedIds = new Set((existingGuesses ?? []).map((g) => g.player_id))
    const missingGuessers = eligibleGuessers.filter((id) => !submittedIds.has(id))

    if (missingGuessers.length > 0) {
      const autoRows = missingGuessers.map((playerId) => ({
        round_id,
        player_id: playerId,
        answer: null,
        reasoning: null,
        passed: true,
        auto_passed: true,
        submitted_at: new Date().toISOString(),
      }))
      const { error: autoErr } = await supabase.from('guesses').insert(autoRows)
      if (autoErr) console.error('auto-pass insert error:', autoErr)
    }

    const { data: round, error } = await supabase
      .from('rounds')
      .update({ status: 'reveal' })
      .eq('id', round_id)
      .select()
      .single()

    if (error) {
      console.error('Trigger reveal error:', error)
      return Response.json({ error: 'Failed to trigger reveal' }, { status: 500 })
    }

    return Response.json({ round })
  } catch (err) {
    console.error('trigger-reveal error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
