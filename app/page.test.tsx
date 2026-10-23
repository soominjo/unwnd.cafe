import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { loadGoogleReviews } = vi.hoisted(() => ({ loadGoogleReviews: vi.fn() }))
vi.mock('@/lib/googleReviews', () => ({ loadGoogleReviews }))

import HomePage from './page'

const renderHome = async () => renderToStaticMarkup(await HomePage())

beforeEach(() => {
  loadGoogleReviews.mockReset()
})

describe('the home page', () => {
  it('shows the rating pill and the reviews section when reviews are published', async () => {
    loadGoogleReviews.mockResolvedValue({
      rating: 5, count: 34, reviews: [{ key: 'a', quote: 'Great coffee!', name: 'Ana', month: 'October 2026', stars: 5 }],
    })
    const html = await renderHome()
    expect(html).toContain('href="#reviews"')
    expect(html).toContain('id="reviews"')
    expect(html).toContain('Great coffee!')
    expect(html).toContain('href="https://maps.app.goo.gl/ubi9AsWpWSRoBMVj9?g_st=ic"')
  })

  it('puts the reviews between About and Find us', async () => {
    loadGoogleReviews.mockResolvedValue({ rating: 5, count: 34, reviews: [] })
    const html = await renderHome()
    const about = html.indexOf('id="about"')
    const reviews = html.indexOf('id="reviews"')
    const contact = html.indexOf('id="contact"')
    expect(about).toBeGreaterThan(-1)
    expect(reviews).toBeGreaterThan(about)
    expect(contact).toBeGreaterThan(reviews)
  })

  it('sets the café name in the brand font where the About copy says it', async () => {
    loadGoogleReviews.mockResolvedValue(null)
    // React marks where the {' '} after the name meets the sentence with an empty comment.
    const html = (await renderHome()).replaceAll('<!-- -->', '')
    expect(html).toContain('<span class="font-logo">unwnd.</span> is your neighborhood spot')
    expect(html).toContain('<span class="font-logo">unwnd.</span> is exactly what it sounds like')
  })

  // The owner's hours from 2026-10-23: closed Mondays, open from 4 pm on weekends.
  it('lists the opening hours: closed Monday, Tuesday to Thursday from 5 pm, Friday to Sunday from 4 pm', async () => {
    loadGoogleReviews.mockResolvedValue(null)
    const text = (await renderHome()).replace(/<[^>]+>/g, '')
    const rows = ['MondayClosed', 'Tuesday – Thursday5:00 pm – 12:00 am', 'Friday – Sunday4:00 pm – 12:00 am']
    const at = rows.map((row) => text.indexOf(row))
    expect(at.every((i) => i > -1)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
  })

  it('shows neither when nothing is published', async () => {
    loadGoogleReviews.mockResolvedValue(null)
    const html = await renderHome()
    expect(html).not.toContain('#reviews')
    expect(html).not.toContain('kind words.')
    expect(html).toContain('find us.')
  })

  it('leaves the pill out when there are reviews but no rating', async () => {
    loadGoogleReviews.mockResolvedValue({ rating: null, count: null, reviews: [{ key: 'a', quote: 'Great coffee!', name: 'Ana', month: null, stars: 5 }] })
    const html = await renderHome()
    expect(html).not.toContain('href="#reviews"')
    expect(html).toContain('id="reviews"')
  })
})
