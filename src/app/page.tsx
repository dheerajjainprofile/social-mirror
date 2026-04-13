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

        {/* CTAs */}
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

        {/* How it works — minimal, visual */}
        <div className="w-full mb-8 md:mb-10">
          <div className="flex items-center justify-center gap-3 mb-5">
            {/* Step pills */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,77,106,0.08)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: '#FF4D6A' }}>1</div>
              <span className="text-xs font-bold" style={{ color: '#FF4D6A' }}>Rate</span>
            </div>
            <div style={{ color: '#DDD' }}>→</div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,138,92,0.08)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: '#FF8A5C' }}>2</div>
              <span className="text-xs font-bold" style={{ color: '#FF8A5C' }}>Reveal</span>
            </div>
            <div style={{ color: '#DDD' }}>→</div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,209,102,0.08)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: '#FFD166' }}>3</div>
              <span className="text-xs font-bold" style={{ color: '#CC9B30' }}>Discover</span>
            </div>
          </div>

          {/* The hero takeaway card */}
          <div className="rounded-2xl p-5 border-2"
            style={{ background: '#FFFFFF', borderColor: '#FF4D6A' }}>
            <div className="text-sm font-black mb-3" style={{ color: '#1A1A1A' }}>
              Every player gets:
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs" style={{ color: '#555' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(0,184,148,0.1)' }}>💪</div>
                <span className="font-medium">Hidden strengths</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(255,77,106,0.1)' }}>🎭</div>
                <span className="font-medium">Your mask vs. reality</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(255,209,102,0.1)' }}>🎯</div>
                <span className="font-medium">Weekly challenge</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(255,138,92,0.1)' }}>🤝</div>
                <span className="font-medium">Friend compatibility</span>
              </div>
            </div>
          </div>
        </div>

        {/* Insight teaser */}
        <div className="w-full mb-8 md:mb-10 rounded-2xl p-5 text-center"
          style={{ background: '#1A1A1A', color: '#FAF8F5' }}>
          <div className="text-base md:text-lg font-black mb-1 leading-snug">
            &ldquo;Your friends see someone more{' '}
            <span style={{
              background: 'linear-gradient(135deg, #FF4D6A, #FF8A5C)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>adventurous</span>{' '}
            than you see yourself.&rdquo;
          </div>
          <div className="text-xs" style={{ color: '#666' }}>
            20 minutes. Real friends. Real insights.
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs" style={{ color: '#CCC' }}>
          Built by{' '}
          <a href="https://www.linkedin.com/in/dheerajjain-gim" target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2" style={{ color: '#AAA' }}>
            Dheeraj Jain
          </a>
        </div>
      </div>
    </main>
  )
}
