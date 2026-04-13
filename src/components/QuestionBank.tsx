'use client'

import { useState } from 'react'

interface Question {
  id: string
  text: string
  source: string | null
  approved: boolean
  submitted_by: string | null
  pack_id?: string | null
}

interface QuestionBankProps {
  questions: Question[]
  onSelect: (q: Question) => void
  onApprove: (id: string) => void
  onAdd: (text: string, source: string) => void
  onDelete?: (id: string) => void
  onSeed?: () => void
  seedingQuestions?: boolean
  selectedId?: string
  initialQuestionIds?: Set<string>
  usedQuestionIds?: Set<string>
  sessionPackId?: string | null
}

export default function QuestionBank({
  questions,
  onSelect,
  onApprove,
  onAdd,
  onDelete,
  onSeed,
  seedingQuestions,
  selectedId,
  initialQuestionIds,
  usedQuestionIds,
  sessionPackId,
}: QuestionBankProps) {
  const [newText, setNewText] = useState('')
  const [newSource, setNewSource] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  // Track questions the organizer has dismissed from the new-this-session tray
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  // Pack filter: 'pack' = this session's pack only, 'all' = show everything
  const [packFilter, setPackFilter] = useState<'pack' | 'all'>('pack')

  const approved = questions.filter((q) => q.approved)
  const pending = questions.filter((q) => !q.approved)

  const isNewThisSession = (q: Question) =>
    initialQuestionIds ? !initialQuestionIds.has(q.id) : false

  // New-this-session tray: approved, new, not yet dismissed
  const newTray = approved.filter((q) => isNewThisSession(q) && !dismissedIds.has(q.id))
  // Main approved list: excludes undismissed new-session questions
  const allMainApproved = approved.filter((q) => !isNewThisSession(q) || dismissedIds.has(q.id))
  // When a pack is selected AND filter is 'pack', only show questions from that pack
  const mainApproved = sessionPackId && packFilter === 'pack'
    ? allMainApproved.filter((q) => q.pack_id === sessionPackId)
    : allMainApproved

  const handleAdd = async () => {
    if (!newText.trim()) return
    setAdding(true)
    await onAdd(newText.trim(), newSource.trim())
    setNewText('')
    setNewSource('')
    setAdding(false)
    setShowAdd(false)
  }

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]))
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="text-white font-bold">
          Question Bank
          {pending.length > 0 && (
            <span className="ml-2 text-xs bg-amber-500/20 border border-amber-500/50 text-amber-400 px-1.5 py-0.5 rounded-full">
              {pending.length} pending
            </span>
          )}
        </h3>
        <div className="flex gap-2 items-center">
          {onSeed && (
            <button
              onClick={onSeed}
              disabled={seedingQuestions}
              className="text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
              title="Load 25 sample questions"
            >
              {seedingQuestions ? 'Loading...' : '📦 Sample Qs'}
            </button>
          )}
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-purple-400 hover:text-purple-300 text-sm font-semibold transition-colors"
          >
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Pack filter tab bar — only shown when session has a pack selected */}
      {sessionPackId && (
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setPackFilter('pack')}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${packFilter === 'pack' ? 'text-purple-300 border-b-2 border-purple-500 -mb-px bg-purple-900/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            This Pack ({allMainApproved.filter((q) => q.pack_id === sessionPackId).length})
          </button>
          <button
            onClick={() => setPackFilter('all')}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${packFilter === 'all' ? 'text-slate-200 border-b-2 border-slate-400 -mb-px' : 'text-slate-500 hover:text-slate-300'}`}
          >
            All ({allMainApproved.length})
          </button>
        </div>
      )}

      {showAdd && (
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Question text (must have a numeric answer)..."
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 text-sm resize-none focus:outline-none focus:border-purple-500 mb-2"
            rows={2}
          />
          <input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder="Source / context (optional)"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-purple-500 mb-2"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newText.trim()}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 text-white font-bold rounded-lg text-sm transition-colors"
          >
            {adding ? 'Adding...' : 'Add & Approve'}
          </button>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto">
        {/* ── New This Session tray ───────────────────────────────────── */}
        {newTray.length > 0 && (
          <div className="border-b-2 border-amber-500/40">
            <div className="px-4 py-2 text-xs font-bold text-amber-400 uppercase tracking-wider bg-amber-900/20 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              New This Session ({newTray.length})
            </div>
            {newTray.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-2 px-4 py-3 border-b border-amber-700/30 bg-amber-900/10 animate-pulse-border"
                style={{ boxShadow: 'inset 3px 0 0 rgb(245 158 11 / 0.6)' }}
              >
                <button
                  onClick={() => onSelect(q)}
                  className="flex-1 text-left"
                >
                  <span className={`text-sm ${selectedId === q.id ? 'text-amber-200 font-semibold' : 'text-amber-100'}`}>
                    {q.text}
                  </span>
                  {q.submitted_by && (
                    <div className="text-xs text-amber-400/80 mt-0.5">💬 submitted by {q.submitted_by}</div>
                  )}
                </button>
                <button
                  onClick={() => handleDismiss(q.id)}
                  className="text-amber-600 hover:text-amber-400 text-xs shrink-0 px-1.5 py-0.5 rounded transition-colors"
                  title="Move to main list"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Pending approval ──────────────────────────────────────────── */}
        {pending.length > 0 && (
          <div>
            <div className="px-4 py-2 text-xs font-bold text-amber-400 uppercase tracking-wider bg-amber-900/20">
              Pending Approval ({pending.length})
            </div>
            {pending.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-2 px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30"
              >
                <div className="flex-1">
                  <span className="text-slate-300 text-sm">{q.text}</span>
                  {q.submitted_by && (
                    <div className="text-xs text-blue-400 mt-0.5">submitted by {q.submitted_by}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onApprove(q.id)}
                    className="text-green-400 hover:text-green-300 text-xs font-bold px-2 py-1 bg-green-900/30 rounded"
                  >
                    Approve
                  </button>
                  {onDelete && q.source !== 'preloaded' && (
                    <button
                      onClick={() => onDelete(q.id)}
                      className="text-red-500 hover:text-red-400 text-xs font-bold px-2 py-1 bg-red-900/20 rounded"
                      title="Delete question"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Approved (main list) ──────────────────────────────────────── */}
        {mainApproved.length === 0 && newTray.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-500 text-sm">
            No approved questions yet.{' '}
            {onSeed && (
              <button onClick={onSeed} disabled={seedingQuestions} className="text-purple-400 underline">
                Load sample questions
              </button>
            )}
          </div>
        ) : mainApproved.length > 0 ? (
          <div>
            <div className="px-4 py-2 text-xs font-bold text-green-400 uppercase tracking-wider bg-green-900/20">
              Approved ({mainApproved.length})
            </div>
            {mainApproved.map((q) => (
              <div
                key={q.id}
                className={`flex items-start gap-2 px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/40 ${
                  selectedId === q.id ? 'bg-purple-900/30 border-l-2 border-l-purple-500' : ''
                }`}
              >
                <button
                  onClick={() => onSelect(q)}
                  className="flex-1 text-left"
                >
                  <span className={`text-sm ${selectedId === q.id ? 'text-purple-200' : 'text-slate-300'}`}>
                    {q.text}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedId === q.id && (
                      <span className="text-xs text-purple-400">Selected</span>
                    )}
                    {usedQuestionIds?.has(q.id) && (
                      <span className="text-xs text-slate-500">✓ Used</span>
                    )}
                  </div>
                </button>
                {onDelete && q.source !== 'preloaded' && (
                  <button
                    onClick={() => onDelete(q.id)}
                    className="text-red-600 hover:text-red-400 text-xs shrink-0 px-1.5 py-0.5 rounded transition-colors opacity-40 hover:opacity-100"
                    title="Delete question"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
