'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * useRealtime — manages Supabase Realtime subscriptions for a session.
 * Handles tab-resume reconnection (Safari kills WebSockets in background).
 *
 * @param sessionId - the session to subscribe to
 * @param tables - array of table names to listen on (e.g. ['players', 'sessions', 'rounds'])
 * @param onUpdate - callback fired when any subscribed table changes
 * @param filters - optional per-table filters (e.g. { players: `session_id=eq.${id}` })
 */
export function useRealtime(
  sessionId: string | undefined,
  tables: string[],
  onUpdate: () => void,
  filters?: Record<string, string>
) {
  const [lastVisible, setLastVisible] = useState(0)
  const onUpdateRef = useRef(onUpdate)

  // Keep callback ref current without re-subscribing
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  // Tab visibility handler — force reconnect on resume
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        setLastVisible(Date.now())
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // Subscribe to realtime changes
  useEffect(() => {
    if (!sessionId) return

    let channel = supabase.channel(`rt-${sessionId}-${lastVisible}`)

    for (const table of tables) {
      const filter = filters?.[table] ?? (
        table === 'guesses' || table === 'mirror_ratings'
          ? undefined
          : `session_id=eq.${sessionId}`
      )

      // sessions table filters on id, not session_id
      const actualFilter = table === 'sessions' ? `id=eq.${sessionId}` : filter

      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(actualFilter ? { filter: actualFilter } : {}),
        },
        () => onUpdateRef.current()
      )
    }

    channel.subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, tables, filters, lastVisible])
}

/**
 * useLobbyPoll — polls players table while in lobby (realtime INSERT is unreliable).
 * Stops when status changes from 'lobby'.
 */
export function useLobbyPoll(
  sessionId: string | undefined,
  status: string | undefined,
  onUpdate: (players: Array<{ id: string; session_id: string; name: string; is_organizer: boolean; created_at?: string }>) => void,
  intervalMs = 3000
) {
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    if (!sessionId || status !== 'lobby') return

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('players').select('*').eq('session_id', sessionId)
      if (data) onUpdateRef.current(data)
    }, intervalMs)

    return () => clearInterval(poll)
  }, [sessionId, status, intervalMs])
}
