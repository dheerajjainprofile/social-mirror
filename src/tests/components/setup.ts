import { vi } from 'vitest'
import '@testing-library/jest-dom'

// ── Next.js mocks ─────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
}))

// ── Sound mocks (no Audio API in jsdom) ──────────────────────────────────────
vi.mock('@/lib/sounds', () => ({
  soundWinner: vi.fn(),
  soundCrowd: vi.fn(),
  soundTick: vi.fn(),
  soundCardReveal: vi.fn(),
  soundGuessSubmit: vi.fn(),
}))

// ── Supabase mock — replaced per-test via mockSupabase() helper ───────────────
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
  },
}))
