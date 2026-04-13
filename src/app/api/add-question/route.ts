import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, source, submitted_by, auto_approve = false } = body

    if (!text?.trim()) {
      return Response.json({ error: 'Question text is required' }, { status: 400 })
    }

    const { data: question, error } = await supabase
      .from('questions')
      .insert({
        text: text.trim(),
        source: source ?? null,
        submitted_by: submitted_by ?? null,
        approved: auto_approve,
      })
      .select()
      .single()

    if (error) {
      console.error('Add question error:', error)
      return Response.json({ error: 'Failed to add question' }, { status: 500 })
    }

    return Response.json({ question })
  } catch (err) {
    console.error('add-question error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
