'use client'

import type { PersonalityRole } from '@/lib/mirrorEngine'

interface GroupRolesCardProps {
  roles: { playerName: string; role: PersonalityRole }[]
}

/**
 * GroupRolesCard — Shows each player's assigned personality role.
 * Displayed as a horizontal scroll of role badges.
 */
export default function GroupRolesCard({ roles }: GroupRolesCardProps) {
  if (roles.length === 0) return null

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-xs font-bold uppercase tracking-wider text-center mb-4"
        style={{ color: '#999' }}>
        Tonight's Cast
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {roles.map((r, i) => (
          <div key={i}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full"
            style={{ background: '#FFFFFF', border: '1px solid #EEEBE6' }}>
            <span className="text-lg">{r.role.emoji}</span>
            <div>
              <div className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{r.playerName}</div>
              <div className="text-[10px] font-semibold" style={{ color: '#FF4D6A' }}>{r.role.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
