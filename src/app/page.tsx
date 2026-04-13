'use client'

import Link from 'next/link'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'

const FLOATING_INSIGHTS = [
  { text: '🪞 "You rated yourself 3... friends said 6.2"',   top: '8%',  left: '3%',  opacity: 0.20, duration: '10s',  delay: '0s',   size: 'text-xs' },
  { text: '⚡ The Spark',                                    top: '18%', left: '60%', opacity: 0.18, duration: '11s',  delay: '1.2s', size: 'text-sm' },
  { text: '🤝 87% compatible',                               top: '62%', left: '2%',  opacity: 0.16, duration: '9s',   delay: '0.5s', size: 'text-xs' },
  { text: '🔮 Biggest surprise of the night',                top: '72%', left: '55%', opacity: 0.22, duration: '8s',   delay: '2s',   size: 'text-xs' },
  { text: '🪞 Hidden strength: empathy',                     top: '42%', left: '63%', opacity: 0.15, duration: '12s',  delay: '0.8s', size: 'text-xs' },
  { text: '🧭 The Explorer',                                 top: '52%', left: '1%',  opacity: 0.20, duration: '9.5s', delay: '2.5s', size: 'text-sm' },
  { text: '📊 Self-awareness: 78%',                          top: '28%', left: '5%',  opacity: 0.14, duration: '13s',  delay: '3s',   size: 'text-xs' },
  { text: '🎯 Challenge: notice when you light up a room',   top: '82%', left: '38%', opacity: 0.17, duration: '10s',  delay: '0.3s', size: 'text-xs' },
]

export default function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden"
      style={{ background: '#FAF8F5' }}>

      {/* Floating insight bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        {FLOATING_INSIGHTS.map((b, i) => (
          <div
            key={i}
            className={`absolute ${b.size} font-semibold rounded-full px-3 py-1.5 whitespace-nowrap animate-float`}
            style={{
              top: b.top,
              left: b.left,
              opacity: b.opacity,
              color: '#1A1A1A',
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid #EEEBE6',
              ['--float-duration' as string]: b.duration,
              ['--float-delay' as string]: b.delay,
            }}
          >
            {b.text}
          </div>
        ))}
        {/* Warm gradient blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(255,77,106,0.06)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(255,138,92,0.06)' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">

        {/* Brand */}
        <div className="flex items-center gap-4 mb-3 md:mb-5">
          <SocialMirrorLogo size={56} />
          <h1 className="font-black text-4xl md:text-5xl tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C, #FFD166)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
            Social Mirror
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-center text-base md:text-lg font-medium mb-6 md:mb-8"
          style={{ color: '#666' }}>
          See yourself through the eyes of everyone who knows you.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 md:gap-4 w-full mb-8 md:mb-10">
          <Link
            href="/start"
            className="flex items-center justify-center gap-3 w-full py-4 md:py-5 px-6 text-white font-black text-lg md:text-xl rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
              boxShadow: '0 4px 24px rgba(255,77,106,0.25)',
            }}
          >
            🪞 Start a Session
          </Link>
          <Link
            href="/join"
            className="flex items-center justify-center gap-3 w-full py-4 md:py-5 px-6 font-black text-lg md:text-xl rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1.5px solid #D0CCC5',
            }}
          >
            🙋 Join a Room
          </Link>
        </div>

        {/* How it works — Social Mirror version */}
        <div className="w-full mb-6 md:mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-center mb-4 md:mb-5"
            style={{ color: '#999' }}>
            How it works
          </h2>
          <div className="flex flex-col gap-2">

            {/* Step 1: Rate */}
            <div className="rounded-2xl p-4 border"
              style={{ background: '#FFFFFF', borderColor: '#EEEBE6' }}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl w-10 h-10 flex items-center justify-center text-lg font-black shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)', color: 'white' }}>
                  1
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: '#1A1A1A' }}>Rate your friends</div>
                  <div className="text-xs mt-0.5" style={{ color: '#888' }}>
                    "How adventurous is Sarah?" — rate on 1-7. She rates herself too.
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Discover */}
            <div className="rounded-2xl p-4 border"
              style={{ background: '#FFFFFF', borderColor: '#EEEBE6' }}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl w-10 h-10 flex items-center justify-center text-lg font-black shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF8A5C, #FFD166)', color: 'white' }}>
                  2
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: '#1A1A1A' }}>Discover the gap</div>
                  <div className="text-xs mt-0.5" style={{ color: '#888' }}>
                    Sarah said 3. Friends said 6.2. That gap is where the magic lives.
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Mirror */}
            <div className="rounded-2xl p-4 border"
              style={{ background: '#FFFFFF', borderColor: '#EEEBE6' }}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl w-10 h-10 flex items-center justify-center text-lg font-black shrink-0"
                  style={{ background: '#1A1A1A', color: 'white' }}>
                  3
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: '#1A1A1A' }}>Get your Mirror Portrait</div>
                  <div className="text-xs mt-0.5" style={{ color: '#888' }}>
                    Hidden strengths. Blind spots. A challenge card. Things you didn't know about yourself.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sample insight teaser */}
        <div className="w-full mb-6 md:mb-8 rounded-2xl p-5 text-center"
          style={{ background: '#1A1A1A', color: '#FAF8F5' }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: '#FF4D6A' }}>
            Sample Insight
          </div>
          <div className="text-lg md:text-xl font-black mb-2 leading-snug">
            "Your friends see someone more{' '}
            <span style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>adventurous</span>{' '}
            than you see yourself."
          </div>
          <div className="text-sm" style={{ color: '#888' }}>
            Based on real personality science. Played with real friends.
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs space-y-1" style={{ color: '#BBB' }}>
          <div>
            Built by{' '}
            <a
              href="https://www.linkedin.com/in/dheerajjain-gim"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors"
              style={{ color: '#999' }}
            >
              Dheeraj Jain
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
