import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .eq('source', 'preloaded')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('packs fetch error:', error)
      return Response.json({ error: 'Failed to fetch packs' }, { status: 500 })
    }

    return Response.json({ packs: data ?? [] })
  } catch (err) {
    console.error('packs error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
