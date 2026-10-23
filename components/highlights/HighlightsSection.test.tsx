import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import HighlightsSection from './HighlightsSection'
import { HIGHLIGHT_PHOTOS } from './photos'

const render = () => renderToStaticMarkup(<HighlightsSection />)
const decode = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"')

describe('HighlightsSection', () => {
  // The owner's second order, 2026-10-23: outside 1, entrance 1, cashier, inside 2, inside 1, outside 3, outside 2.
  it('runs in the owner’s order: patio, driveway, order window, tables, mirror, big umbrella, garden', () => {
    expect(HIGHLIGHT_PHOTOS.map((photo) => photo.src)).toEqual([
      '/highlights/patio.jpg',
      '/highlights/entrance.jpg',
      '/highlights/order-window.jpg',
      '/highlights/tables.jpg',
      '/highlights/mirror.jpg',
      '/highlights/umbrella.jpg',
      '/highlights/garden.jpg',
    ])
  })

  it('describes each of the seven photos once, in that order', () => {
    const alts = [...render().matchAll(/<img [^>]*alt="([^"]+)"/g)].map((match) => decode(match[1]))
    expect(alts).toEqual(HIGHLIGHT_PHOTOS.map((photo) => photo.alt))
  })

  it('draws three silent copies after the last photo, so the loop never runs short, hidden from screen readers', () => {
    const html = render()
    expect(html.match(/<img /g)).toHaveLength(10)
    expect(html.match(/<img [^>]*alt=""/g)).toHaveLength(3)
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(7)
    expect(html).toContain('aria-label="1 of 7"')
    expect(html).toContain('aria-label="7 of 7"')
  })

  it('is a carousel to assistive technology, with Previous, Next and Pause', () => {
    const html = render()
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain('aria-label="Previous photo"')
    expect(html).toContain('aria-label="Next photo"')
    expect(html).toContain('aria-label="Pause the photos"')
  })

  it('heads the section "life at unwnd." with the brand word in the brand font', () => {
    const html = render().replaceAll('<!-- -->', '')
    expect(html).toContain('id="highlights"')
    expect(html).toMatch(/<h2[^>]*>life at <span class="font-logo">unwnd\.<\/span><\/h2>/)
  })
})
