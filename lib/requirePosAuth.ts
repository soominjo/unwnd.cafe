import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Call at the top of every /api/sales/* handler.
 * Returns a 401 NextResponse if the request has no valid pos_auth cookie.
 * Returns null if auth passes (or POS_PIN is not configured — open dev mode).
 */
export async function requirePosAuth(): Promise<NextResponse | null> {
  const posPin = process.env.POS_PIN
  if (!posPin) {
    return NextResponse.json(
      { success: false, error: 'Server misconfiguration: POS_PIN not set' },
      { status: 503 },
    )
  }

  const cookieStore = await cookies()
  const cookie      = cookieStore.get('pos_auth')
  const expected    = await hashPin(posPin)

  if (cookie?.value !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
