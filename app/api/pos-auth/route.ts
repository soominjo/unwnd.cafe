import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

// Returns raw 32-byte SHA-256 digest — matches the hex output the middleware produces
function hashPin(pin: string): Buffer {
  return createHash('sha256').update(pin).digest()
}

export async function POST(request: NextRequest) {
  const posPin = process.env.POS_PIN
  if (!posPin) {
    return NextResponse.json({ error: 'POS_PIN not configured' }, { status: 500 })
  }

  let pin: string
  try {
    const body = await request.json()
    pin = String(body.pin ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Reject anything that isn't 4–8 digits before even touching the hash
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  // Constant-time comparison — prevents timing attacks
  if (!timingSafeEqual(hashPin(pin), hashPin(posPin))) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('pos_auth', hashPin(posPin).toString('hex'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/pos',
    maxAge: 8 * 60 * 60,
  })
  return response
}
