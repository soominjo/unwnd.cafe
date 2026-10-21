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
