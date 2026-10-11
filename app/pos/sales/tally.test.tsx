import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TallyView from './TallyView'
import PaymentLinesList from './PaymentLinesList'
import MethodFix from './MethodFix'
import OrderTypeCard from './OrderTypeCard'
import type { SalesSummary } from '../types'
import type { PaymentLine } from '@/lib/sales/paymentTally'

// Today: ₱2,930 from 8 orders — ₱1,100 cash, ₱1,400 e-wallet, ₱430 card.
const lines: PaymentLine[] = [
  { saleId: 'n-1', paymentKey: 'pay-0', method: 'ewallet', amount: 200, paidAt: '2026-10-11T11:42:00.000Z', name: 'Andrea', orderTotal: 420, partOfMore: true },
  { saleId: 'o-8', paymentKey: 'pay-0', method: 'ewallet', amount: 380, paidAt: '2026-10-11T11:18:00.000Z', name: '', orderTotal: 380, partOfMore: false },
]
const summary: SalesSummary = {
  totalRevenue: 2930, orderCount: 8, avgOrderValue: 366, topItems: [], topItemCategories: [], topCustomers: [], pendingCount: 3, completedCount: 5,
  paymentTally: { cash: { amount: 1100, orders: 4 }, ewallet: { amount: 1400, orders: 5 }, card: { amount: 430, orders: 1 }, notRecorded: { amount: 0, orders: 0 } },
  orderTypes: { dineIn: 5, takeOut: 3, notRecorded: 0 },
  paymentLines: lines,
}
const view = (s: SalesSummary, detailed = true) =>
  renderToStaticMarkup(<TallyView summary={s} loading={false} detailed={detailed} onChangeMethod={async () => null} />)

describe('TallyView', () => {
  it('shows each method’s total, its orders and its share, adding up to Revenue', () => {
    const html = view(summary)
    for (const text of ['How they paid', 'Cash', '₱1,100', '4 orders', '37%', 'E-wallet', '₱1,400', '48%', 'Card', '₱430', '1 order', '15%']) expect(html).toContain(text)
    expect(html).toContain('Adds up to ₱2,930, same as Revenue')
    expect(html).not.toContain('Not recorded')
  })

  it('shows Not recorded only when older orders carry no payment', () => {
    const older = { ...summary, totalRevenue: 3430, paymentTally: { ...summary.paymentTally, notRecorded: { amount: 500, orders: 2 } } }
    const html = view(older)
    expect(html).toContain('Not recorded')
    expect(html).toContain('₱500')
    expect(html).toContain('Adds up to ₱3,430, same as Revenue')
  })

  it('says by how much when the methods don’t add up to Revenue', () => {
    expect(view({ ...summary, totalRevenue: 3000 })).toContain('Off by ₱70')
  })

  it('opens each method’s payments on a day or a short range, and says how to see them on a longer one', () => {
    expect(view(summary)).toMatch(/<button[^>]*aria-expanded="false"[^>]*>/)
    const long = view({ ...summary, paymentLines: undefined }, false)
    expect(long).not.toContain('aria-expanded')
    expect(long).toContain('Pick Today, Yesterday or a few days to list each payment.')
  })
})

describe('OrderTypeCard', () => {
  it('counts Dine in and Take out, with Not recorded only for older orders', () => {
    const html = renderToStaticMarkup(<OrderTypeCard counts={{ dineIn: 5, takeOut: 3, notRecorded: 0 }} />)
    expect(html).toContain('Dine in')
    expect(html).toContain('Take out')
    expect(html).toContain('38% of orders were take out.')
    expect(html).not.toContain('Not recorded')
    expect(renderToStaticMarkup(<OrderTypeCard counts={{ dineIn: 5, takeOut: 3, notRecorded: 4 }} />)).toContain('Not recorded')
  })
})

describe('PaymentLinesList', () => {
  const list = (fixingKey: string | null = null) =>
    renderToStaticMarkup(
      <PaymentLinesList method="ewallet" lines={lines} fixingKey={fixingKey} busyKey={null} error={null} onEdit={() => {}} onMove={() => {}} />,
    )

  it('lists each payment with its time, the name, the amount and Edit, then what to check them against', () => {
    const html = list()
    for (const text of ['7:42 PM', 'Andrea', '₱200', 'part of the ₱420 order', 'No name', '₱380', 'Edit']) expect(html).toContain(text)
    expect(html).toContain('Check these against the GCash and Maya apps.')
  })

  it('says when a payment was moved here from another method', () => {
    const moved: PaymentLine = { ...lines[1], movedFrom: 'cash', movedAt: '2026-10-11T12:02:00.000Z' }
    const html = renderToStaticMarkup(
      <PaymentLinesList method="ewallet" lines={[moved, lines[0]]} fixingKey={null} busyKey={null} error={null} onEdit={() => {}} onMove={() => {}} />,
    )
    expect(html).toMatch(/moved from Cash · <span class="whitespace-nowrap">8:02 PM<\/span>/)
    expect(html.match(/moved from/g)).toHaveLength(1)
  })

  it('opens the move row under the payment being edited', () => {
    expect(list()).not.toContain('Move ₱200 to')
    expect(list('n-1:pay-0')).toContain('Move ₱200 to')
  })
})

// MethodFix keeps no state, so calling it returns its element tree: find a button and press it.
function buttonIn(node: ReactNode, label: string): ReactElement<{ onClick?: () => void }> | undefined {
  if (Array.isArray(node)) return node.map(n => buttonIn(n, label)).find(Boolean)
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined
  const text = (n: ReactNode): string => (Array.isArray(n) ? n.map(text).join('') : typeof n === 'string' ? n : isValidElement<{ children?: ReactNode }>(n) ? text(n.props.children) : '')
  if (node.type === 'button' && text(node.props.children).includes(label)) return node
  return buttonIn(node.props.children, label)
}

describe('MethodFix', () => {
  it('offers the two other methods to move the payment to, and moves it', () => {
    const picked: string[] = []
    const props = { amount: 200, current: 'ewallet' as const, busy: false, error: null, onPick: (m: string) => picked.push(m), onCancel: () => {} }
    const html = renderToStaticMarkup(<MethodFix {...props} />)
    expect(html).toContain('Move ₱200 to')
    expect(html).toContain('>Cash<')
    expect(html).toContain('>Card<')
    expect(html).not.toContain('>E-wallet<')
    buttonIn(MethodFix(props), 'Card')?.props.onClick?.()
    expect(picked).toEqual(['card'])
  })

  it('says why a move was not saved', () => {
    const html = renderToStaticMarkup(<MethodFix amount={200} current="cash" busy={false} error="Network error. Could not change the payment." onPick={() => {}} onCancel={() => {}} />)
    expect(html).toContain('Network error. Could not change the payment.')
  })
})
