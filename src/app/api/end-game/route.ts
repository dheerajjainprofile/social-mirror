import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { session_id, organizer_player_id } = body

    if (!session_id) {
      return Response.json({ error: 'session_id is required' }, { status: 400 })
    }

    const authError = await requireOrganizer(session_id, organizer_player_id)
    if (authError) return authError

    const { data: session, error } = await supabase
      .from('sessions')
      .update({ status: 'ended' })
      .eq('id', session_id)
      .select()
      .single()

    if (error) {
      return Response.json({ error: 'Failed to end game' }, { status: 500 })
    }

    return Response.json({ session })
  } catch (err) {
    console.error('end-game error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
