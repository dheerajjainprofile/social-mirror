'use client'

import type { PersonalityRole } from '@/lib/mirrorEngine'

interface GroupRolesCardProps {
  roles: { playerName: string; role: PersonalityRole }[]
}

/**
 * GroupRolesCard — Shows each player's role with description.
 */
export default function GroupRolesCard({ roles }: GroupRolesCardProps) {
  if (roles.length === 0) return null

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-xs font-bold uppercase tracking-wider text-center mb-4"
        style={{ color: '#999' }}>
        Tonight's Cast
      </div>
      <div className="text-[10px] text-center mb-4" style={{ color: '#BBB' }}>
        Based on how your friends rated you, here's the role you played tonight.
      </div>

      <div className="space-y-2">
        {roles.map((r, i) => (
          <div key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: '#FFFFFF', border: '1px solid #EEEBE6' }}>
            <span className="text-2xl">{r.role.emoji}</span>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{r.playerName}</span>
                <span className="text-xs font-semibold" style={{ color: '#FF4D6A' }}>{r.role.name}</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#888' }}>{r.role.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
