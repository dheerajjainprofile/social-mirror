/**
 * supabaseMock.ts
 *
 * Builds a controllable Supabase mock for component tests.
 * Supports:
 *  - mockFrom(table, rows)  — seed DB data returned by .select()
 *  - fireEvent(table, event, row) — simulate a realtime postgres_changes event
 *  - subscribeCount / removeCount — count subscribe/removeChannel calls
 */

import { vi } from 'vitest'
import { supabase } from '@/lib/supabase'

type RealtimeHandler = (payload: { new: Record<string, unknown>; old?: Record<string, unknown> }) => void

interface ChannelRegistration {
  handlers: Map<string, RealtimeHandler[]>  // key: `${table}:${event}`
}

let channelReg: ChannelRegistration = { handlers: new Map() }
let subscribeCount = 0
let removeCount = 0
const tableData: Map<string, unknown[]> = new Map()

export function mockFrom(table: string, rows: unknown[]) {
  tableData.set(table, rows)
}

export function getSubscribeCount() { return subscribeCount }
export function getRemoveCount() { return removeCount }

export function fireRealtimeEvent(table: string, event: string, newRow: Record<string, unknown>) {
  const key = `${table}:${event}`
  const handlers = channelReg.handlers.get(key) ?? []
  // Also check wildcard '*'
  const wildcard = channelReg.handlers.get(`${table}:*`) ?? []
  ;[...handlers, ...wildcard].forEach(h => h({ new: newRow }))
}

export function resetMocks() {
  channelReg = { handlers: new Map() }
  subscribeCount = 0
  removeCount = 0
  tableData.clear()
}

/**
 * Wire up the vi.mock'd supabase to respond with seeded data and capture subscriptions.
 */
export function installSupabaseMock() {
  const mockedSupabase = supabase as unknown as {
    from: ReturnType<typeof vi.fn>
    channel: ReturnType<typeof vi.fn>
    removeChannel: ReturnType<typeof vi.fn>
  }

  // .from(table).select().eq().single() / .limit()
  mockedSupabase.from = vi.fn((table: string) => {
    const rows = (tableData.get(table) ?? []) as Record<string, unknown>[]
    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }) }) }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }) }) }),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }),
      then: undefined as unknown,
    }
    // Make the builder thenable so `await supabase.from(...).select(...)` works
    const thenableBuilder = {
      ...builder,
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    }
    Object.setPrototypeOf(thenableBuilder, thenableBuilder)
    return thenableBuilder
  })

  // .channel().on().subscribe()
  mockedSupabase.channel = vi.fn((_name: string) => {
    const channelObj = {
      on: vi.fn((
        _type: string,
        opts: { table: string; event: string },
        handler: RealtimeHandler
      ) => {
        const key = `${opts.table}:${opts.event}`
        if (!channelReg.handlers.has(key)) channelReg.handlers.set(key, [])
        channelReg.handlers.get(key)!.push(handler)
        return channelObj  // chainable
      }),
      subscribe: vi.fn(() => { subscribeCount++; return channelObj }),
    }
    return channelObj
  })

  ;(mockedSupabase as unknown as { removeChannel: ReturnType<typeof vi.fn> }).removeChannel =
    vi.fn(() => { removeCount++ })
}
