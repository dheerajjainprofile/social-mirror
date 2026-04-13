import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'

export async function POST(request: Request) {
  try {
    const { session_id, updates, organizer_player_id } = await request.json()
    if (!session_id || !updates) {
      return Response.json({ error: 'session_id and updates required' }, { status: 400 })
    }

    const authError = await requireOrganizer(session_id, organizer_player_id)
    if (authError) return authError

    const ALLOWED_FIELDS = ['hot_cold_enabled'] as const
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => ALLOWED_FIELDS.includes(key as typeof ALLOWED_FIELDS[number]))
    )
    if (Object.keys(safeUpdates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('sessions')
      .update(safeUpdates)
      .eq('id', session_id)
      .select()
      .single()

    if (error) return Response.json({ error: 'Failed to update session' }, { status: 500 })
    return Response.json({ session: data })
  } catch (err) {
    console.error('update-session error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
