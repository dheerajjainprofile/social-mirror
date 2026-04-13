'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BadgeCard from './BadgeCard'
import Leaderboard from './Leaderboard'
import FeedbackWidget from './FeedbackWidget'
import ShareArtifactModal from './ShareArtifactModal'
import { type PlayerBadge } from '@/lib/badgeLogic'
import { sessionStoryFileName, sessionStoryShareText, sessionStoryShareTitle } from '@/lib/shareCopy'

interface PlayerScore {
  playerId: string
  playerName: string
  totalPoints: number
}

interface GameOverPlayerProps {
  sessionId: string
  playerId: string
  playerName: string
  roomCode: string
  scoringMode: string
  roundsPlayed: number
  playerCount: number
  packId: string | null
  badge: PlayerBadge | null
  scores: PlayerScore[]
}

export default function GameOverPlayer({
  sessionId,
  playerId,
  playerName,
  roomCode,
  scoringMode,
  roundsPlayed,
  playerCount,
  packId,
  badge,
  scores,
}: GameOverPlayerProps) {
  const router = useRouter()
  const [sessionModalOpen, setSessionModalOpen] = useState(false)

  const handleHostOwn = () => {
    const params = new URLSearchParams()
    params.set('preset', 'party')
    params.set('source', 'host_cta')
    if (packId) params.set('pack', packId)
    router.push(`/start?${params.toString()}`)
  }

  const winner = [...scores].sort((a, b) => b.totalPoints - a.totalPoints)[0]
  const sessionCtx = {
    hostName: playerName,
    roomCode,
    playerCount,
    roundsPlayed,
    winnerName: winner?.playerName,
    winnerPoints: winner?.totalPoints,
  }

  return (
    <div className="space-y-4 py-4">
      <div className="text-center">
        <div className="text-5xl mb-3">🏁</div>
        <h2 className="text-2xl font-black text-white mb-1">Game Over!</h2>
        <p className="text-slate-400 text-sm">Thanks for playing</p>
      </div>

      {/* Personal badge */}
      {badge && (
        <BadgeCard
          badge={badge}
          sessionId={sessionId}
          playerId={playerId}
          playerName={playerName}
          roomCode={roomCode}
        />
      )}

      {/* Session card — available to all players */}
      <button
        onClick={() => setSessionModalOpen(true)}
        className="w-full py-3 bg-purple-700 hover:bg-purple-600 border border-purple-500 text-white font-bold rounded-xl transition-all text-sm text-center"
      >
        📸 Share session card
      </button>
      <p className="text-center text-slate-500 text-xs -mt-2">
        WhatsApp-ready recap of tonight
      </p>

      {/* Host CTA */}
      <button
        onClick={handleHostOwn}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black rounded-2xl transition-all text-base"
      >
        🎮 Host your own game
      </button>
      <p className="text-center text-slate-500 text-xs -mt-2">
        Bring this game to your friends — takes 10 seconds
      </p>

      {/* Leaderboard */}
      <button
        onClick={() => {
          const el = document.getElementById('leaderboard-section')
          el?.scrollIntoView({ behavior: 'smooth' })
        }}
        className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold rounded-xl transition-all text-sm"
      >
        👀 See full leaderboard
      </button>

      <div id="leaderboard-section">
        <Leaderboard scores={scores} highlightId={playerId} />
      </div>

      <FeedbackWidget
        playerName={playerName}
        role="player"
        roomCode={roomCode}
        scoringMode={scoringMode}
        roundsPlayed={roundsPlayed}
        playerCount={playerCount}
      />

      <ShareArtifactModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        imageUrl={`/api/session-story/${roomCode}`}
        fileName={sessionStoryFileName(playerName, roomCode)}
        title={sessionStoryShareTitle(sessionCtx)}
        shareText={sessionStoryShareText(sessionCtx)}
      />
    </div>
  )
}
