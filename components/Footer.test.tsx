import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import Footer from './Footer'

const render = () => renderToStaticMarkup(<Footer />)

describe('Footer', () => {
  it('names the café in the brand font', () => {
    const logo = render().match(/<a [^>]*>unwnd\.<\/a>/)?.[0] ?? ''
    expect(logo).toContain('href="/"')
    expect(logo).toContain('font-logo')
  })

  it('sets the name in the brand font inside the copyright line too, without its wide spacing', () => {
    expect(render().replaceAll('<!-- -->', '')).toContain('<span class="font-logo tracking-normal">unwnd.</span> café')
  })
})
