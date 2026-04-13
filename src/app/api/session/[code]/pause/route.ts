import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body = await request.json()
    const { action, organizer_player_id, paused_at, round_id } = body // 'pause' | 'resume'

    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('id, status, paused_at')
      .eq('room_code', code.toUpperCase())
      .single()

    if (fetchError || !session) {
      return Response.json({ error: 'Room not found' }, { status: 404 })
    }

    const authError = await requireOrganizer(session.id, organizer_player_id)
    if (authError) return authError

    if (action === 'pause') {
      if (session.status !== 'active') {
        return Response.json({ error: 'Can only pause an active session' }, { status: 400 })
      }
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'paused', paused_at: nowIso })
        .eq('id', session.id)
      if (error) return Response.json({ error: 'Failed to pause' }, { status: 500 })
      return Response.json({ status: 'paused' })
    }

    if (action === 'resume') {
      if (session.status !== 'paused') {
        return Response.json({ error: 'Can only resume a paused session' }, { status: 400 })
      }
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'active', paused_at: null })
        .eq('id', session.id)
      if (error) return Response.json({ error: 'Failed to resume' }, { status: 500 })

      // Offset the active round's started_at by the pause duration so the timer resumes correctly.
      // Use the server-stored paused_at (not the client-provided one) to avoid clock drift and
      // survive organizer page refreshes between pause and resume.
      let newStartedAt: string | null = null
      const serverPausedAt = session.paused_at ?? paused_at  // fall back to client value if column not yet populated
      if (serverPausedAt) {
        const pauseDurationMs = Date.now() - new Date(serverPausedAt).getTime()
        const { data: activeRound } = await supabase
          .from('rounds')
          .select('id, started_at')
          .eq('session_id', session.id)
          .eq('status', 'guessing')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (activeRound?.started_at) {
          const originalStart = new Date(activeRound.started_at).getTime()
          newStartedAt = new Date(originalStart + pauseDurationMs).toISOString()
          await supabase.from('rounds').update({ started_at: newStartedAt }).eq('id', activeRound.id)
        }
      }

      return Response.json({ status: 'active', started_at: newStartedAt })
    }

    return Response.json({ error: 'Invalid action. Use "pause" or "resume".' }, { status: 400 })
  } catch (err) {
    console.error('pause/resume error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
