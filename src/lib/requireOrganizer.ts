import { supabase } from './supabase'

/**
 * Verify that `organizerPlayerId` is an organizer for `sessionId`.
 * Returns a 403 Response on failure, or null on success.
 */
export async function requireOrganizer(
  sessionId: string,
  organizerPlayerId: string | undefined | null
): Promise<Response | null> {
  if (!organizerPlayerId) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { data: player } = await supabase
    .from('players')
    .select('id, is_organizer, session_id')
    .eq('id', organizerPlayerId)
    .single()

  if (!player || !player.is_organizer || player.session_id !== sessionId) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }
  return null
}
