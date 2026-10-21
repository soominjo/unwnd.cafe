import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CategoryChips from './CategoryChips'

const sections = [{ id: 'signature', label: 'Signature' }, { id: 'espresso', label: 'Classic' }]

describe('CategoryChips', () => {
  it('one chip per tab, only the current one marked', () => {
    const html = renderToStaticMarkup(<CategoryChips sections={sections} active="espresso" onPick={() => {}} />)
    expect(html).toContain('aria-label="Menu categories"')
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-current="true"[^>]*>Classic</)
    expect(html).toMatch(/aria-current="false"[^>]*>Signature</)
  })
})
