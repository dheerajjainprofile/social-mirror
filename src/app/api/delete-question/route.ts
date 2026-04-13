import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { question_id } = await request.json()
    if (!question_id) {
      return Response.json({ error: 'question_id is required' }, { status: 400 })
    }

    // Only allow deleting player-submitted questions (not preloaded ones)
    const { data: question } = await supabase
      .from('questions')
      .select('source')
      .eq('id', question_id)
      .single()

    if (!question) {
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    if (question.source === 'preloaded') {
      return Response.json({ error: 'Cannot delete pre-loaded questions' }, { status: 403 })
    }

    // Null out round references before deleting
    await supabase.from('rounds').update({ question_id: null }).eq('question_id', question_id)

    const { error } = await supabase.from('questions').delete().eq('id', question_id)
    if (error) {
      console.error('Delete question error:', error)
      return Response.json({ error: 'Failed to delete question' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('delete-question error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
