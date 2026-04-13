import { supabase } from '@/lib/supabase'
import { generateRoomCode, toTitleCase } from '@/lib/utils'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body = await request.json()
    const { organizer_name } = body

    if (!organizer_name?.trim()) {
      return Response.json({ error: 'Organizer name is required' }, { status: 400 })
    }

    // Fetch original session
    const { data: original, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('room_code', code.toUpperCase())
      .single()

    if (fetchError || !original) {
      return Response.json({ error: 'Room not found' }, { status: 404 })
    }

    const standardizedName = toTitleCase(organizer_name)

    // Generate new room code
    let room_code = generateRoomCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('room_code', room_code)
        .single()
      if (!existing) break
      room_code = generateRoomCode()
      attempts++
    }

    // Create new session with same settings, linked to parent
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        room_code,
        organizer_name: standardizedName,
        scoring_mode: original.scoring_mode,
        reveal_mode: original.reveal_mode,
        show_reasoning: original.show_reasoning,
        hot_cold_enabled: original.hot_cold_enabled,
        timer_seconds: original.timer_seconds,
        status: 'lobby',
        preset: original.preset ?? 'custom',
        pack_id: original.pack_id ?? null,
        parent_session_id: original.id,
        acquisition_source: 'replay',
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Replay session create error:', sessionError)
      return Response.json({ error: 'Failed to create replay session' }, { status: 500 })
    }

    // Create organizer as a player in the new session
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        session_id: session.id,
        name: standardizedName,
        is_organizer: true,
        ip_address: request.headers.get('x-forwarded-for') ?? 'unknown',
        user_agent: request.headers.get('user-agent') ?? 'unknown',
      })
      .select()
      .single()

    if (playerError) {
      console.error('Replay player create error:', playerError)
      return Response.json({ error: 'Failed to create organizer player' }, { status: 500 })
    }

    // End the original session so players see game-over
    await supabase.from('sessions').update({ status: 'ended' }).eq('id', original.id)

    return Response.json({ session, player, room_code, newRoomCode: session.room_code })
  } catch (err) {
    console.error('replay error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
