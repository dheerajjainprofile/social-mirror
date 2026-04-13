'use client'

import { useState } from 'react'

interface FeedbackWidgetProps {
  playerName: string
  role: 'player' | 'organizer'
  roomCode: string
  scoringMode: string
  roundsPlayed: number
  playerCount: number
}

const EMOJIS = [
  { value: '😭', label: 'Bad' },
  { value: '😐', label: 'OK' },
  { value: '😊', label: 'Good' },
  { value: '🤩', label: 'Amazing' },
]

export default function FeedbackWidget({
  playerName,
  role,
  roomCode,
  scoringMode,
  roundsPlayed,
  playerCount,
}: FeedbackWidgetProps) {
  const [rating, setRating] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitFailed, setSubmitFailed] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (dismissed) return null

  if (submitted) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
        <div className="text-3xl mb-2">🙌</div>
        <p className="text-white font-bold">Thanks for the feedback!</p>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!rating) return
    setSubmitting(true)
    setSubmitFailed(false)
    try {
      const res = await fetch('/api/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_rating: rating,
          feedback_text: text.trim() || null,
          player_name: anonymous ? null : playerName,
          role,
          room_code: roomCode,
          scoring_mode: scoringMode,
          rounds_played: roundsPlayed,
          player_count: playerCount,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setSubmitFailed(true)
      }
    } catch {
      setSubmitFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-sm">How was the game?</h3>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Emoji selector */}
      <div className="flex justify-center gap-4">
        {EMOJIS.map((e) => (
          <button
            key={e.value}
            onClick={() => setRating(e.value)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
              rating === e.value
                ? 'border-purple-500 bg-purple-900/30 scale-110'
                : 'border-slate-600 hover:border-slate-500'
            }`}
          >
            <span className="text-3xl">{e.value}</span>
            <span className="text-xs text-slate-400">{e.label}</span>
          </button>
        ))}
      </div>

      {/* Optional text */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Any thoughts? (optional)"
        className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white placeholder-slate-400 text-sm resize-none focus:outline-none focus:border-purple-500"
        rows={2}
      />

      {/* Anonymous toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="w-4 h-4 accent-purple-500"
        />
        <span className="text-slate-400 text-sm">Submit anonymously</span>
      </label>

      <button
        onClick={handleSubmit}
        disabled={!rating || submitting}
        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
      {submitFailed && (
        <p className="text-red-400 text-xs text-center">Failed to submit — please try again.</p>
      )}
    </div>
  )
}
