import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ReviewsSection from './ReviewsSection'
import type { ShownReviews } from '@/lib/googleReviews'

const text = (html: string) => html.replace(/<[^>]+>/g, '')
const URL = 'https://maps.app.goo.gl/x'
const ana = { key: 'a', quote: 'Great coffee!', name: 'Ana', month: 'October 2026', stars: 5 }
const ben = { key: 'b', quote: 'Lovely garden.', name: 'Ben', month: null, stars: 4 }
const data: ShownReviews = { rating: 5, count: 34, reviews: [ana, ben] }
const render = (reviews: ShownReviews) => renderToStaticMarkup(<ReviewsSection reviews={reviews} reviewUrl={URL} />)

describe('ReviewsSection', () => {
  it('shows the heading, the score and the count', () => {
    const html = render(data)
    expect(html).toContain('id="reviews"')
    expect(text(html)).toContain('kind words.')
    expect(text(html)).toContain('5.0')
    expect(text(html)).toContain('34 reviews on Google')
    expect(html).toContain('aria-label="Rated 5.0 out of 5"')
  })

  it('says "on Google" alone when the count is unknown', () => {
    const html = render({ ...data, count: null })
    expect(html).toContain('>on Google</')
    expect(text(html)).not.toContain('reviews on Google')
  })

  it('shows each review in quotation marks with the name and month', () => {
    const html = render(data)
    expect(text(html)).toContain('“Great coffee!”')
    expect(text(html)).toContain('Ana · October 2026')
    expect(text(html)).toContain('Ben')
    expect(text(html)).not.toContain('Ben ·')
    expect(html).toContain('aria-label="4 out of 5 stars"')
    expect(html).toContain('aria-label="5 out of 5 stars"')
  })

  it('opens the café on Google Maps from both buttons, in a new tab', () => {
    const html = render(data)
    const links = html.match(/<a [^>]*>/g)?.filter((a) => a.includes(`href="${URL}"`)) ?? []
    expect(links).toHaveLength(2)
    for (const a of links) {
      expect(a).toContain('target="_blank"')
      expect(a).toContain('rel="noopener noreferrer"')
    }
    expect(text(html)).toContain('Read them on Google')
    expect(text(html)).toContain('Leave a review')
    expect(text(html)).toContain('(opens Google Maps)')
  })

  it('leaves out the score without a rating, and the cards without reviews', () => {
    const noRating = render({ rating: null, count: null, reviews: [ana] })
    expect(noRating).not.toContain('>on Google</')
    expect(text(noRating)).not.toContain('reviews on Google')
    expect(noRating).not.toContain('Rated')
    expect(noRating).toContain('<figure')

    const noReviews = render({ rating: 5, count: 34, reviews: [] })
    expect(noReviews).not.toContain('<figure')
    expect(text(noReviews)).toContain('34 reviews on Google')
  })

  it('lays four reviews in one row on wide screens, so none sits alone', () => {
    const four = render({ ...data, reviews: [ana, ben, { ...ana, key: 'c' }, { ...ben, key: 'd' }] })
    expect(four).toMatch(/<ul[^>]*class="[^"]*lg:grid-cols-4/)
    expect(render(data)).toMatch(/<ul[^>]*class="[^"]*lg:grid-cols-3/)
  })

  it('offers swiping only when there is more than one review', () => {
    expect(text(render({ ...data, reviews: [ana] }))).not.toContain('Swipe for more')
    expect(text(render(data))).toContain('Swipe for more')
  })
})
