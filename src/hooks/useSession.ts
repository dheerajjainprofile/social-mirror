'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Session {
  id: string
  room_code: string
  organizer_name: string
  scoring_mode: string
  reveal_mode: string
  show_reasoning: boolean
  hot_cold_enabled: boolean
  timer_seconds: number
  status: string
  paused_at?: string | null
  preset?: string
  pack_id?: string | null
  organizer_plays?: boolean
}

export interface Player {
  id: string
  session_id: string
  name: string
  is_organizer: boolean
  created_at?: string
}

/**
 * useSession — loads and manages session + player state for a room.
 * Shared across organizer, player, and present pages.
 *
 * Returns:
 *  - session, players, organizerPlayerId
 *  - loading, error
 *  - refreshSession() to force re-fetch
 */
export function useSession(roomCode: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [organizerPlayerId, setOrganizerPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSession = useCallback(async () => {
    const { data: sess } = await supabase
      .from('sessions').select('*').eq('room_code', roomCode).single()
    if (!sess) {
      setError('Room not found')
      setLoading(false)
      return null
    }
    setSession(sess)

    const { data: playerData } = await supabase
      .from('players').select('*').eq('session_id', sess.id)
    const plist = playerData ?? []
    setPlayers(plist)

    const orgPlayer = plist.find((p) => p.is_organizer)
    if (orgPlayer) setOrganizerPlayerId(orgPlayer.id)

    setLoading(false)
    return { session: sess, players: plist }
  }, [roomCode])

  const refreshSession = useCallback(async () => {
    if (!session?.id) return
    const { data: sess } = await supabase
      .from('sessions').select('*').eq('id', session.id).single()
    if (sess) setSession(sess)

    const { data: playerData } = await supabase
      .from('players').select('*').eq('session_id', session.id)
    const plist = playerData ?? []
    setPlayers(plist)
  }, [session?.id])

  useEffect(() => {
    loadSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode])

  return {
    session,
    setSession,
    players,
    setPlayers,
    organizerPlayerId,
    loading,
    error,
    refreshSession,
    loadSession,
  }
}
