import { supabase } from '@/lib/supabase'
import { toTitleCase } from '@/lib/utils'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { room_code, player_name, player_token } = body

    if (!room_code?.trim() || !player_name?.trim()) {
      return Response.json({ error: 'Room code and player name are required' }, { status: 400 })
    }

    const standardizedName = toTitleCase(player_name)

    // Find session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('room_code', room_code.trim().toUpperCase())
      .single()

    if (sessionError || !session) {
      return Response.json({ error: 'Room not found' }, { status: 404 })
    }

    if (session.status === 'ended') {
      return Response.json(
        { error: 'This game has already ended.', redirect: `/start` },
        { status: 400 }
      )
    }

    // Fetch existing players (count only non-organizer for capacity check)
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', session.id)
    const count = (existingPlayers ?? []).filter((p) => !p.is_organizer).length

    const players = existingPlayers ?? []

    // Check for same-name player (possible rejoin or duplicate)
    const sameNamePlayer = players.find(
      (p) => p.name.toLowerCase() === standardizedName.toLowerCase()
    )

    if (sameNamePlayer) {
      // Rejoin flow: check body token or header token
      const headerToken = request.headers.get('x-player-token')
      const tokenToCheck = player_token ?? headerToken
      if (tokenToCheck && sameNamePlayer.player_token === tokenToCheck) {
        // Valid rejoin — return existing player
        return Response.json({
          session,
          player: sameNamePlayer,
          rejoined: true,
        })
      }
      // No token or wrong token — include recovery info so client can redirect
      // This handles: network dropped after player was created, token never saved
      return Response.json(
        {
          error: 'This name is already taken. If you lost your connection, try refreshing from the same browser and device.',
          existingPlayerId: sameNamePlayer.id,
          roomCode: session.room_code,
        },
        { status: 409 }
      )
    }

    // Active session: late join allowed, but capped at 12
    if (session.status === 'active' || session.status === 'paused') {
      if (count >= 12) {
        return Response.json({ error: 'Room is full (maximum 12 players)' }, { status: 400 })
      }
      // Create late-join player
      const ip_address =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown'
      const user_agent = request.headers.get('user-agent') ?? 'unknown'

      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          session_id: session.id,
          name: standardizedName,
          is_organizer: false,
          ip_address,
          user_agent,
          player_token: randomUUID(),
        })
        .select()
        .single()

      if (playerError) {
        console.error('Late join player insert error:', playerError)
        return Response.json({ error: 'Failed to join room' }, { status: 500 })
      }

      return Response.json({ session, player, late_join: true })
    }

    // Normal lobby join
    if (count >= 12) {
      return Response.json({ error: 'Room is full (maximum 12 players)' }, { status: 400 })
    }

    const ip_address =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const user_agent = request.headers.get('user-agent') ?? 'unknown'

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        session_id: session.id,
        name: standardizedName,
        is_organizer: false,
        ip_address,
        user_agent,
      })
      .select()
      .single()

    if (playerError) {
      console.error('Player insert error:', playerError)
      return Response.json({ error: 'Failed to join room' }, { status: 500 })
    }

    return Response.json({ session, player })
  } catch (err) {
    console.error('join-room error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
