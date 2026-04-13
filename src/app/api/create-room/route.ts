import { supabase } from '@/lib/supabase'
import { generateRoomCode, toTitleCase } from '@/lib/utils'

// Party Mode defaults — applied server-side when preset = 'party'
const PARTY_MODE_DEFAULTS = {
  scoring_mode: 'rich',
  reveal_mode: 'organizer',
  show_reasoning: true,
  hot_cold_enabled: true,
  timer_seconds: 60,
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      organizer_name,
      scoring_mode,
      reveal_mode,
      show_reasoning,
      hot_cold_enabled,
      timer_seconds,
      preset,
      pack_id,
      acquisition_source,
      organizer_plays,
    } = body

    if (!organizer_name?.trim()) {
      return Response.json({ error: 'Organizer name is required' }, { status: 400 })
    }

    const standardizedName = toTitleCase(organizer_name)

    // Apply Party Mode defaults server-side
    const isParty = preset === 'party'
    const finalScoringMode = isParty ? PARTY_MODE_DEFAULTS.scoring_mode : (scoring_mode ?? 'simple')
    const finalRevealMode = isParty ? PARTY_MODE_DEFAULTS.reveal_mode : (reveal_mode ?? 'organizer')
    const finalShowReasoning = isParty ? PARTY_MODE_DEFAULTS.show_reasoning : (show_reasoning ?? true)
    const finalHotCold = isParty ? PARTY_MODE_DEFAULTS.hot_cold_enabled : (hot_cold_enabled ?? true)
    const finalTimer = isParty ? PARTY_MODE_DEFAULTS.timer_seconds : (timer_seconds ?? 60)

    // Lazy cleanup — expire sessions older than 24h that are still active
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('sessions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('created_at', cutoff)

    // Generate unique room code
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

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        room_code,
        organizer_name: standardizedName,
        scoring_mode: finalScoringMode,
        reveal_mode: finalRevealMode,
        show_reasoning: finalShowReasoning,
        hot_cold_enabled: finalHotCold,
        timer_seconds: finalTimer,
        status: 'lobby',
        preset: preset ?? 'custom',
        pack_id: pack_id ?? null,
        acquisition_source: acquisition_source ?? 'direct',
        organizer_plays: organizer_plays === true,
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Session create error:', sessionError)
      return Response.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Create organizer as a player (with player_token)
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
      console.error('Player create error:', playerError)
      return Response.json({ error: 'Failed to create player' }, { status: 500 })
    }

    return Response.json({ session, player, room_code })
  } catch (err) {
    console.error('create-room error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
