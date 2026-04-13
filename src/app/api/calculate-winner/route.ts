import { supabase } from '@/lib/supabase'
import { calculateScores } from '@/lib/utils'
import { requireOrganizer } from '@/lib/requireOrganizer'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { round_id, organizer_player_id } = body

    if (!round_id) {
      return Response.json({ error: 'round_id is required' }, { status: 400 })
    }

    // Get round info
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('*, sessions(*)')
      .eq('id', round_id)
      .single()

    if (roundError || !round) {
      return Response.json({ error: 'Round not found' }, { status: 404 })
    }

    const authError = await requireOrganizer(round.session_id, organizer_player_id)
    if (authError) return authError

    // Idempotency guard: if round is already done, return early without re-scoring
    if (round.status === 'done') {
      const { data: existingScores } = await supabase
        .from('scores')
        .select('*')
        .eq('round_id', round_id)
      const winnerId = round.winner_player_id
      const winner = winnerId
        ? (await supabase.from('players').select('*').eq('id', winnerId).single()).data
        : null
      return Response.json({ winner, winners: winner ? [winner] : [], scores: existingScores ?? [] })
    }

    // Get target answer
    const { data: targetAnswerRow } = await supabase
      .from('target_answers')
      .select('*')
      .eq('round_id', round_id)
      .single()

    if (!targetAnswerRow) {
      return Response.json({ error: 'Target answer not found' }, { status: 400 })
    }

    const target = Number(targetAnswerRow.answer)

    // Note: auto-pass rows for players who never submitted are created upstream
    // in trigger-reveal so the reveal animation can render "Didn't answer" cards.
    // Scoring treats all passed=true rows (explicit or auto) as 0 points.

    // Get all guesses (non-passed)
    const { data: guesses } = await supabase
      .from('guesses')
      .select('*')
      .eq('round_id', round_id)
      .eq('passed', false)

    if (!guesses || guesses.length === 0) {
      // No active guesses: mark round done, no winner
      await supabase
        .from('rounds')
        .update({ status: 'done', winner_player_id: null })
        .eq('id', round_id)
      return Response.json({ winner: null, winners: [], scores: [] })
    }

    const guessEntries = guesses.map((g) => ({
      playerId: g.player_id,
      answer: Number(g.answer),
      submittedAt: g.submitted_at ?? new Date().toISOString(),
    }))

    const scoringMode = (round.sessions as { scoring_mode: string })?.scoring_mode ?? 'simple'
    const scoreResults = calculateScores(guessEntries, target, scoringMode as 'simple' | 'rich')

    // Find all players tied for 1st place (those with the highest points)
    const maxPoints = Math.max(...scoreResults.map((s) => s.points))
    const topScorers = scoreResults.filter((s) => s.points === maxPoints && s.points > 0)
    // Store first tied winner in DB (schema only holds one ID)
    const winnerId = topScorers[0]?.playerId ?? null

    // Insert scores FIRST, then flip round status to 'done'. The inverse order created a
    // Realtime race: clients seeing `rounds.winner_player_id` before the scores rows were
    // committed would compute a partial leaderboard on refresh.
    const scoreInserts = scoreResults
      .filter((s) => s.points > 0)
      .map((s) => ({
        session_id: round.session_id,
        player_id: s.playerId,
        round_id,
        points: s.points,
      }))

    if (scoreInserts.length > 0) {
      // Delete any existing scores for this round before inserting (extra safety against duplicates)
      await supabase.from('scores').delete().eq('round_id', round_id)
      const { error: scoreError } = await supabase.from('scores').insert(scoreInserts)
      if (scoreError) {
        console.error('Score insert error:', scoreError)
      }
    }

    // Now that scores are committed, flip the round to 'done' — Realtime consumers that
    // refresh on this event will see a complete scores table.
    await supabase
      .from('rounds')
      .update({ status: 'done', winner_player_id: winnerId })
      .eq('id', round_id)

    // Get all tied winner player info in parallel (sequential fetch caused race where the
    // client Realtime pipeline saw a partial winners set before the API response returned).
    const winnerFetches = await Promise.all(
      topScorers.map((scorer) =>
        supabase.from('players').select('*').eq('id', scorer.playerId).single().then((r) => r.data)
      )
    )
    const winners: Record<string, unknown>[] = winnerFetches.filter((p): p is Record<string, unknown> => !!p)
    const winner = winners[0] ?? null

    return Response.json({ winner, winners, scores: scoreResults })
  } catch (err) {
    console.error('calculate-winner error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
