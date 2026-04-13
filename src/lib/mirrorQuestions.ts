import { supabase } from './supabase'

export interface MirrorQuestion {
  id: string
  text: string
  dimension: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'stability'
  anchor_low: string
  anchor_high: string
}

const DIMENSIONS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'stability'] as const

/**
 * Select questions for a mirror session.
 *
 * Strategy: 2 questions per subject, each from a different dimension.
 * Maximize dimension coverage across the full session.
 * When perfect coverage isn't possible, prioritize covering all 5 dimensions
 * at least once before doubling up.
 *
 * @param playerCount - number of players (subjects)
 * @param questionsPerSubject - questions each subject faces (default 2)
 * @returns Array of { subjectIndex, question } assignments
 */
export async function selectMirrorQuestions(
  playerCount: number,
  questionsPerSubject = 2
): Promise<{ subjectIndex: number; question: MirrorQuestion }[]> {
  const { data: allQuestions, error } = await supabase
    .from('mirror_questions')
    .select('*')

  if (error || !allQuestions || allQuestions.length === 0) {
    throw new Error('Failed to load mirror questions')
  }

  // Group questions by dimension
  const byDimension = new Map<string, MirrorQuestion[]>()
  for (const q of allQuestions) {
    const list = byDimension.get(q.dimension) || []
    list.push(q)
    byDimension.set(q.dimension, list)
  }

  // Shuffle each dimension's pool
  for (const [, pool] of byDimension) {
    shuffleInPlace(pool)
  }

  const totalQuestions = playerCount * questionsPerSubject
  const assignments: { subjectIndex: number; question: MirrorQuestion }[] = []
  const usedQuestionIds = new Set<string>()

  // Round-robin through dimensions to maximize coverage
  let dimIndex = 0
  for (let subject = 0; subject < playerCount; subject++) {
    const subjectDims = new Set<string>()

    for (let q = 0; q < questionsPerSubject; q++) {
      // Find a dimension we haven't used for this subject yet
      let attempts = 0
      while (subjectDims.has(DIMENSIONS[dimIndex % DIMENSIONS.length]) && attempts < DIMENSIONS.length) {
        dimIndex++
        attempts++
      }

      const dim = DIMENSIONS[dimIndex % DIMENSIONS.length]
      const pool = byDimension.get(dim) || []

      // Pick an unused question from this dimension
      const question = pool.find((qu) => !usedQuestionIds.has(qu.id))
        || pool[0] // fallback: reuse if exhausted

      if (question) {
        assignments.push({ subjectIndex: subject, question })
        usedQuestionIds.add(question.id)
        subjectDims.add(dim)
      }

      dimIndex++
    }
  }

  return assignments
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
