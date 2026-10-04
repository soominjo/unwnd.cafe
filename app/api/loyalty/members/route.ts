import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { cardHolderNameProblem, cleanCardHolderName } from '@/lib/loyalty'
import { addCardHolder, fetchCardHolders } from '@/lib/loyaltyStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authError = await requirePosAuth()
  if (authError) return authError

  try {
    return NextResponse.json({ success: true, data: await fetchCardHolders() })
  } catch (error) {
    console.error('Loyalty card holders could not be read', error)
    return NextResponse.json({ success: false, error: 'Failed to load card holders.' }, { status: 500 })
  }
}

// Giving a card: { name }. Any signed-in POS can give one, with no manager PIN, so it is quick
// at the counter. Removing one takes no PIN either (see [id]/route.ts).
export async function POST(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? cleanCardHolderName(body.name) : ''
  const nameProblem = cardHolderNameProblem(name)
  if (nameProblem) {
    return NextResponse.json({ success: false, error: nameProblem }, { status: 400 })
  }

  try {
    const holder = await addCardHolder(name)
    console.info('Loyalty card given', { id: holder._id, cardNumber: holder.cardNumber })
    return NextResponse.json({ success: true, data: holder }, { status: 201 })
  } catch (error) {
    console.error('Loyalty card holder could not be added', error)
    return NextResponse.json({ success: false, error: 'Failed to add the card holder.' }, { status: 500 })
  }
}
