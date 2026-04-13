import { supabase } from '@/lib/supabase'
import questionsData from '../../../../data/questions.json'
import packsData from '../../../../data/packs.json'

export async function POST() {
  try {
    // ─── Step 1: Upsert packs (insert if name not exists) ───
    const packInserts = packsData.map((p) => ({
      name: p.name,
      energy_type: p.energy_type,
      description: p.description,
      source: 'preloaded',
    }))

    // Try to fetch existing packs first; insert only the ones missing
    const { data: existingPacks } = await supabase.from('packs').select('*')
    const existingNames = new Set((existingPacks ?? []).map((p: { name: string }) => p.name))
    const toInsert = packInserts.filter((p) => !existingNames.has(p.name))

    if (toInsert.length > 0) {
      const { error: packsError } = await supabase.from('packs').insert(toInsert)
      if (packsError) {
        console.error('Packs insert error:', packsError)
        return Response.json({ error: 'Failed to seed packs' }, { status: 500 })
      }
    }

    const { data: packsResult } = await supabase.from('packs').select('*')

    // Build energy_type → pack_id map
    const packMap: Record<string, string> = {}
    for (const pack of packsResult ?? []) {
      packMap[pack.energy_type] = pack.id
    }

    // ─── Step 2: Wipe existing pre-loaded questions ───
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('source', 'preloaded')

    if (existing && existing.length > 0) {
      const ids = existing.map((q) => q.id)
      await supabase.from('rounds').update({ question_id: null }).in('question_id', ids)
      await supabase.from('questions').delete().in('id', ids)
    }

    // ─── Step 3: Insert fresh questions with pack_id and energy_type ───
    const inserts = questionsData.map((q) => ({
      text: q.text,
      category: q.category,
      energy_type: q.energy_type,
      pack_id: packMap[q.energy_type] ?? null,
      source: 'preloaded',
      submitted_by: null,
      approved: true,
    }))

    const { data, error } = await supabase.from('questions').insert(inserts).select()
    if (error) {
      console.error('Seed error:', error)
      return Response.json({ error: 'Failed to seed questions' }, { status: 500 })
    }

    return Response.json({
      questions: data,
      count: data.length,
      packs: packsResult,
      packCount: (packsResult ?? []).length,
    })
  } catch (err) {
    console.error('seed-questions error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
