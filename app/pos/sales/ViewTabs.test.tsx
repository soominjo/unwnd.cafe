import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ViewTabs from './ViewTabs'

const tabs = (detailed: boolean) =>
  renderToStaticMarkup(<ViewTabs view="tally" onChange={() => {}} pendingCount={3} completedCount={5} loading={false} detailed={detailed} />)

describe('ViewTabs', () => {
  it('puts Tally between Completed and Top Items', () => {
    const html = tabs(true)
    const at = (label: string) => html.indexOf(`>${label}`)
    expect(at('Recent Orders')).toBeLessThan(at('Completed'))
    expect(at('Completed')).toBeLessThan(at('Tally'))
    expect(at('Tally')).toBeLessThan(at('Top Items'))
    expect(at('Top Items')).toBeLessThan(at('Top Names'))
    expect(html).toMatch(/aria-pressed="true"[^>]*>Tally</)
  })

  it('keeps Tally on a long period, beside the two leaderboards', () => {
    const html = tabs(false)
    expect(html).toContain('>Tally')
    expect(html).toContain('>Top Items')
    expect(html).not.toContain('>Recent Orders')
  })

  it('counts only fully completed orders as completed on a long period: a partly served one is still pending', () => {
    // 3 not completed, 2 of them partly served; 5 completed or partly served: 3 fully completed.
    const html = renderToStaticMarkup(
      <ViewTabs view="tally" onChange={() => {}} pendingCount={3} completedCount={5} partlyServedCount={2} loading={false} detailed={false} />,
    )
    expect(html).toContain('<span>3 pending</span>')
    expect(html).toContain('<span>3 completed</span>')
  })

  it('counts a partly served order under both tabs on a day', () => {
    const html = renderToStaticMarkup(
      <ViewTabs view="recent" onChange={() => {}} pendingCount={3} completedCount={5} partlyServedCount={2} loading={false} detailed />,
    )
    expect(html).toMatch(/Recent Orders<span[^>]*>3<\/span>/)
    expect(html).toMatch(/Completed<span[^>]*>5<\/span>/)
  })
})
