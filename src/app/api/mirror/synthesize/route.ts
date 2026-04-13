import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireOrganizer } from '@/lib/requireOrganizer'
import {
  generateSessionReport,
  type RawRating,
  type PlayerInfo,
  type SessionReport,
} from '@/lib/mirrorEngine'

/**
 * POST /api/mirror/synthesize
 *
 * Generates personality portraits, compatibility scores, group dynamics,
 * and the session report from all mirror ratings.
 *
 * Stores results in mirror_portraits and sessions.group_dynamics_result.
 * Returns the full session report.
 *
 * Body: {
 *   session_id: string
 *   organizer_player_id: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, organizer_player_id } = body

    if (!session_id || !organizer_player_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Auth
    const authErr = await requireOrganizer(session_id, organizer_player_id)
    if (authErr) return authErr

    // Check if already synthesized (idempotent)
    const { data: existingPortraits } = await supabase
      .from('mirror_portraits')
      .select('*')
      .eq('session_id', session_id)

    if (existingPortraits && existingPortraits.length > 0) {
      // Return cached results
      const { data: session } = await supabase
        .from('sessions')
        .select('group_dynamics_result')
        .eq('id', session_id)
        .single()

      return NextResponse.json({
        ok: true,
        cached: true,
        portraits: existingPortraits,
        groupDynamics: session?.group_dynamics_result,
      })
    }

    // Fetch all ratings for this session
    const { data: ratingsRaw, error: ratingsErr } = await supabase
      .from('mirror_ratings')
      .select('subject_player_id, rater_player_id, question_id, score')
      .eq('session_id', session_id)

    if (ratingsErr || !ratingsRaw) {
      return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 })
    }

    // Fetch question dimension mapping
    const questionIds = [...new Set(ratingsRaw.map((r) => r.question_id))]
    const { data: questions } = await supabase
      .from('mirror_questions')
      .select('id, dimension')
      .in('id', questionIds)

    const dimMap = new Map<string, string>()
    for (const q of questions ?? []) {
      dimMap.set(q.id, q.dimension)
    }

    // Build raw ratings with dimension info
    const ratings: RawRating[] = ratingsRaw.map((r) => ({
      subject_player_id: r.subject_player_id,
      rater_player_id: r.rater_player_id,
      question_id: r.question_id,
      dimension: (dimMap.get(r.question_id) ?? 'openness') as RawRating['dimension'],
      score: r.score,
    }))

    // Fetch players (non-organizer subjects)
    const { data: allPlayers } = await supabase
      .from('players')
      .select('id, name, is_organizer')
      .eq('session_id', session_id)
      .eq('removed', false)

    const subjects: PlayerInfo[] = (allPlayers ?? [])
      .filter((p) => !p.is_organizer)
      .map((p) => ({ id: p.id, name: p.name }))

    if (subjects.length === 0) {
      return NextResponse.json({ error: 'No players found' }, { status: 400 })
    }

    // Generate the full session report
    const report: SessionReport = generateSessionReport(subjects, ratings)

    // Store portraits in mirror_portraits table
    const portraitInserts = report.portraits.map((p) => ({
      session_id,
      player_id: p.playerId,
      portrait_text: JSON.stringify({
        headline: p.headline,
        hiddenStrengths: p.hiddenStrengths,
        masks: p.masks,
        challengeCard: p.challengeCard,
        reflectionPrompt: p.reflectionPrompt,
        selfAwarenessScore: p.selfAwarenessScore,
      }),
      trait_scores: Object.fromEntries(
        p.traits.map((t) => [t.dimension, {
          self: t.selfScore,
          group: t.groupAvg,
          gap: t.gap,
          raterCount: t.raterCount,
          consensus: t.consensus,
        }])
      ),
      role: p.role.name,
    }))

    const { error: insertErr } = await supabase
      .from('mirror_portraits')
      .upsert(portraitInserts, { onConflict: 'session_id,player_id' })

    if (insertErr) {
      console.error('Failed to store portraits:', insertErr)
      // Continue anyway — return the report even if storage fails
    }

    // Store group dynamics in sessions table
    const groupDynamics = {
      compatibility: report.compatibility,
      biggestSurprise: report.biggestSurprise,
      hotTake: report.hotTake,
      groupRoles: report.groupRoles,
    }

    await supabase
      .from('sessions')
      .update({ group_dynamics_result: groupDynamics })
      .eq('id', session_id)

    return NextResponse.json({
      ok: true,
      cached: false,
      report,
    })
  } catch (err) {
    console.error('synthesize error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
