import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import QtyBadge from './QtyBadge'

describe('QtyBadge', () => {
  it('marks a single unit as loudly as several: ×1 on the amber badge', () => {
    const one = renderToStaticMarkup(<QtyBadge qty={1} />)
    expect(one).toContain('>×1</span>')
    expect(one).toContain('bg-amber-400')
    expect(renderToStaticMarkup(<QtyBadge qty={12} />)).toContain('>×12</span>')
  })

  it('takes extra classes for where it sits, e.g. a fixed width in a column', () => {
    expect(renderToStaticMarkup(<QtyBadge qty={2} className="min-w-11" />)).toContain('min-w-11')
  })
})
