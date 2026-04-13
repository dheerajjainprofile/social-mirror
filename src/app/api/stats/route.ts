import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
// Revalidate every 5 minutes so the stat is fresh but not hammering the DB
export const revalidate = 300

export async function GET() {
  try {
    const [{ count: sessions }, { count: players }, { count: rounds }] = await Promise.all([
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'ended'),
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_organizer', false),
      supabase.from('rounds').select('*', { count: 'exact', head: true }),
    ])

    return Response.json({
      games: sessions ?? 0,
      players: players ?? 0,
      rounds: rounds ?? 0,
    })
  } catch {
    return Response.json({ games: 0, players: 0, rounds: 0 }, { status: 500 })
  }
}
