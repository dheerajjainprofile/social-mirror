/**
 * ogImageSafety.test.ts
 *
 * Tests to ensure OG image content (badge share, session share) never contains
 * HTML entities — these cause next/og ImageResponse to render blank/broken images.
 *
 * Bugs caught:
 * - &ldquo; &rdquo; in badge image → blank image shared on WhatsApp (#5)
 * - &apos; in session story image → blank image (#6)
 *
 * Rule: OG image JSX must use Unicode or JS string literals, never HTML entities.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const BADGE_ROUTE = resolve(
  process.cwd(),
  'src/app/api/badge/[sessionId]/[playerId]/route.tsx'
)
const SESSION_STORY_ROUTE = resolve(
  process.cwd(),
  'src/app/api/session-story/[code]/route.tsx'
)

// HTML entities that are INVALID inside next/og ImageResponse JSX
const FORBIDDEN_ENTITIES = [
  '&ldquo;',
  '&rdquo;',
  '&apos;',
  '&amp;',
  '&nbsp;',
  '&lsquo;',
  '&rsquo;',
  '&mdash;',
  '&ndash;',
  '&hellip;',
]

function checkFileForEntities(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  return FORBIDDEN_ENTITIES.filter((entity) => content.includes(entity))
}

describe('OG image routes — no HTML entities', () => {
  it('badge route contains no forbidden HTML entities', () => {
    const found = checkFileForEntities(BADGE_ROUTE)
    expect(found).toEqual([]) // empty = no entities found
  })

  it('session-story route contains no forbidden HTML entities', () => {
    const found = checkFileForEntities(SESSION_STORY_ROUTE)
    expect(found).toEqual([])
  })
})

describe('OG image content validation — safe string formats', () => {
  // These test the correct patterns that should be used instead of entities

  it('Unicode escape is valid for curly quotes', () => {
    const badgeCopy = 'You played well'
    const formatted = `\u201c${badgeCopy}\u201d`
    expect(formatted).toBe('\u201cYou played well\u201d')
    expect(formatted).not.toContain('&ldquo;')
    expect(formatted).not.toContain('&rdquo;')
  })

  it('JS string literal is valid for apostrophe', () => {
    const label = "TONIGHT'S HIGHLIGHTS"
    expect(label).toContain("'")
    expect(label).not.toContain('&apos;')
  })

  it('badge copy with special characters renders safely', () => {
    const copies = [
      "You're the heart of the game",
      "It's not about winning",
      "Won't stop guessing",
      'The "bold" move',
    ]
    for (const copy of copies) {
      const formatted = `\u201c${copy}\u201d`
      expect(formatted).not.toMatch(/&[a-z]+;/)
    }
  })
})
