import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex')
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

  if (pin !== posPin) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('pos_auth', hashPin(posPin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/pos',
    maxAge: 8 * 60 * 60, // 8 hours — one shift
  })
  return response
}
