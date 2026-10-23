import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const nav = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

import Nav from './Nav'

const headerClass = () => renderToStaticMarkup(<Nav />).match(/<header class="([^"]*)"/)?.[1] ?? ''

beforeEach(() => {
  nav.pathname = '/'
})

describe('Nav', () => {
  it('starts clear over the home page photo', () => {
    expect(headerClass()).toContain('bg-transparent')
  })

  // Vercel re-renders the home page (revalidated every minute) under the path "/index".
  it('starts clear on the home page when it is re-rendered as /index', () => {
    nav.pathname = '/index'
    expect(headerClass()).toContain('bg-transparent')
  })

  it('is solid on every other page', () => {
    nav.pathname = '/menu'
    expect(headerClass()).toContain('bg-background')
  })

  it('names the café in the brand font', () => {
    const logo = renderToStaticMarkup(<Nav />).match(/<a [^>]*>unwnd<\/a>/)?.[0] ?? ''
    expect(logo).toContain('href="/"')
    expect(logo).toContain('font-logo')
  })
})
