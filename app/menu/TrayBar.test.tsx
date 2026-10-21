import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import TrayBar from './TrayBar'

const text = (html: string) => html.replace(/<[^>]+>/g, '')
const noop = () => {}

describe('TrayBar', () => {
  it('stays hidden until the tray has something', () => {
    expect(renderToStaticMarkup(<TrayBar count={0} total={0} pulseKey={0} onOpen={noop} />)).toBe('')
  })

  it('lets taps through its fade, so a + showing above the bar still works', () => {
    const html = renderToStaticMarkup(<TrayBar count={1} total={120} pulseKey={1} onOpen={noop} />)
    expect(html).toMatch(/^<div class="[^"]*pointer-events-none/)
    expect(html).toMatch(/<button[^>]*class="[^"]*pointer-events-auto/)
  })

  it('shows the count and the total', () => {
    const html = renderToStaticMarkup(<TrayBar count={3} total={450} pulseKey={2} onOpen={noop} />)
    expect(text(html)).toContain('Your tray · 3 items')
    expect(text(html)).toContain('₱450 · View')
    const one = text(renderToStaticMarkup(<TrayBar count={1} total={1200} pulseKey={1} onOpen={noop} />))
    expect(one).toContain('Your tray · 1 item')
    expect(one).not.toContain('1 items')
    expect(one).toContain('₱1,200 · View')
  })
})
