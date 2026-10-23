import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { PageHeader } from './PageChrome'

describe('PageHeader', () => {
  // With the Manager page's Lock beside it, "unwnd. manager" broke onto two lines at 360–375px.
  it('keeps the page’s wordmark on one line, a size smaller on a phone', () => {
    const html = renderToStaticMarkup(<PageHeader title="unwnd. manager"><button type="button">Lock</button></PageHeader>)
    const title = html.match(/<span class="([^"]*)">unwnd\. manager<\/span>/)?.[1].split(' ') ?? []
    expect(title).toEqual(expect.arrayContaining(['whitespace-nowrap', 'text-xl', 'sm:text-2xl']))
  })
})
