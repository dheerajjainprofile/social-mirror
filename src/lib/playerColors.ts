// Player colours by join-order index — guarantees unique colours within a session
// 10 distinct, accessible colours that look good on dark backgrounds

const COLORS = [
  { bg: 'bg-purple-500',  border: 'border-purple-400',  text: 'text-purple-300',  dot: '#a855f7' },
  { bg: 'bg-pink-500',    border: 'border-pink-400',    text: 'text-pink-300',    dot: '#ec4899' },
  { bg: 'bg-cyan-500',    border: 'border-cyan-400',    text: 'text-cyan-300',    dot: '#06b6d4' },
  { bg: 'bg-amber-500',   border: 'border-amber-400',   text: 'text-amber-300',   dot: '#f59e0b' },
  { bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-300', dot: '#10b981' },
  { bg: 'bg-rose-500',    border: 'border-rose-400',    text: 'text-rose-300',    dot: '#f43f5e' },
  { bg: 'bg-indigo-500',  border: 'border-indigo-400',  text: 'text-indigo-300',  dot: '#6366f1' },
  { bg: 'bg-orange-500',  border: 'border-orange-400',  text: 'text-orange-300',  dot: '#f97316' },
  { bg: 'bg-teal-500',    border: 'border-teal-400',    text: 'text-teal-300',    dot: '#14b8a6' },
  { bg: 'bg-violet-500',  border: 'border-violet-400',  text: 'text-violet-300',  dot: '#8b5cf6' },
]

export function getPlayerColorByIndex(index: number) {
  return COLORS[index % COLORS.length]
}

/** @deprecated Use getPlayerColorByIndex with the player's join-order position */
export function getPlayerColor(_playerId: string) {
  return COLORS[0]
}
