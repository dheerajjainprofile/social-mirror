import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/question-event
// Logs question lifecycle events for analytics.
// event_type: 'shown' | 'picked' | 'skipped' | 'completed'
// Best-effort — never blocks game flow.
export async function POST(req: NextRequest) {
  try {
    const {
      session_id,
      round_id,
      question_id,
      event_type,
      energy_type,
      pack_id,
      round_number,
    } = await req.json()

    if (!session_id || !event_type) {
      return NextResponse.json({ error: 'session_id and event_type are required' }, { status: 400 })
    }

    await supabase.from('question_events').insert({
      session_id,
      round_id: round_id ?? null,
      question_id: question_id ?? null,
      event_type,
      energy_type: energy_type ?? null,
      pack_id: pack_id ?? null,
      round_number: round_number ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // swallow all errors
  }
}
