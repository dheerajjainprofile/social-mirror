'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'

// Bubbles stay within left: 5%–65% to avoid mobile overflow
const FLOATING_BUBBLES = [
  { text: '💬 Priya said: 47',         top: '10%', left: '5%',  opacity: 0.22, duration: '9s',   delay: '0s',   size: 'text-sm' },
  { text: '💬 Rahul guessed: 12',       top: '20%', left: '62%', opacity: 0.18, duration: '11s',  delay: '1.5s', size: 'text-xs' },
  { text: '💬 How many unread texts...?',top: '65%', left: '5%',  opacity: 0.15, duration: '8s',   delay: '0.7s', size: 'text-xs' },
  { text: '💬 🏆 Ananya wins!',          top: '75%', left: '58%', opacity: 0.25, duration: '7s',   delay: '2s',   size: 'text-sm' },
  { text: '💬 Off by 200 😬',           top: '45%', left: '65%', opacity: 0.18, duration: '10s',  delay: '1s',   size: 'text-xs' },
  { text: '💬 EXACT MATCH 🎯',          top: '55%', left: '3%',  opacity: 0.22, duration: '8.5s', delay: '2.5s', size: 'text-sm' },
  { text: '💬 Passed 🙈',               top: '30%', left: '4%',  opacity: 0.13, duration: '12s',  delay: '3.5s', size: 'text-xs' },
  { text: '💬 The Babu Bhaiya 🤷',      top: '85%', left: '42%', opacity: 0.17, duration: '9.5s', delay: '0.4s', size: 'text-xs' },
]


interface SiteStats {
  games: number
  players: number
  rounds: number
}

const showStats = process.env.NEXT_PUBLIC_SHOW_STATS === 'true'

export default function HomePage() {
  const [stats, setStats] = useState<SiteStats | null>(null)

  useEffect(() => {
    if (!showStats) return
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
  }, [])

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 md:p-6 bg-slate-950 relative overflow-hidden">

      {/* Floating game moment bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        {FLOATING_BUBBLES.map((b, i) => (
          <div
            key={i}
            className={`absolute ${b.size} font-semibold text-white bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1.5 whitespace-nowrap animate-float`}
            style={{
              top: b.top,
              left: b.left,
              opacity: b.opacity,
              ['--float-duration' as string]: b.duration,
              ['--float-delay' as string]: b.delay,
            }}
          >
            {b.text}
          </div>
        ))}
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">

        {/* Brand */}
        <div className="flex items-center gap-4 mb-3 md:mb-6">
          <SocialMirrorLogo size={64} />
          <span className="text-white font-black text-4xl md:text-5xl tracking-tight">Social Mirror</span>
        </div>

        {/* Hero */}
        <div className="text-center mb-4 md:mb-6">
          <h1 className="text-lg md:text-xl font-bold text-slate-300 leading-tight tracking-tight">
            See yourself through your friends' eyes
          </h1>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 md:gap-4 w-full mb-5 md:mb-8">
          <Link
            href="/start"
            className="flex items-center justify-center gap-3 w-full py-4 md:py-5 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-lg md:text-xl rounded-2xl transition-colors shadow-lg shadow-purple-900/40"
          >
            <span>🎮</span> Host a Game
          </Link>
          <Link
            href="/join"
            className="flex items-center justify-center gap-3 w-full py-4 md:py-5 px-6 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-white font-black text-lg md:text-xl rounded-2xl transition-colors"
          >
            <span>🙋</span> Join a Game
          </Link>
        </div>

        {/* Social proof stats — hidden on small screens to keep footer above fold */}
        {showStats && stats && (stats.games > 0 || stats.players > 0) && (
          <div className="w-full mb-4 md:mb-8 hidden sm:flex items-center justify-center gap-6 py-3 px-5 rounded-2xl bg-slate-800/50 border border-slate-700/60">
            {stats.games > 0 && (
              <div className="text-center">
                <div className="text-white font-black text-xl">{stats.games}</div>
                <div className="text-slate-500 text-xs">games played</div>
              </div>
            )}
            {stats.players > 0 && (
              <>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <div className="text-white font-black text-xl">{stats.players}</div>
                  <div className="text-slate-500 text-xs">players</div>
                </div>
              </>
            )}
            {stats.rounds > 0 && (
              <>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <div className="text-white font-black text-xl">{stats.rounds}</div>
                  <div className="text-slate-500 text-xs">rounds</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* How it works — 3 animated self-explanatory scene cards */}
        <div className="w-full mb-3 md:mb-4 relative">
          <div className="absolute -inset-4 bg-slate-950/80 rounded-3xl -z-10" />
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center mb-3 md:mb-5">
            How it works
          </h2>
          <div className="flex flex-col gap-1">

            {/* Scene 1: Host picks a question — purple glow pulse on the card */}
            <div className="hiw-card hiw-card-1 bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-2xl p-4">
              <div className="flex items-center justify-center">
                <div className="relative hiw-glow-purple rounded-xl">
                  <div className="bg-slate-900/80 border border-purple-500/40 rounded-xl px-4 py-2.5 text-center max-w-[230px]">
                    <div className="text-white text-sm font-semibold leading-snug">&ldquo;How many steps do you walk per day?&rdquo;</div>
                  </div>
                  <div className="absolute -top-2.5 -left-3 bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">HOST</div>
                  <div className="text-slate-500 text-[10px] text-center mt-1.5">Host picks a question</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center hiw-arrow hiw-arrow-1"><div className="text-slate-600 text-sm">&#8595;</div></div>

            {/* Scene 2: Target answers + everyone guesses — bubbles pop in, target highlighted */}
            <div className="hiw-card hiw-card-2 bg-gradient-to-br from-pink-500/20 to-pink-500/5 border border-pink-500/30 rounded-2xl p-4">
              <div className="flex items-center justify-center gap-3">
                {/* Target player — highlighted with rose glow */}
                <div className="flex flex-col items-center gap-0.5 hiw-bubble hiw-bubble-1">
                  <div className="bg-rose-500/30 border-2 border-rose-400 rounded-lg px-3 py-1 text-rose-200 font-black text-lg hiw-glow-rose">
                    45
                  </div>
                  <div className="text-rose-400 text-[10px] font-bold">Ananya</div>
                  <div className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none">TARGET &#127919;</div>
                </div>
                {/* Guessers */}
                <div className="flex flex-col items-center gap-0.5 hiw-bubble hiw-bubble-2">
                  <div className="bg-pink-500/20 border border-pink-500/40 rounded-lg px-3 py-1 text-pink-200 font-black text-lg">
                    47
                  </div>
                  <div className="text-slate-400 text-[10px] font-semibold">Priya</div>
                </div>
                <div className="flex flex-col items-center gap-0.5 hiw-bubble hiw-bubble-3">
                  <div className="bg-pink-500/20 border border-pink-500/40 rounded-lg px-3 py-1 text-pink-200 font-black text-lg">
                    12
                  </div>
                  <div className="text-slate-400 text-[10px] font-semibold">Rahul</div>
                </div>
                <div className="flex flex-col items-center gap-0.5 hiw-bubble hiw-bubble-3" style={{ animationDelay: '1.1s' }}>
                  <div className="bg-pink-500/20 border border-pink-500/40 rounded-lg px-3 py-1 text-pink-200 font-black text-lg">
                    ??
                  </div>
                  <div className="text-slate-400 text-[10px] font-semibold">You</div>
                </div>
              </div>
              <div className="text-slate-500 text-[10px] text-center mt-1.5">Target answers secretly. Everyone else guesses!</div>
            </div>

            <div className="flex justify-center hiw-arrow hiw-arrow-2"><div className="text-slate-600 text-sm">&#8595;</div></div>

            {/* Scene 3: Reveal + closest wins — trophy bounces, winner shimmers */}
            <div className="hiw-card hiw-card-3 bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 rounded-2xl p-4">
              <div className="flex items-center justify-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="bg-slate-700/60 border border-slate-600 rounded-lg px-2.5 py-1 text-slate-400 font-bold text-sm">12</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">Rahul</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="hiw-trophy text-base mb-0.5">&#127942;</div>
                  <div className="hiw-shimmer bg-amber-500/30 border-2 border-amber-400 rounded-lg px-2.5 py-1 text-amber-200 font-black text-sm">47</div>
                  <div className="text-amber-400 text-[10px] font-bold mt-0.5">Priya</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="bg-green-500/20 border border-green-500/40 rounded-lg px-2.5 py-1 text-green-300 font-bold text-sm">45</div>
                  <div className="text-green-400 text-[10px] mt-0.5">Answer</div>
                </div>
              </div>
              <div className="text-slate-500 text-[10px] text-center mt-1.5">Closest guess wins!</div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-600 text-xs space-y-1">
          <div>
            Built by{' '}
            <a
              href="https://www.linkedin.com/in/dheerajjain-gim"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-purple-400 transition-colors underline underline-offset-2"
            >
              Dheeraj Jain
            </a>
          </div>
          <div className="text-slate-700">This site uses analytics</div>
        </div>
      </div>

    </main>
  )
}
