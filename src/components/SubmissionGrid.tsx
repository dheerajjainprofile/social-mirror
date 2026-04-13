'use client'

interface Player {
  id: string
  name: string
  is_organizer: boolean
}

interface SubmissionGridProps {
  players: Player[]
  submittedIds: string[]
  targetPlayerId?: string
  label?: string
  organizerPlays?: boolean
}

export default function SubmissionGrid({
  players,
  submittedIds,
  targetPlayerId,
  label = 'Waiting for submissions',
  organizerPlays,
}: SubmissionGridProps) {
  const eligible = players.filter((p) => p.id !== targetPlayerId && (!p.is_organizer || organizerPlays))
  const submitted = eligible.filter((p) => submittedIds.includes(p.id)).length

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex justify-between items-center mb-3">
        <span className="text-slate-300 text-sm font-medium">{label}</span>
        <span className="text-purple-400 font-bold">
          {submitted}/{eligible.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {eligible.map((player) => {
          const done = submittedIds.includes(player.id)
          return (
            <div
              key={player.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                done
                  ? 'bg-green-900/60 border border-green-500 text-green-300'
                  : 'bg-slate-700 border border-slate-600 text-slate-400'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                  done ? 'text-green-400' : 'text-slate-600'
                }`}
              >
                {done ? '✓' : '○'}
              </span>
              {player.name}
            </div>
          )
        })}
      </div>
    </div>
  )
}
