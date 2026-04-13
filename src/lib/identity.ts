/**
 * Persistent Identity — localStorage UUID + profile linking.
 *
 * Flow:
 * 1. First visit: generate UUID, store in localStorage
 * 2. On join: create/find player_profiles row with this UUID
 * 3. Link session to profile via session_profiles
 * 4. Optional email claim (future: magic link)
 */

import { supabase } from './supabase'

const LOCAL_ID_KEY = 'sm-local-id'
const DISPLAY_NAME_KEY = 'sm-display-name'

/**
 * Get or create the local device identity UUID.
 * Returns null in SSR / private browsing fallback.
 */
export function getLocalId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = localStorage.getItem(LOCAL_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(LOCAL_ID_KEY, id)
    }
    return id
  } catch {
    // Private browsing or storage disabled
    return null
  }
}

/**
 * Store display name locally for auto-fill.
 */
export function saveDisplayName(name: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(DISPLAY_NAME_KEY, name) } catch {}
}

export function getDisplayName(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(DISPLAY_NAME_KEY) } catch { return null }
}

/**
 * Ensure a player_profiles row exists for this device.
 * Creates one if it doesn't exist. Returns the profile ID.
 */
export async function ensureProfile(displayName: string): Promise<string | null> {
  const localId = getLocalId()
  if (!localId) return null

  // Upsert: create or update in a single call (eliminates TOCTOU race)
  const { data } = await supabase
    .from('player_profiles')
    .upsert(
      { local_id: localId, display_name: displayName, updated_at: new Date().toISOString() },
      { onConflict: 'local_id' }
    )
    .select('id')
    .single()

  return data?.id ?? null
}

/**
 * Link a session + player to the persistent profile.
 */
export async function linkSessionToProfile(
  sessionId: string,
  playerId: string,
  profileId: string
): Promise<void> {
  await supabase
    .from('session_profiles')
    .upsert({
      session_id: sessionId,
      profile_id: profileId,
      player_id: playerId,
    }, { onConflict: 'session_id,profile_id' })
}

/**
 * Get profile ID for the current device.
 */
export async function getMyProfileId(): Promise<string | null> {
  const localId = getLocalId()
  if (!localId) return null

  const { data } = await supabase
    .from('player_profiles')
    .select('id')
    .eq('local_id', localId)
    .limit(1)

  return data?.[0]?.id ?? null
}
