'use client'

interface HowToPlayProps {
  onClose: () => void
}

const steps = [
  {
    number: 1,
    title: 'Pick a question',
    desc: 'One player answers secretly.',
  },
  {
    number: 2,
    title: 'Everyone guesses',
    desc: 'Type your number. No peeking.',
  },
  {
    number: 3,
    title: 'Closest wins!',
    desc: 'Answers revealed one by one.',
  },
]

export default function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">How to Play</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {step.number}
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{step.title}</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
        >
          Got it, let&apos;s play!
        </button>
      </div>
    </div>
  )
}
