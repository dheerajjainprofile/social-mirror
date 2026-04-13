import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'

export async function POST(request: Request) {
  try {
    const { round_id, organizer_player_id } = await request.json()
    if (!round_id) return Response.json({ error: 'round_id required' }, { status: 400 })

    const { data: roundCheck } = await supabase.from('rounds').select('session_id').eq('id', round_id).single()
    if (!roundCheck) return Response.json({ error: 'Round not found' }, { status: 404 })
    const authError = await requireOrganizer(roundCheck.session_id, organizer_player_id)
    if (authError) return authError

    const { error } = await supabase
      .from('rounds')
      .update({ status: 'done', winner_player_id: null })
      .eq('id', round_id)

    if (error) return Response.json({ error: 'Failed to skip round' }, { status: 500 })
    return Response.json({ success: true })
  } catch (err) {
    console.error('skip-round error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
