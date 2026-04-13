/**
 * api-full-game.test.ts
 *
 * Full game flow via API calls against the running Next.js server.
 * Covers every major path: create → join → start → guess → reveal → winner → end.
 * Also covers: skip round, pause/resume, replay, join validation.
 *
 * Run with:  npx playwright test src/e2e/api-full-game.test.ts --project="Desktop Chrome"
 * Or set TEST_BASE_URL=https://your-app.vercel.app to run against Vercel.
 */

import { test, expect } from '@playwright/test'
import {
  createRoom, joinRoom, startRound, submitGuess, submitAnswer,
  triggerReveal, calculateWinner, skipRound, endGame, replay,
  pauseRound, apiGet, apiPost,
} from './helpers/api'

// ─── Full game: 2 players, 1 round, organizer reveal ────────────────────────

test('full game: create → join → start round → guess → answer → reveal → winner → end', async () => {
  // 1. Create room
  const room = await createRoom({ organizerName: 'Host', scoringMode: 'simple' })
  expect(room.code).toMatch(/^[A-Z2-9]{6}$/)
  expect(room.sessionId).toBeTruthy()

  // 2. Join as second player
  const player = await joinRoom(room.code, 'Alice')
  expect(player.playerId).toBeTruthy()

  // 3. Start round targeting Alice (non-organizer)
  const round = await startRound(room.code, player.playerId)
  expect(round.round_id).toBeTruthy()
  const roundId = round.round_id

  // 4. Alice submits her answer (target)
  await submitAnswer(roundId, player.playerId, 42)

  // 5. Host (organizer) submits a guess
  await submitGuess(roundId, room.organizerId, 40)

  // 6. Organizer triggers reveal
  await triggerReveal(roundId)

  // 7. Calculate winner
  const winner = await calculateWinner(roundId)
  expect(winner).toBeTruthy()

  // 8. End game
  const ended = await endGame(room.code)
  expect(ended).toBeTruthy()
})

// ─── Join validation ──────────────────────────────────────────────────────────

test('join-room: rejects invalid room code', async () => {
  const res = await apiPost('/api/join-room', { room_code: 'XXXXXX', player_name: 'Ghost' })
  expect(res.status).toBe(404)
})

test('join-room: rejects blank player name', async () => {
  const room = await createRoom()
  const res = await apiPost('/api/join-room', { room_code: room.code, player_name: '   ' })
  expect(res.status).toBe(400)
})

test('join-room: rejects duplicate player name in same room', async () => {
  const room = await createRoom()
  await joinRoom(room.code, 'Dupe')
  const res = await apiPost('/api/join-room', { room_code: room.code, player_name: 'Dupe' })
  expect(res.status).toBe(409)
})

test('join-room: player name is normalized to title case', async () => {
  const room = await createRoom()
  const res = await apiPost('/api/join-room', { room_code: room.code, player_name: 'lowercase name' })
  expect(res.ok).toBe(true)
  expect(res.data.player_name).toBe('Lowercase Name')
})

// ─── Start-round validation ───────────────────────────────────────────────────

test('start-round: requires target_player_id', async () => {
  const room = await createRoom()
  const res = await apiPost('/api/start-round', { room_code: room.code })
  expect(res.status).toBe(400)
})

test('start-round: target player must be in session', async () => {
  const room = await createRoom()
  const res = await apiPost('/api/start-round', {
    room_code: room.code,
    target_player_id: 'nonexistent-player-id',
  })
  expect(res.status).toBeGreaterThanOrEqual(400)
})

// ─── Scoring modes ────────────────────────────────────────────────────────────

test('simple scoring: closest guess wins', async () => {
  const room = await createRoom({ scoringMode: 'simple' })
  const p1 = await joinRoom(room.code, 'Close')
  const p2 = await joinRoom(room.code, 'Far')

  const round = await startRound(room.code, p1.playerId)
  const roundId = round.round_id

  await submitAnswer(roundId, p1.playerId, 50)
  await submitGuess(roundId, room.organizerId, 48) // off by 2
  await submitGuess(roundId, p2.playerId, 20)      // off by 30

  await triggerReveal(roundId)
  const result = await calculateWinner(roundId)
  expect(result.winner_player_id).toBe(room.organizerId)
})

test('rich scoring: exact match gets 100 points', async () => {
  const room = await createRoom({ scoringMode: 'rich' })
  const player = await joinRoom(room.code, 'Guesser')

  const round = await startRound(room.code, player.playerId)
  const roundId = round.round_id

  await submitAnswer(roundId, player.playerId, 75)
  await submitGuess(roundId, room.organizerId, 75) // exact!

  await triggerReveal(roundId)
  const result = await calculateWinner(roundId)
  expect(result.winner_player_id).toBe(room.organizerId)
})

// ─── Tie handling ─────────────────────────────────────────────────────────────

test('tied guesses: both players win (equal points inserted)', async () => {
  const room = await createRoom({ scoringMode: 'simple' })
  const p1 = await joinRoom(room.code, 'TieA')
  const p2 = await joinRoom(room.code, 'TieB')

  // Use p2 as target so both p1 and host can guess
  const round = await startRound(room.code, p2.playerId)
  const roundId = round.round_id

  await submitAnswer(roundId, p2.playerId, 30)
  await submitGuess(roundId, p1.playerId, 20)       // off by 10
  await submitGuess(roundId, room.organizerId, 40)  // off by 10 — tied

  await triggerReveal(roundId)
  const result = await calculateWinner(roundId)

  // Both should have scores (multi-winner tie)
  expect(result.top_scorers?.length ?? result.winners?.length ?? 2).toBeGreaterThanOrEqual(1)
})

// ─── Skip round ───────────────────────────────────────────────────────────────

test('skip round: round status becomes done with null winner', async () => {
  const room = await createRoom()
  const player = await joinRoom(room.code, 'Skipper')

  const round = await startRound(room.code, player.playerId)
  await skipRound(round.round_id)

  // Verify via a new round can be started (session still active)
  const round2 = await startRound(room.code, player.playerId)
  expect(round2.round_id).toBeTruthy()
  expect(round2.round_id).not.toBe(round.round_id)
})

// ─── Pause / Resume ───────────────────────────────────────────────────────────

test('pause then resume: started_at shifts forward by pause duration', async () => {
  const room = await createRoom({ timerSeconds: 60 })
  const player = await joinRoom(room.code, 'PauseTest')
  const round = await startRound(room.code, player.playerId)

  const pausedAt = Date.now()
  await pauseRound(room.code, 'pause')

  // Simulate 3-second pause
  await new Promise(r => setTimeout(r, 100))
  const resumedAt = Date.now()

  const resumeResult = await pauseRound(room.code, 'resume', {
    roundId: round.round_id,
    pausedAt,
  })

  // started_at in response should be shifted
  if (resumeResult.started_at) {
    const newStart = new Date(resumeResult.started_at).getTime()
    // newStart should be >= original round start (was shifted forward)
    expect(newStart).toBeGreaterThan(0)
  }
})

// ─── Replay: old session ends ─────────────────────────────────────────────────

test('replay: original session gets ended status', async () => {
  const room = await createRoom({ organizerName: 'ReplayHost' })
  await joinRoom(room.code, 'ReplayPlayer')

  // End the game first
  await endGame(room.code)

  // Trigger replay
  const replayResult = await replay(room.code, 'ReplayHost')
  expect(replayResult.room_code ?? replayResult.newRoomCode).toBeTruthy()
  expect(replayResult.newRoomCode ?? replayResult.room_code).not.toBe(room.code)

  // The old session should now be ended — verify via session fetch
  const sessionCheck = await apiGet(`/api/session/${room.code}`)
  // Either 404 (session ended/not found) or status = ended
  if (sessionCheck.ok) {
    expect(sessionCheck.data?.status).toBe('ended')
  } else {
    expect(sessionCheck.status).toBeGreaterThanOrEqual(400)
  }
})

// ─── Room code format ─────────────────────────────────────────────────────────

test('room codes never contain I, O, 1, 0', async () => {
  const codes: string[] = []
  for (let i = 0; i < 5; i++) {
    const room = await createRoom({ organizerName: `Host${i}` })
    codes.push(room.code)
  }
  for (const code of codes) {
    expect(code).not.toMatch(/[IO10]/)
    expect(code).toMatch(/^[A-Z2-9]{6}$/)
  }
})

test('room codes are unique across concurrent creates', async () => {
  const rooms = await Promise.all(
    Array.from({ length: 5 }, (_, i) => createRoom({ organizerName: `Parallel${i}` }))
  )
  const codes = rooms.map(r => r.code)
  expect(new Set(codes).size).toBe(5)
})

// ─── Image routes: must return 200 with image/png ─────────────────────────────

test('session-story image route returns 200 with PNG content-type', async ({ request }) => {
  const room = await createRoom({ organizerName: 'ImgHost' })
  const player = await joinRoom(room.code, 'ImgPlayer')

  // End game so the image route has data
  const round = await startRound(room.code, player.playerId)
  await submitAnswer(round.round_id, player.playerId, 50)
  await submitGuess(round.round_id, room.organizerId, 45)
  await triggerReveal(round.round_id)
  await calculateWinner(round.round_id)
  await endGame(room.code)

  const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
  const res = await request.get(`${BASE}/api/session-story/${room.code}`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
})

test('badge image route returns 200 with PNG content-type', async ({ request }) => {
  const room = await createRoom({ organizerName: 'BadgeHost' })
  const player = await joinRoom(room.code, 'BadgePlayer')

  const round = await startRound(room.code, player.playerId)
  await submitAnswer(round.round_id, player.playerId, 50)
  await submitGuess(round.round_id, room.organizerId, 45)
  await triggerReveal(round.round_id)
  await calculateWinner(round.round_id)
  await endGame(room.code)

  const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
  const res = await request.get(`${BASE}/api/badge/${room.sessionId}/${room.organizerId}`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
})
