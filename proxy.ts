import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: ['/pos', '/pos/(.+)', '/api/sales', '/api/sales/(.+)'],
}

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith('/api/')

  if (pathname === '/pos/login') return NextResponse.next()

  const posPin = process.env.POS_PIN
  if (!posPin) {
    // POS_PIN is a Node.js-only env var; Edge runtime can't read it.
    // Fall through — requirePosAuth() in each route handler enforces auth.
    return NextResponse.next()
  }

  const cookie   = request.cookies.get('pos_auth')
  const expected = await hashPin(posPin)

  if (cookie?.value === expected) return NextResponse.next()

  if (isApiRoute) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/pos/login', request.url))
}
