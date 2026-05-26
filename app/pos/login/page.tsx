'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫']
const PIN_LENGTH = 4

export default function POSLoginPage() {
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleKey(key: string) {
    if (loading) return
    if (key === '') return

    if (key === '⌫') {
      setPin(prev => prev.slice(0, -1))
      setError(false)
      return
    }

    const next = pin + key
    setPin(next)
    setError(false)

    if (next.length < PIN_LENGTH) return

    setLoading(true)
    try {
      const res = await fetch('/api/pos-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: next }),
      })
      if (res.ok) {
        router.replace('/pos')
      } else {
        setError(true)
        setPin('')
      }
    } catch {
      setError(true)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-foreground text-cream flex flex-col items-center justify-center select-none">
      <p className="font-serif text-3xl lowercase tracking-tight mb-20 text-cream/80">
        unwnd. pos
      </p>

      {/* PIN dots */}
      <div className="flex gap-5 mb-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
              i < pin.length
                ? error
                  ? 'bg-red-400 border-red-400'
                  : 'bg-cream border-cream'
                : 'border-cream/25'
            }`}
          />
        ))}
      </div>

      <div className="h-6 mb-8 flex items-center">
        {error && (
          <p className="text-red-400 text-[10px] uppercase tracking-[0.3em]">
            incorrect pin
          </p>
        )}
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3">
        {PAD.map((key, i) => (
          key === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => handleKey(key)}
              disabled={loading}
              className={`w-20 h-20 rounded-sm text-2xl font-light transition-all duration-150 disabled:opacity-40 ${
                key === '⌫'
                  ? 'text-cream/40 hover:text-cream hover:bg-cream/10 active:scale-95'
                  : 'text-cream border border-cream/15 hover:border-cream/40 hover:bg-cream/10 active:scale-95'
              }`}
            >
              {key}
            </button>
          )
        ))}
      </div>
    </div>
  )
}
