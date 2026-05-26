import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: ['/pos', '/pos/(.+)'],
}

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/pos/login') {
    return NextResponse.next()
  }

  const posPin = process.env.POS_PIN
  if (!posPin) {
    // No PIN configured — open access (local dev)
    return NextResponse.next()
  }

  const cookie = request.cookies.get('pos_auth')
  const expected = await hashPin(posPin)

  if (cookie?.value === expected) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/pos/login', request.url))
}
