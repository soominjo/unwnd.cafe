'use client'

import { useRouter } from 'next/navigation'
import PinPad from '../PinPad'
import { PIN_CHECK_MESSAGES, verifyPosPin } from '../verifyPosPin'

export default function POSLoginPage() {
  const router = useRouter()

  async function logIn(pin: string): Promise<string | null> {
    const result = await verifyPosPin(pin)
    if (result !== 'ok') return PIN_CHECK_MESSAGES[result]
    router.replace('/pos')
    return null
  }

  return (
    <div className="min-h-screen bg-foreground text-cream flex flex-col items-center justify-center select-none">
      <p className="font-logo text-3xl lowercase tracking-tight mb-20 text-cream/80">
        unwnd. pos
      </p>
      <PinPad onComplete={logIn} />
    </div>
  )
}
