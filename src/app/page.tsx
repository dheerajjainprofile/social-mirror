'use client'

import Link from 'next/link'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'

export default function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #FAF8F5 0%, #FFF5F0 40%, #F5F0FA 100%)' }}>

      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-2 md:mb-4">
          <SocialMirrorLogo size={44} />
          <h1 className="font-black text-3xl md:text-4xl tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C, #FFD166)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
            Social Mirror
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-center text-base md:text-lg font-medium mb-8 md:mb-10"
          style={{ color: '#666' }}>
          See yourself through the eyes of everyone who knows you.
        </p>

        {/* CTAs — clean, no emojis */}
        <div className="flex flex-col gap-3 md:gap-4 w-full mb-8 md:mb-10">
          <Link
            href="/start"
            className="flex items-center justify-center w-full py-4 md:py-5 px-6 text-white font-black text-lg md:text-xl rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
              boxShadow: '0 4px 24px rgba(255,77,106,0.25)',
            }}
          >
            Start a Session
          </Link>
          <Link
            href="/join"
            className="flex items-center justify-center w-full py-4 md:py-5 px-6 font-black text-lg md:text-xl rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1.5px solid #D0CCC5',
            }}
          >
            Join a Room
          </Link>
        </div>

        {/* How it works — concise, point 3 is the hero */}
        <div className="w-full mb-8 md:mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-center mb-4"
            style={{ color: '#BBB' }}>
            3 steps. 20 minutes. Real insights.
          </h2>

          {/* Steps 1-2: compact */}
          <div className="flex gap-2 mb-2">
            <div className="flex-1 rounded-xl p-3 border"
              style={{ background: '#FFFFFF', borderColor: '#EEEBE6' }}>
              <div className="text-xs font-black mb-0.5" style={{ color: '#FF4D6A' }}>1. Rate</div>
              <div className="text-[11px]" style={{ color: '#888' }}>
                Rate your friends on personality traits. They rate you too.
              </div>
            </div>
            <div className="flex-1 rounded-xl p-3 border"
              style={{ background: '#FFFFFF', borderColor: '#EEEBE6' }}>
              <div className="text-xs font-black mb-0.5" style={{ color: '#FF8A5C' }}>2. Reveal</div>
              <div className="text-[11px]" style={{ color: '#888' }}>
                See the gap between how you see yourself and how others see you.
              </div>
            </div>
          </div>

          {/* Step 3: the hero card — what you GET */}
          <div className="rounded-2xl p-5 border-2"
            style={{ background: '#FFFFFF', borderColor: '#FF4D6A', borderStyle: 'solid' }}>
            <div className="text-xs font-black mb-2" style={{ color: '#FF4D6A' }}>3. Your Mirror Portrait</div>
            <div className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>
              Every player gets a personalized personality portrait:
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]" style={{ color: '#555' }}>
              <div className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: '#00B894' }} />
                <span>Hidden strengths you don't see</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: '#FF4D6A' }} />
                <span>The mask you project vs. reality</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: '#FFD166' }} />
                <span>A personal challenge for the week</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: '#FF8A5C' }} />
                <span>Compatibility map with friends</span>
              </div>
            </div>
          </div>
        </div>

        {/* Insight teaser — not "sample", positioned as a real result */}
        <div className="w-full mb-8 md:mb-10 rounded-2xl p-5 text-center"
          style={{ background: '#1A1A1A', color: '#FAF8F5' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: '#FF8A5C' }}>
            What you'll discover
          </div>
          <div className="text-base md:text-lg font-black mb-2 leading-snug">
            &ldquo;Your friends see someone more{' '}
            <span style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>adventurous</span>{' '}
            than you see yourself. The gap is 3.2 points.&rdquo;
          </div>
          <div className="text-xs" style={{ color: '#666' }}>
            Based on real personality science. Played with real friends.
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs" style={{ color: '#CCC' }}>
          Built by{' '}
          <a
            href="https://www.linkedin.com/in/dheerajjain-gim"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
            style={{ color: '#AAA' }}
          >
            Dheeraj Jain
          </a>
        </div>
      </div>
    </main>
  )
}
