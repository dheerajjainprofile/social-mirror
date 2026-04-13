// Web Audio API — all sounds generated programmatically, no asset files needed

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function play(fn: (ctx: AudioContext) => void) {
  const c = getCtx()
  if (c) fn(c)
}

// Must be called from inside a user gesture (click/touch/keypress).
// Creates + resumes the AudioContext so later auto-triggered sounds (reveal
// animation, timer ticks) play reliably. Safe to call multiple times.
export function unlockSound() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

// Soft "pop" on card reveal
export function soundCardReveal() {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(520, c.currentTime)
    o.frequency.exponentialRampToValueAtTime(280, c.currentTime + 0.12)
    g.gain.setValueAtTime(0.18, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18)
    o.start(); o.stop(c.currentTime + 0.18)
  })
}

// Satisfying "ding" on guess submit
export function soundGuessSubmit() {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'triangle'
    o.frequency.setValueAtTime(880, c.currentTime)
    g.gain.setValueAtTime(0.14, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35)
    o.start(); o.stop(c.currentTime + 0.35)
  })
}

// Ascending chime on winner reveal
export function soundWinner() {
  play((c) => {
    const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.connect(g); g.connect(c.destination)
      o.type = 'sine'
      const t = c.currentTime + i * 0.12
      o.frequency.setValueAtTime(freq, t)
      g.gain.setValueAtTime(0.18, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      o.start(t); o.stop(t + 0.4)
    })
  })
}

// Crowd cheer on confetti (short white-noise burst)
export function soundCrowd() {
  play((c) => {
    const bufSize = c.sampleRate * 0.6
    const buf = c.createBuffer(1, bufSize, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.12
    const src = c.createBufferSource()
    const g = c.createGain()
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = 0.8
    src.buffer = buf
    src.connect(filter); filter.connect(g); g.connect(c.destination)
    g.gain.setValueAtTime(1, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6)
    src.start(); src.stop(c.currentTime + 0.6)
  })
}

// ─── Social Mirror Sounds ────────────────────────────────────

// Whoosh on gap bar animation (mini-reveal)
export function soundGapReveal() {
  play((c) => {
    const bufSize = c.sampleRate * 0.4
    const buf = c.createBuffer(1, bufSize, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.08
    const src = c.createBufferSource()
    const g = c.createGain()
    const filter = c.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(200, c.currentTime)
    filter.frequency.exponentialRampToValueAtTime(4000, c.currentTime + 0.3)
    src.buffer = buf
    src.connect(filter); filter.connect(g); g.connect(c.destination)
    g.gain.setValueAtTime(0.25, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
    src.start(); src.stop(c.currentTime + 0.4)
  })
}

// Dramatic reveal sting for portrait drop
export function soundPortraitReveal() {
  play((c) => {
    const notes = [392, 523, 659, 784] // G4 C5 E5 G5
    notes.forEach((freq, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.connect(g); g.connect(c.destination)
      o.type = 'sine'
      const t = c.currentTime + i * 0.08
      o.frequency.setValueAtTime(freq, t)
      g.gain.setValueAtTime(0.15, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      o.start(t); o.stop(t + 0.5)
    })
  })
}

// Surprise hit — short dramatic impact
export function soundSurprise() {
  play((c) => {
    const o = c.createOscillator()
    const o2 = c.createOscillator()
    const g = c.createGain()
    o.connect(g); o2.connect(g); g.connect(c.destination)
    o.type = 'sine'; o2.type = 'sine'
    o.frequency.setValueAtTime(220, c.currentTime)
    o.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.15)
    o2.frequency.setValueAtTime(330, c.currentTime)
    o2.frequency.exponentialRampToValueAtTime(660, c.currentTime + 0.15)
    g.gain.setValueAtTime(0.2, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3)
    o.start(); o.stop(c.currentTime + 0.3)
    o2.start(); o2.stop(c.currentTime + 0.3)
  })
}

// Playful tone for hot take card
export function soundHotTake() {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'triangle'
    o.frequency.setValueAtTime(440, c.currentTime)
    o.frequency.setValueAtTime(554, c.currentTime + 0.1)
    o.frequency.setValueAtTime(659, c.currentTime + 0.2)
    g.gain.setValueAtTime(0.12, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
    o.start(); o.stop(c.currentTime + 0.4)
  })
}

// Rating submit confirmation — soft click
export function soundRatingSubmit() {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(1200, c.currentTime)
    o.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.08)
    g.gain.setValueAtTime(0.1, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12)
    o.start(); o.stop(c.currentTime + 0.12)
  })
}

// Tick-tick for last 5 seconds of timer
export function soundTick() {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'square'
    o.frequency.setValueAtTime(1200, c.currentTime)
    g.gain.setValueAtTime(0.06, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05)
    o.start(); o.stop(c.currentTime + 0.05)
  })
}
