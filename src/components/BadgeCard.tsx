'use client'

import { useState } from 'react'
import { type PlayerBadge } from '@/lib/badgeLogic'
import { badgeFileName, badgeShareText, badgeShareTitle } from '@/lib/shareCopy'
import ShareArtifactModal from './ShareArtifactModal'

interface BadgeCardProps {
  badge: PlayerBadge
  sessionId: string
  playerId: string
  playerName: string
  roomCode?: string
  onShare?: () => void
}

export default function BadgeCard({ badge, sessionId, playerId, playerName, roomCode, onShare }: BadgeCardProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const imageUrl = `/api/badge/${sessionId}/${playerId}`
  const shareCtx = { playerName, badge, roomCode }

  return (
    <>
      <div className="bg-gradient-to-br from-purple-900/40 to-slate-800 border-2 border-purple-500/50 rounded-2xl p-5 text-center">
        <div className="text-5xl mb-3">{badge.emoji}</div>
        <div className="text-white font-black text-xl mb-1">{badge.name}</div>
        <p className="text-purple-300 text-sm mb-3 italic">&ldquo;{badge.copy}&rdquo;</p>
        {/* Rank + best distance pills */}
        {(badge.rank || badge.bestDistance !== undefined) && (
          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            {badge.rank && badge.totalPlayers && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-900/50 border border-purple-500/30 text-purple-300">
                #{badge.rank} of {badge.totalPlayers}
              </span>
            )}
            {badge.bestDistance !== null && badge.bestDistance !== undefined && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-500/30 text-emerald-300">
                {badge.bestDistance === 0 ? '🎯 Exact match!' : `Best: off by ${badge.bestDistance}`}
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all text-sm"
        >
          📤 Share this badge
        </button>
      </div>

      <ShareArtifactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        imageUrl={imageUrl}
        fileName={badgeFileName(playerName, badge)}
        title={badgeShareTitle(shareCtx)}
        shareText={badgeShareText(shareCtx)}
        onShared={onShare}
      />
    </>
  )
}
