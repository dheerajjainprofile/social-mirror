import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'

export async function POST(request: Request) {
  try {
    const { player_id, organizer_player_id } = await request.json()
    if (!player_id) return Response.json({ error: 'player_id required' }, { status: 400 })

    const { data: targetPlayer } = await supabase.from('players').select('session_id').eq('id', player_id).single()
    if (!targetPlayer) return Response.json({ error: 'Player not found' }, { status: 404 })
    const authError = await requireOrganizer(targetPlayer.session_id, organizer_player_id)
    if (authError) return authError

    const { error } = await supabase.from('players').delete().eq('id', player_id)
    if (error) return Response.json({ error: 'Failed to remove player' }, { status: 500 })
    return Response.json({ success: true })
  } catch (err) {
    console.error('remove-player error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
