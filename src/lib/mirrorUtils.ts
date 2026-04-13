/**
 * Mirror round utilities.
 * Parses the "mq:{id}|{text}" format used in rounds.question_text
 * to store mirror_question_id without using the FK column.
 */

export function parseMirrorQuestionText(raw: string): { mirrorQuestionId: string | null; displayText: string } {
  if (raw.startsWith('mq:')) {
    const pipeIdx = raw.indexOf('|')
    if (pipeIdx > 3) {
      return {
        mirrorQuestionId: raw.substring(3, pipeIdx),
        displayText: raw.substring(pipeIdx + 1),
      }
    }
  }
  return { mirrorQuestionId: null, displayText: raw }
}
