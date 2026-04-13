'use client'

import { useEffect, useRef, useState } from 'react'

export interface ShareArtifactModalProps {
  open: boolean
  onClose: () => void
  imageUrl: string          // URL for the artifact image (API route or direct)
  fileName: string          // Meaningful filename including player/host name
  title: string             // Share sheet title
  shareText: string         // Viral copy shown + used in native share
  caption?: string          // Optional long-form caption for Copy Caption
  onShared?: () => void     // Fired after successful share or download
}

// Preview-first share workflow used by all artifacts (badge, session story, …).
// Why: the old single-button flow (navigator.share → download fallback) was
// broken on iOS Safari and confusing on desktop. A preview modal with explicit
// Download / Share / Copy Caption buttons works consistently on every device
// and lets the user SEE what they're sharing before committing.
export default function ShareArtifactModal({
  open,
  onClose,
  imageUrl,
  fileName,
  title,
  shareText,
  caption,
  onShared,
}: ShareArtifactModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [canNativeShare, setCanNativeShare] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setImageLoaded(false)
    setStatus('')
    // Feature-detect navigator.share once — defensively, since TS types mark it required
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav && typeof nav.share === 'function') {
      setCanNativeShare(true)
    }
    // Lock body scroll while modal is open
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleDownload = async () => {
    try {
      setStatus('Preparing download…')
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus('Saved ✓')
      onShared?.()
    } catch {
      setStatus('Download failed — long-press the image to save.')
    }
  }

  const handleNativeShare = async () => {
    try {
      setStatus('Opening share sheet…')
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const file = new File([blob], fileName, { type: blob.type || 'image/png' })
      const payload: ShareData = { title, text: shareText }
      // Only attach files if the browser supports sharing them
      if (navigator.canShare?.({ files: [file] })) {
        (payload as ShareData & { files: File[] }).files = [file]
      }
      await navigator.share(payload)
      setStatus('Shared ✓')
      onShared?.()
    } catch (err) {
      // User cancelled or share failed — fall back gracefully
      if ((err as Error)?.name === 'AbortError') {
        setStatus('')
        return
      }
      setStatus('Share failed — try Download instead.')
    }
  }

  const handleCopyCaption = async () => {
    const text = caption ?? shareText
    // navigator.clipboard is undefined in insecure contexts (HTTP on LAN IP, iOS Safari).
    // Guard before calling, and fall back to prompt() so the user can always manually copy.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard?.writeText(text)
        setStatus('Caption copied ✓')
        return
      }
    } catch { /* clipboard write denied */ }
    window.prompt('Copy this caption:', text)
    setStatus('')
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 my-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share artifact"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-black text-lg">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Preview */}
        <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
              Loading preview…
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-auto transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>

        {/* Viral copy preview */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mb-1">
            Caption
          </div>
          <p className="text-slate-200 text-sm leading-snug whitespace-pre-line">{shareText}</p>
        </div>

        <p className="text-slate-500 text-xs text-center sm:hidden">
          💡 On mobile: long-press the image to save it directly
        </p>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-2">
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl text-sm"
            >
              📤 Share
            </button>
          )}
          <button
            onClick={handleDownload}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-bold rounded-xl text-sm"
          >
            📥 Download image
          </button>
          <button
            onClick={handleCopyCaption}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl text-sm"
          >
            📋 Copy caption
          </button>
        </div>

        {status && (
          <div className="text-center text-xs text-purple-300 font-semibold">{status}</div>
        )}
      </div>
    </div>
  )
}
