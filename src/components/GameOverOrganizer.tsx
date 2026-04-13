'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FeedbackWidget from './FeedbackWidget'
import ShareArtifactModal from './ShareArtifactModal'
import {
  badgeFileName,
  badgeShareText,
  badgeShareTitle,
  sessionStoryFileName,
  sessionStoryShareText,
  sessionStoryShareTitle,
} from '@/lib/shareCopy'
import type { PlayerBadge } from '@/lib/badgeLogic'

interface GameOverOrganizerProps {
  sessionId: string
  organizerName: string
  roomCode: string
  scoringMode: string
  roundsPlayed: number
  playerCount: number
  packId: string | null
  organizerPlayerId?: string | null
  organizerPlays?: boolean
  hostBadge?: PlayerBadge | null
  winnerName?: string
  winnerPoints?: number
  onSaveImage: () => void
  onExportTxt: () => void
}

export default function GameOverOrganizer({
  sessionId,
  organizerName,
  roomCode,
  scoringMode,
  roundsPlayed,
  playerCount,
  packId,
  organizerPlayerId,
  organizerPlays,
  hostBadge,
  winnerName,
  winnerPoints,
  onSaveImage,
  onExportTxt,
}: GameOverOrganizerProps) {
  const router = useRouter()
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [badgeModalOpen, setBadgeModalOpen] = useState(false)

  const handlePlayAgain = async () => {
    try {
      const res = await fetch(`/api/session/${roomCode}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizer_name: organizerName }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Failed to start replay')
        return
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('gtg_name', organizerName)
        localStorage.setItem('gtg_player_id', data.player.id)
        localStorage.setItem('gtg_session_id', data.session.id)
        if (data.player.player_token) {
          localStorage.setItem('gtg_player_token', data.player.player_token)
        }
      }
      router.push(`/room/${data.room_code}/organizer`)
    } catch {
      alert('Network error. Please try again.')
    }
  }

  const handleUseSamePack = () => {
    if (!packId) return
    if (typeof window !== 'undefined') {
      localStorage.setItem('gtg_last_pack_id', packId)
    }
    alert('Pack saved! It will be pre-selected next time you create a room.')
  }

  const sessionCtx = {
    hostName: organizerName,
    roomCode,
    playerCount,
    roundsPlayed,
    winnerName,
    winnerPoints,
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-2">🏁</div>
        <h2 className="text-2xl font-black text-white mb-1">What a game!</h2>
        <p className="text-slate-400 text-sm mb-5">Room {roomCode}</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handlePlayAgain}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-base rounded-xl transition-all"
          >
            🔁 Play again — same group
          </button>
          <p className="text-slate-500 text-xs -mt-1">One tap, new room, everyone rejoins</p>

          <button
            onClick={() => setSessionModalOpen(true)}
            className="w-full py-3 bg-purple-700 hover:bg-purple-600 border border-purple-500 text-white font-bold rounded-xl transition-all text-sm text-center"
          >
            📤 Share Session Story
          </button>
          <p className="text-slate-500 text-xs -mt-1">WhatsApp-ready recap of tonight</p>

          {organizerPlays && organizerPlayerId && (
            <>
              <button
                onClick={() => setBadgeModalOpen(true)}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 border border-purple-500/40 text-white font-bold rounded-xl transition-all text-sm"
              >
                📤 Share your badge
              </button>
              <p className="text-slate-500 text-xs -mt-1">Share what kind of guesser you were</p>
            </>
          )}

          <button
            onClick={onSaveImage}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-bold rounded-xl transition-all text-sm"
          >
            📸 Save game card
          </button>
          <p className="text-slate-500 text-xs -mt-1">Challenge another group to beat your score</p>

          {packId && (
            <>
              <button
                onClick={handleUseSamePack}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 font-semibold rounded-xl transition-all text-sm"
              >
                🃏 Pre-select this pack next time
              </button>
              <p className="text-slate-500 text-xs -mt-1">Saves this pack so it&apos;s auto-selected when you host next</p>
            </>
          )}

          <button
            onClick={onExportTxt}
            className="text-slate-500 hover:text-slate-300 text-sm underline underline-offset-2 transition-colors mt-1"
          >
            👀 Full results (.txt)
          </button>
          <p className="text-slate-700 text-xs -mt-1">All rounds, guesses and scores as plain text</p>
        </div>
      </div>

      <FeedbackWidget
        playerName={organizerName}
        role="organizer"
        roomCode={roomCode}
        scoringMode={scoringMode}
        roundsPlayed={roundsPlayed}
        playerCount={playerCount}
      />

      <ShareArtifactModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        imageUrl={`/api/session-story/${roomCode}`}
        fileName={sessionStoryFileName(organizerName, roomCode)}
        title={sessionStoryShareTitle(sessionCtx)}
        shareText={sessionStoryShareText(sessionCtx)}
      />

      {organizerPlays && organizerPlayerId && (
        <ShareArtifactModal
          open={badgeModalOpen}
          onClose={() => setBadgeModalOpen(false)}
          imageUrl={`/api/badge/${sessionId}/${organizerPlayerId}`}
          fileName={
            hostBadge
              ? badgeFileName(organizerName, hostBadge)
              : `Hunch-Badge-${organizerName.replace(/[^a-zA-Z0-9]+/g, '-') || 'Host'}.png`
          }
          title={
            hostBadge
              ? badgeShareTitle({ playerName: organizerName, badge: hostBadge, roomCode })
              : `${organizerName}'s Hunch badge`
          }
          shareText={
            hostBadge
              ? badgeShareText({ playerName: organizerName, badge: hostBadge, roomCode })
              : `${organizerName} just ran a Hunch night — check out the badge from tonight's game. Play it: https://hunch.vercel.app`
          }
        />
      )}
    </div>
  )
}
