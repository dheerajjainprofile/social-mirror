import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      emoji_rating,
      feedback_text,
      player_name,  // null if anonymous
      role,
      room_code,
      scoring_mode,
      rounds_played,
      player_count,
    } = body

    if (!emoji_rating) {
      return Response.json({ error: 'emoji_rating is required' }, { status: 400 })
    }

    const ua = request.headers.get('user-agent') ?? ''
    const isMobile = /mobile|android|iphone|ipad/i.test(ua)
    const device_type = isMobile ? 'mobile' : 'desktop'

    let browser = 'unknown'
    if (/edg\//i.test(ua)) browser = 'Edge'
    else if (/chrome/i.test(ua)) browser = 'Chrome'
    else if (/firefox/i.test(ua)) browser = 'Firefox'
    else if (/safari/i.test(ua)) browser = 'Safari'

    const { error } = await supabase.from('feedback').insert({
      emoji_rating,
      feedback_text: feedback_text?.trim() || null,
      player_name: player_name ?? null,
      role,
      device_type,
      browser,
      room_code,
      scoring_mode,
      rounds_played,
      player_count,
    })

    if (error) {
      console.error('Feedback insert error:', error)
      return Response.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('submit-feedback error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
