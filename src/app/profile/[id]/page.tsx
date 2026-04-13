'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'
import Link from 'next/link'

interface Profile {
  id: string
  local_id: string
  display_name: string
  email: string | null
}

interface SessionEntry {
  session_id: string
  room_code: string
  date: string
  role: string
  selfAwarenessScore: number
  traitSummary: Record<string, { self: number; group: number; gap: number }>
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      // Load profile
      const { data: prof } = await supabase
        .from('player_profiles').select('*').eq('id', id).single()
      if (!prof) { setError('Profile not found'); setLoading(false); return }
      setProfile(prof)

      // Load linked sessions
      const { data: links } = await supabase
        .from('session_profiles').select('session_id, player_id').eq('profile_id', id)

      if (links && links.length > 0) {
        // Batch fetch: avoid N+1 by fetching all sessions and portraits in parallel
        const sessionIds = links.map((l) => l.session_id)
        const [{ data: sessions }, { data: portraits }] = await Promise.all([
          supabase.from('sessions').select('id, room_code, created_at').in('id', sessionIds),
          supabase.from('mirror_portraits').select('session_id, player_id, role, trait_scores, portrait_text')
            .in('session_id', sessionIds),
        ])

        const sessMap = new Map((sessions ?? []).map((s) => [s.id, s]))
        const portMap = new Map((portraits ?? []).map((p) => [`${p.session_id}-${p.player_id}`, p]))

        const sessionEntries: SessionEntry[] = links.map((link) => {
          const sess = sessMap.get(link.session_id)
          const portrait = portMap.get(`${link.session_id}-${link.player_id}`)
          const parsed = portrait?.portrait_text
            ? (typeof portrait.portrait_text === 'string' ? JSON.parse(portrait.portrait_text) : portrait.portrait_text)
            : {}
          return {
            session_id: link.session_id,
            room_code: sess?.room_code ?? '???',
            date: sess ? new Date(sess.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
            role: portrait?.role || 'Unknown',
            selfAwarenessScore: parsed?.selfAwarenessScore ?? 50,
            traitSummary: (portrait?.trait_scores as Record<string, { self: number; group: number; gap: number }>) ?? {},
          }
        }).filter((e) => e.room_code !== '???')
          .sort((a, b) => b.session_id.localeCompare(a.session_id)) // stable sort by ID

        setSessions(sessionEntries)
      }

      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <SocialMirrorLogo size={48} />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: '#FAF8F5' }}>
        <div className="text-center">
          <div className="text-2xl mb-2">🪞</div>
          <div className="text-sm font-bold" style={{ color: '#FF4D6A' }}>{error || 'Profile not found'}</div>
          <Link href="/" className="text-sm mt-3 inline-block" style={{ color: '#999' }}>
            Go home
          </Link>
        </div>
      </div>
    )
  }

  // Compute average traits across sessions
  const avgTraits: Record<string, { self: number; group: number; gap: number; count: number }> = {}
  for (const s of sessions) {
    for (const [dim, vals] of Object.entries(s.traitSummary)) {
      if (!avgTraits[dim]) avgTraits[dim] = { self: 0, group: 0, gap: 0, count: 0 }
      avgTraits[dim].self += vals.self
      avgTraits[dim].group += vals.group
      avgTraits[dim].gap += vals.gap
      avgTraits[dim].count++
    }
  }
  const traitAverages = Object.entries(avgTraits).map(([dim, v]) => ({
    dimension: dim,
    self: Math.round((v.self / v.count) * 10) / 10,
    group: Math.round((v.group / v.count) * 10) / 10,
    gap: Math.round((v.gap / v.count) * 10) / 10,
  }))

  return (
    <div className="min-h-dvh p-4" style={{ background: '#FAF8F5' }}>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <SocialMirrorLogo size={36} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#FF4D6A' }}>Mirror Profile</div>
          </div>
        </div>

        {/* Name + stats */}
        <div className="rounded-3xl p-6 mb-4" style={{ background: '#FFFFFF', border: '1px solid #EEEBE6' }}>
          <h1 className="text-3xl font-black mb-1" style={{ color: '#1A1A1A' }}>{profile.display_name}</h1>
          <div className="flex gap-4 mt-3">
            <div>
              <div className="text-2xl font-black" style={{ color: '#1A1A1A' }}>{sessions.length}</div>
              <div className="text-[10px] font-semibold uppercase" style={{ color: '#999' }}>Sessions</div>
            </div>
            {sessions.length > 0 && (
              <div>
                <div className="text-2xl font-black" style={{ color: '#1A1A1A' }}>
                  {Math.round(sessions.reduce((s, e) => s + e.selfAwarenessScore, 0) / sessions.length)}
                </div>
                <div className="text-[10px] font-semibold uppercase" style={{ color: '#999' }}>Avg Self-Awareness</div>
              </div>
            )}
          </div>
        </div>

        {/* Trait averages */}
        {traitAverages.length > 0 && (
          <div className="rounded-3xl p-5 mb-4" style={{ background: '#FFFFFF', border: '1px solid #EEEBE6' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#999' }}>
              Trait Averages (across {sessions.length} sessions)
            </div>
            <div className="space-y-3">
              {traitAverages.map((t) => {
                const gapColor = Math.abs(t.gap) < 0.8 ? '#999' : t.gap > 0 ? '#00B894' : '#FF4D6A'
                return (
                  <div key={t.dimension}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold uppercase" style={{ color: '#999' }}>
                        {LABELS[t.dimension] || t.dimension}
                      </span>
                      <span className="text-xs font-black" style={{ color: gapColor, fontFamily: 'monospace' }}>
                        {t.gap > 0 ? '+' : ''}{t.gap.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-[10px] w-8 text-right" style={{ color: '#BBB' }}>You</span>
                        <div className="flex-1 h-3 rounded-md" style={{ background: '#F3F1ED' }}>
                          <div className="h-full rounded-md" style={{ width: `${((t.self - 1) / 6) * 100}%`, background: '#D0CCC5' }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-[10px] w-8 text-right" style={{ color: '#FF4D6A' }}>Avg</span>
                        <div className="flex-1 h-3 rounded-md" style={{ background: '#F3F1ED' }}>
                          <div className="h-full rounded-md" style={{ width: `${((t.group - 1) / 6) * 100}%`, background: 'linear-gradient(90deg, #FF4D6A, #FF8A5C)' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Session history */}
        {sessions.length > 0 && (
          <div className="rounded-3xl p-5 mb-4" style={{ background: '#FFFFFF', border: '1px solid #EEEBE6' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#999' }}>
              Sessions
            </div>
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: '#F3F1ED' }}>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{s.date}</div>
                    <div className="text-xs" style={{ color: '#888' }}>Room {s.room_code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold" style={{ color: '#FF4D6A' }}>{s.role}</div>
                    <div className="text-[10px]" style={{ color: '#BBB' }}>Awareness: {s.selfAwarenessScore}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🪞</div>
            <div className="text-sm" style={{ color: '#888' }}>No sessions yet. Play Social Mirror to build your profile.</div>
          </div>
        )}

        {/* CTA */}
        <Link
          href="/"
          className="block w-full text-center py-3.5 rounded-full font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)' }}
        >
          Play Social Mirror
        </Link>
      </div>
    </div>
  )
}

const LABELS: Record<string, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  stability: 'Emotional Stability',
}
