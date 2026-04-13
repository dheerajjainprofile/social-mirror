/**
 * E2E test helpers — thin wrappers around the app's own API routes.
 * These call the running Next.js server (localhost or Vercel) so they
 * exercise real DB + real auth, matching production behavior exactly.
 */

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

export async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, ok: res.ok, data: json }
}

export async function apiGet(path: string) {
  const res = await fetch(`${BASE}${path}`)
  const json = await res.json().catch(() => null)
  return { status: res.status, ok: res.ok, data: json }
}

// ── High-level helpers ────────────────────────────────────────────────────────

export interface RoomSetup {
  code: string
  sessionId: string
  organizerId: string
  organizerToken: string
}

/**
 * Create a room via the API, return code + organizer player info.
 */
export async function createRoom(opts: {
  organizerName?: string
  preset?: 'party' | 'custom'
  scoringMode?: 'simple' | 'rich'
  timerSeconds?: number
  revealMode?: 'organizer' | 'auto'
} = {}): Promise<RoomSetup> {
  const res = await apiPost('/api/create-room', {
    organizer_name: opts.organizerName ?? 'TestHost',
    preset: opts.preset ?? 'custom',
    scoring_mode: opts.scoringMode ?? 'simple',
    reveal_mode: opts.revealMode ?? 'organizer',
    show_reasoning: true,
    hot_cold_enabled: true,
    timer_seconds: opts.timerSeconds ?? 30,
  })
  if (!res.ok) throw new Error(`create-room failed: ${JSON.stringify(res.data)}`)
  return {
    code: res.data.room_code,
    sessionId: res.data.session_id,
    organizerId: res.data.player_id,
    organizerToken: res.data.player_token,
  }
}

export interface JoinResult {
  playerId: string
  playerToken: string
}

/**
 * Join a room as a non-organizer player.
 */
export async function joinRoom(code: string, name: string): Promise<JoinResult> {
  const res = await apiPost('/api/join-room', { room_code: code, player_name: name })
  if (!res.ok) throw new Error(`join-room failed: ${JSON.stringify(res.data)}`)
  return { playerId: res.data.player_id, playerToken: res.data.player_token }
}

/**
 * Start a round (organizer action).
 */
export async function startRound(code: string, targetPlayerId: string, questionId?: string) {
  const body: Record<string, unknown> = { room_code: code, target_player_id: targetPlayerId }
  if (questionId) body.question_id = questionId
  const res = await apiPost('/api/start-round', body)
  if (!res.ok) throw new Error(`start-round failed: ${JSON.stringify(res.data)}`)
  return res.data
}

/**
 * Submit a guess (non-target player).
 */
export async function submitGuess(roundId: string, playerId: string, answer: number) {
  const res = await apiPost('/api/submit-guess', { round_id: roundId, player_id: playerId, answer })
  if (!res.ok) throw new Error(`submit-guess failed: ${JSON.stringify(res.data)}`)
  return res.data
}

/**
 * Submit target answer.
 */
export async function submitAnswer(roundId: string, playerId: string, answer: number) {
  const res = await apiPost('/api/submit-answer', { round_id: roundId, player_id: playerId, answer })
  if (!res.ok) throw new Error(`submit-answer failed: ${JSON.stringify(res.data)}`)
  return res.data
}

/**
 * Trigger reveal (organizer or auto).
 */
export async function triggerReveal(roundId: string) {
  const res = await apiPost('/api/trigger-reveal', { round_id: roundId })
  if (!res.ok) throw new Error(`trigger-reveal failed: ${JSON.stringify(res.data)}`)
  return res.data
}

/**
 * Calculate winner for a round.
 */
export async function calculateWinner(roundId: string) {
  const res = await apiPost('/api/calculate-winner', { round_id: roundId })
  if (!res.ok) throw new Error(`calculate-winner failed: ${JSON.stringify(res.data)}`)
  return res.data
}

/**
 * Skip the current round.
 */
export async function skipRound(roundId: string) {
  const res = await apiPost('/api/skip-round', { round_id: roundId })
  if (!res.ok) throw new Error(`skip-round failed: ${JSON.stringify(res.data)}`)
  return res.data
}

/**
 * End the game.
 */
export async function endGame(code: string) {
  const res = await apiPost('/api/end-game', { room_code: code })
  if (!res.ok) throw new Error(`end-game failed: ${JSON.stringify(res.data)}`)
  return res.data
}

/**
 * Replay — creates new session from ended session.
 */
export async function replay(code: string, organizerName: string) {
  const res = await apiPost(`/api/session/${code}/replay`, { organizer_name: organizerName })
  if (!res.ok) throw new Error(`replay failed: ${JSON.stringify(res.data)}`)
  return res.data
}

/**
 * Pause or resume a round.
 */
export async function pauseRound(code: string, action: 'pause' | 'resume', opts: {
  roundId?: string
  pausedAt?: number
} = {}) {
  const body: Record<string, unknown> = { action }
  if (opts.roundId) body.round_id = opts.roundId
  if (opts.pausedAt) body.paused_at = opts.pausedAt
  const res = await apiPost(`/api/session/${code}/pause`, body)
  if (!res.ok) throw new Error(`pause failed: ${JSON.stringify(res.data)}`)
  return res.data
}
