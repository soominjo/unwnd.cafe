import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RatingPill from './RatingPill'

const text = (html: string) => html.replace(/<[^>]+>/g, '')

describe('RatingPill', () => {
  it('links to the reviews with the rating and the count', () => {
    const html = renderToStaticMarkup(<RatingPill rating={5} count={34} />)
    expect(html).toContain('href="#reviews"')
    expect(text(html)).toContain('5.0 on Google · 34 reviews')
  })

  it('says "1 review", and leaves the count out when it is unknown', () => {
    expect(text(renderToStaticMarkup(<RatingPill rating={4.9} count={1} />))).toContain('4.9 on Google · 1 review')
    const noCount = text(renderToStaticMarkup(<RatingPill rating={4.9} count={null} />))
    expect(noCount).toContain('4.9 on Google')
    expect(noCount).not.toContain('·')
  })

  it('draws the stars rounded from the rating, and keeps them away from screen readers', () => {
    const html = renderToStaticMarkup(<RatingPill rating={4.4} count={34} />)
    expect(html).toContain('aria-hidden="true"')
    expect(text(html)).toMatch(/^★★★★★/)
    expect(html).toMatch(/>★★★★<\/span><span[^>]*>★<\/span>/)
  })
})
