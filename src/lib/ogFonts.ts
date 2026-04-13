/**
 * Shared font loader for OG image routes (Satori / ImageResponse).
 *
 * Satori requires explicit font buffers — generic 'sans-serif' / 'system-ui'
 * are silently ignored and produce blank/broken cards.
 *
 * Strategy:
 *  - Regular (400): Geist-Regular.ttf bundled with next/og (always present, zero latency)
 *  - Bold (700):    Inter Bold fetched from Google Fonts CDN (cached per cold-start)
 *
 * Both are module-level cached so subsequent requests in the same serverless instance
 * pay no I/O cost.
 */

import fs from 'fs'
import path from 'path'

let _regular: ArrayBuffer | null = null
let _bold: ArrayBuffer | null = null

/** Geist Regular — bundled inside next/og, loaded from disk */
export async function loadRegularFont(): Promise<ArrayBuffer> {
  if (_regular) return _regular
  // Try the bundled Geist font path first; if unavailable (e.g. custom next.js setup)
  // fall back to a fetch from the Google Fonts CDN.
  const candidates = [
    path.join(process.cwd(), 'node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf'),
    path.join(process.cwd(), 'node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf'),
  ]
  for (const candidate of candidates) {
    try {
      const buf = fs.readFileSync(candidate)
      const font = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
      _regular = font
      return font
    } catch {
      // try next candidate
    }
  }
  // Final fallback: fetch Inter Regular from Google Fonts
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
    ).then((r) => r.text())
    const urlMatch = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)
    if (urlMatch) {
      const font = await fetch(urlMatch[1]).then((r) => r.arrayBuffer())
      _regular = font
      return font
    }
  } catch { /* give up */ }
  throw new Error('Could not load any font for OG image rendering')
}

/**
 * Inter Bold 700 — fetched from Google Fonts at cold-start then cached.
 * Falls back to the regular font if the fetch fails (card still renders).
 */
export async function loadBoldFont(): Promise<ArrayBuffer> {
  if (_bold) return _bold
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } }
    ).then((r) => r.text())

    const urlMatch = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)
    if (!urlMatch) throw new Error('Could not parse Google Fonts CSS for Inter Bold')

    const bold = await fetch(urlMatch[1]).then((r) => r.arrayBuffer())
    _bold = bold
    return bold
  } catch {
    // Graceful degradation: use regular font for bold slots
    return loadRegularFont()
  }
}

export async function loadOgFonts() {
  const [regular, bold] = await Promise.all([loadRegularFont(), loadBoldFont()])
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
  ]
}
