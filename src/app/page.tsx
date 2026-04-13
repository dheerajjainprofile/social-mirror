'use client'

import Link from 'next/link'
import SocialMirrorLogo from '@/components/SocialMirrorLogo'

export default function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #FAF8F5 0%, #FFF5F0 40%, #F5F0FA 100%)' }}>

      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-3 md:mb-5">
          <SocialMirrorLogo size={48} />
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
        <p className="text-center text-base md:text-lg font-medium mb-8 md:mb-10"
          style={{ color: '#666' }}>
          See yourself through the eyes of everyone who knows you.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 md:gap-4 w-full mb-10 md:mb-12">
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

        {/* How it works */}
        <div className="w-full mb-8 md:mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-center mb-4 md:mb-5"
            style={{ color: '#999' }}>
            How it works
          </h2>
          <div className="flex flex-col gap-2">

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
                    "How adventurous is Sarah?" Rate 1-7. She rates herself too.
                  </div>
                </div>
              </div>
            </div>

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
                    Hidden strengths. Blind spots. A challenge card for the week. Things you didn't know about yourself.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sample insight */}
        <div className="w-full mb-8 md:mb-10 rounded-2xl p-5 text-center"
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
