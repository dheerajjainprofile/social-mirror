import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { question_id, approved = true } = body

    if (!question_id) {
      return Response.json({ error: 'question_id is required' }, { status: 400 })
    }

    const { data: question, error } = await supabase
      .from('questions')
      .update({ approved })
      .eq('id', question_id)
      .select()
      .single()

    if (error) {
      return Response.json({ error: 'Failed to update question' }, { status: 500 })
    }

    return Response.json({ question })
  } catch (err) {
    console.error('approve-question error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
