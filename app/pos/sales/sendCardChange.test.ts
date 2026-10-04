import { describe, it, expect } from 'vitest'
import { CARD_CHANGE_MESSAGES, sendCardChange } from './sendCardChange'

const reply = (status: number, body: unknown): typeof fetch => async () =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

describe('sendCardChange', () => {
  it('sends the change and gives back what was saved', async () => {
    let sent: RequestInit | undefined
    const fetchImpl: typeof fetch = async (url, init) => {
      expect(url).toBe('/api/loyalty/members')
      sent = init
      return new Response(JSON.stringify({ success: true, data: { cardNumber: 8 } }), { status: 201 })
    }
    expect(await sendCardChange('/api/loyalty/members', 'POST', { name: 'Kylene' }, fetchImpl))
      .toEqual({ message: null, data: { cardNumber: 8 } })
    expect(sent?.method).toBe('POST')
    expect(JSON.parse(String(sent?.body))).toEqual({ name: 'Kylene' })
  })

  it('removes a card with no PIN and no body', async () => {
    let sent: RequestInit | undefined
    const fetchImpl: typeof fetch = async (url, init) => {
      expect(url).toBe('/api/loyalty/members/kylene')
      sent = init
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }
    expect(await sendCardChange('/api/loyalty/members/kylene', 'DELETE', undefined, fetchImpl)).toEqual({ message: null })
    expect(sent?.method).toBe('DELETE')
    expect(sent?.body).toBeUndefined()
    expect(sent?.headers).toBeUndefined()
  })

  it('flags a card the server says is already gone (404), with its reason', async () => {
    expect(await sendCardChange('/x', 'DELETE', undefined, reply(404, { success: false, error: 'That card holder no longer exists.' })))
      .toEqual({ message: 'That card holder no longer exists.', gone: true })
    // A 404 page from something other than the API is not a card that is gone.
    expect(await sendCardChange('/x', 'DELETE', undefined, reply(404, '<html>Not found</html>')))
      .toEqual({ message: CARD_CHANGE_MESSAGES.failed })
  })

  it('says when the POS has signed out (401)', async () => {
    expect((await sendCardChange('/x', 'DELETE', undefined, reply(401, { success: false, error: 'Unauthorized' }))).message)
      .toBe(CARD_CHANGE_MESSAGES.signedOut)
  })

  it('flags a change with no reply as unsure, since it may have been saved', async () => {
    const offline: typeof fetch = async () => { throw new TypeError('Failed to fetch') }
    expect(await sendCardChange('/x', 'POST', { name: 'Kylene' }, offline)).toEqual({ message: CARD_CHANGE_MESSAGES.noReply, unsure: true })
  })

  it('shows the server’s own reason, or a generic one when the reply is not the API’s', async () => {
    expect((await sendCardChange('/x', 'POST', { name: 'K ←' }, reply(400, { success: false, error: 'Use letters, numbers and simple punctuation only.' }))).message)
      .toBe('Use letters, numbers and simple punctuation only.')
    expect(CARD_CHANGE_MESSAGES.failed).not.toMatch(/check/)
    expect((await sendCardChange('/x', 'POST', { name: 'Kylene' }, reply(502, '<html>Bad gateway</html>'))).message)
      .toBe(CARD_CHANGE_MESSAGES.failed)
    expect((await sendCardChange('/x', 'POST', { name: 'Kylene' }, reply(200, '<html>captive portal</html>'))).message)
      .toBe(CARD_CHANGE_MESSAGES.failed)
  })
})
