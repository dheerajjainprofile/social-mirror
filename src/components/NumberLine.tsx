'use client'

export interface NumberLinePoint {
  playerName: string
  answer: number
  isTarget?: boolean
  isWinner?: boolean
}

interface NumberLineProps {
  points: NumberLinePoint[]
}

// Deterministic color from name so each player gets a stable avatar hue
function hashHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface Cluster {
  answer: number
  points: NumberLinePoint[]
  isTarget: boolean
}

export default function NumberLine({ points }: NumberLineProps) {
  if (points.length === 0) return null

  const values = points.map((p) => p.answer)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const rawRange = rawMax - rawMin || 1
  const padding = rawRange * 0.25
  const displayMin = rawMin - padding
  const displayMax = rawMax + padding
  const displayRange = displayMax - displayMin

  const toPercent = (val: number) =>
    Math.max(2, Math.min(98, ((val - displayMin) / displayRange) * 100))

  // Cluster by exact answer value so duplicates share one spot
  const clusterMap = new Map<number, Cluster>()
  for (const p of points) {
    const existing = clusterMap.get(p.answer)
    if (existing) {
      existing.points.push(p)
      if (p.isTarget) existing.isTarget = true
    } else {
      clusterMap.set(p.answer, {
        answer: p.answer,
        points: [p],
        isTarget: !!p.isTarget,
      })
    }
  }
  const clusters = [...clusterMap.values()].sort((a, b) => a.answer - b.answer)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <div className="text-slate-400 text-xs uppercase tracking-wider mb-4 font-semibold">
        Answer Distribution
      </div>

      {/* Number line */}
      <div className="relative mt-20 mb-16 mx-2">
        {/* Track */}
        <div className="h-1.5 bg-slate-600 rounded-full w-full" />

        {/* Clusters */}
        {clusters.map((cluster, i) => {
          const pct = toPercent(cluster.answer)
          // Alternate above/below for adjacent clusters
          const above = i % 2 === 0
          const isTarget = cluster.isTarget
          const hasWinner = cluster.points.some((p) => p.isWinner)
          const dotColor = isTarget
            ? 'bg-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.8)] ring-2 ring-yellow-300/60'
            : hasWinner
            ? 'bg-emerald-400'
            : 'bg-purple-400'
          const dotSize = isTarget ? 'w-6 h-6' : 'w-4 h-4'

          return (
            <div
              key={`cluster-${cluster.answer}`}
              className="absolute top-1/2"
              style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
            >
              {/* Center dot on the line */}
              <div className={`rounded-full border-2 border-slate-900 shadow-lg ${dotColor} ${dotSize}`} />

              {/* Label block — fanned avatar stack for duplicates */}
              <div
                className={`absolute flex flex-col items-center ${
                  above ? 'bottom-8' : 'top-8'
                }`}
                style={{ left: '50%', transform: 'translateX(-50%)' }}
              >
                {above ? (
                  <>
                    {renderLabel(cluster)}
                    {renderAvatars(cluster)}
                  </>
                ) : (
                  <>
                    {renderAvatars(cluster)}
                    {renderLabel(cluster)}
                  </>
                )}
              </div>

              {/* Connector line from dot to avatars */}
              <div
                className={`absolute w-px ${above ? 'bottom-4' : 'top-4'} ${
                  isTarget ? 'bg-yellow-400/60' : hasWinner ? 'bg-emerald-400/60' : 'bg-slate-500'
                }`}
                style={{ left: '50%', height: '16px' }}
              />
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {points.map((p) => (
          <div key={`legend-${p.playerName}-${p.answer}`} className="flex items-center gap-1.5 text-xs">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                p.isTarget ? 'bg-yellow-400' : p.isWinner ? 'bg-emerald-400' : 'bg-purple-400'
              }`}
            />
            <span className={p.isTarget ? 'text-yellow-300' : p.isWinner ? 'text-emerald-300' : 'text-slate-400'}>
              {p.playerName}: <span className="font-bold text-white">{p.answer}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderLabel(cluster: Cluster) {
  const color = cluster.isTarget
    ? 'text-yellow-300'
    : cluster.points.some((p) => p.isWinner)
    ? 'text-emerald-300'
    : 'text-white'
  return (
    <div className={`text-sm font-black leading-none mb-1 ${color}`}>
      {cluster.answer}
    </div>
  )
}

function renderAvatars(cluster: Cluster) {
  const pts = cluster.points
  const showCount = Math.min(pts.length, 3)
  const extra = pts.length - showCount
  // Fan horizontally when >1 — ~14px overlap
  return (
    <div className="flex items-center justify-center" style={{ paddingLeft: 6, paddingRight: 6 }}>
      {pts.slice(0, showCount).map((p, idx) => {
        const hue = hashHue(p.playerName)
        const bg = p.isTarget
          ? 'linear-gradient(135deg, #fde047, #f59e0b)'
          : p.isWinner
          ? 'linear-gradient(135deg, #6ee7b7, #059669)'
          : `linear-gradient(135deg, hsl(${hue},70%,60%), hsl(${(hue + 30) % 360},70%,45%))`
        return (
          <div
            key={`${p.playerName}-${idx}`}
            title={p.playerName}
            className="relative flex items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-black text-white shadow-md"
            style={{
              width: 26,
              height: 26,
              marginLeft: idx === 0 ? 0 : -10,
              background: bg,
              zIndex: 10 - idx,
            }}
          >
            {p.isTarget ? '🎯' : p.isWinner ? '🏆' : initials(p.playerName)}
          </div>
        )
      })}
      {extra > 0 && (
        <div
          className="relative flex items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-black text-slate-200 bg-slate-600 shadow-md"
          style={{ width: 26, height: 26, marginLeft: -10, zIndex: 0 }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
