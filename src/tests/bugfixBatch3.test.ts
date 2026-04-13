/**
 * bugfixBatch3.test.ts
 *
 * Tests for the third batch of fixes:
 * - Badge share button: Web Share API + download fallback (organizer)
 * - "Pre-select this pack" localStorage save
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Fix G: Badge share — logic for Web Share API with download fallback
// The handler is inlined in GameOverOrganizer. We test the decision logic here.
// ---------------------------------------------------------------------------

// Extracted handler (mirrors GameOverOrganizer implementation)
async function badgeShareHandler(
  imageUrl: string,
  share: ((data: ShareData) => Promise<void>) | undefined,
  createAndClickLink: (href: string, download: string) => void,
  fetchBlob: (url: string) => Promise<Blob>,
): Promise<'shared' | 'downloaded'> {
  if (share) {
    try {
      const blob = await fetchBlob(imageUrl)
      const file = new File([blob], 'my-badge.png', { type: 'image/png' })
      await share({ files: [file], title: 'My Social Mirror badge' })
      return 'shared'
    } catch {
      // fall through
    }
  }
  createAndClickLink(imageUrl, 'social-mirror-badge.png')
  return 'downloaded'
}

describe('Fix G: Badge share Web Share API + fallback', () => {
  it('uses Web Share API when available and succeeds', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)
    const linkMock = vi.fn()
    const fetchBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }))

    const result = await badgeShareHandler('/api/badge/s/p', shareMock, linkMock, fetchBlob)

    expect(result).toBe('shared')
    expect(shareMock).toHaveBeenCalledOnce()
    expect(shareMock.mock.calls[0][0]).toMatchObject({ title: 'My Social Mirror badge' })
    expect(linkMock).not.toHaveBeenCalled()
  })

  it('falls back to download when Web Share API throws (e.g. user aborts)', async () => {
    const shareMock = vi.fn().mockRejectedValue(new DOMException('AbortError'))
    const linkMock = vi.fn()
    const fetchBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }))

    const result = await badgeShareHandler('/api/badge/s/p', shareMock, linkMock, fetchBlob)

    expect(result).toBe('downloaded')
    expect(linkMock).toHaveBeenCalledWith('/api/badge/s/p', 'social-mirror-badge.png')
  })

  it('falls back to download when navigator.share is not available', async () => {
    const linkMock = vi.fn()
    const fetchBlob = vi.fn()

    const result = await badgeShareHandler('/api/badge/s/p', undefined, linkMock, fetchBlob)

    expect(result).toBe('downloaded')
    expect(fetchBlob).not.toHaveBeenCalled()
    expect(linkMock).toHaveBeenCalledWith('/api/badge/s/p', 'social-mirror-badge.png')
  })

  it('shares correct session/player url', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)
    const linkMock = vi.fn()
    const fetchBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }))

    await badgeShareHandler('/api/badge/session-abc/player-xyz', shareMock, linkMock, fetchBlob)

    expect(fetchBlob).toHaveBeenCalledWith('/api/badge/session-abc/player-xyz')
    const sharedFile: File = shareMock.mock.calls[0][0].files[0]
    expect(sharedFile.name).toBe('my-badge.png')
    expect(sharedFile.type).toBe('image/png')
  })
})

// ---------------------------------------------------------------------------
// Fix H: Pack pre-select — saves packId to storage
// ---------------------------------------------------------------------------

// Extracted logic from handleUseSamePack (mirrors GameOverOrganizer)
function useSamePack(
  packId: string | null,
  storage: { setItem: (k: string, v: string) => void },
): boolean {
  if (!packId) return false
  storage.setItem('gtg_last_pack_id', packId)
  return true
}

describe('Fix H: Pack pre-select saves to storage', () => {
  it('saves packId when pack exists', () => {
    const storage = { setItem: vi.fn() }
    const result = useSamePack('pack-bollywood-2024', storage)
    expect(result).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith('gtg_last_pack_id', 'pack-bollywood-2024')
  })

  it('does nothing and returns false when packId is null', () => {
    const storage = { setItem: vi.fn() }
    const result = useSamePack(null, storage)
    expect(result).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('does nothing and returns false when packId is empty string', () => {
    const storage = { setItem: vi.fn() }
    const result = useSamePack('', storage)
    expect(result).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('overwrites previously saved packId', () => {
    const store: Record<string, string> = { gtg_last_pack_id: 'old-pack' }
    const storage = { setItem: (k: string, v: string) => { store[k] = v } }
    useSamePack('new-pack', storage)
    expect(store['gtg_last_pack_id']).toBe('new-pack')
  })
})
