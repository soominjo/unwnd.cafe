import { describe, it, expect, vi } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Sale, SaleItem } from '../types'
import OrdersView, { type OrderActions } from './OrdersView'
import { InlineConfirm } from './ui'

// ReceiptPreview sets up its font through Next's compiler-only loader when imported.
vi.mock('next/font/google', () => ({ IBM_Plex_Mono: () => ({ className: '' }) }))

const noop = () => {}
const OUT = '2026-11-24T11:46:00.000Z'

const line = (lineId: string, name: string, servedAt?: string): SaleItem => ({
  lineId,
  name,
  variant: null,
  price: 120,
  qty: 1,
  ...(servedAt ? { servedAt } : {}),
})

const sale = (_id: string, notes: string, _createdAt: string, items: SaleItem[], isCompleted?: boolean): Sale => ({
  _id,
  _createdAt,
  total: 120 * items.length,
  paymentAmount: 120 * items.length,
  change: 0,
  notes,
  items,
  ...(isCompleted === undefined ? {} : { isCompleted }),
})

/** Nothing out yet. */
const ana = sale('ana', 'Ana', '2026-11-24T11:50:00Z', [line('latte', 'Spanish Latte'), line('fries', 'Classic Fries')])
/** The latte is out, the fries are still to serve. */
const bea = sale('bea', 'Bea', '2026-11-24T11:40:00Z', [line('latte', 'Spanish Latte', OUT), line('fries', 'Classic Fries')])
/** Everything went out. */
const cy = sale('cy', 'Cy', '2026-11-24T11:30:00Z', [line('americano', 'Americano', OUT)], true)

const actions: OrderActions = {
  confirmId: null,
  deletingId: null,
  confirmItemKey: null,
  deletingItemKey: null,
  onRequestDeleteOrder: noop,
  onCancelDeleteOrder: noop,
  onConfirmDeleteOrder: noop,
  onRequestDeleteItem: noop,
  onCancelDeleteItem: noop,
  onConfirmDeleteItem: noop,
  onCompleteOrder: noop,
  onServeLine: noop,
  onUnserveLine: noop,
  onOpenTab: noop,
  onAddItems: noop,
  onRenameOrder: async () => null,
  onChangeMethod: async () => null,
}

type ViewProps = Parameters<typeof OrdersView>[0]

const view = (mode: ViewProps['mode'], orders: Sale[], more: Partial<ViewProps> = {}): ViewProps => ({
  mode,
  orders,
  loading: false,
  total: orders.length,
  page: 1,
  totalPages: 1,
  onPageChange: noop,
  confirmAll: false,
  deletingAll: false,
  onRequestDeleteAll: noop,
  onCancelDeleteAll: noop,
  onConfirmDeleteAll: noop,
  actions,
  ...more,
})

/** The first element in a rendered tree (without rendering components) that is of this type. */
function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type)
      if (found) return found
    }
    return null
  }
  if (!isValidElement<Record<string, unknown>>(node)) return null
  if (node.type === type) return node
  return findElement(node.props.children as ReactNode, type)
}

describe('OrdersView', () => {
  it('lists under Recent every order with something still to serve, partly served ones included', () => {
    const html = renderToStaticMarkup(<OrdersView {...view('recent', [ana, bea, cy])} />)
    expect(html).toContain('Change the name on this order: Ana')
    expect(html).toContain('Change the name on this order: Bea')
    // Completed on this screen a moment ago: it leaves Recent at once, before the list reloads.
    expect(html).not.toContain('Change the name on this order: Cy')
    expect(html).toContain('2 pending')
  })

  it('lists under Completed every order with something out, and says how many are only partly served', () => {
    const html = renderToStaticMarkup(<OrdersView {...view('completed', [ana, bea, cy])} />)
    expect(html).not.toContain('Change the name on this order: Ana')
    expect(html).toContain('Change the name on this order: Bea')
    expect(html).toContain('Change the name on this order: Cy')
    expect(html).toContain('1 completed · 1 partly served')
  })

  it('leaves out the partly served part of the label when there is none', () => {
    expect(renderToStaticMarkup(<OrdersView {...view('completed', [cy])} />)).toContain('>1 completed<')
  })

  it('deletes only the fully completed orders with Delete all on Completed, and counts only those', () => {
    const onConfirmDeleteAll = vi.fn()
    const props = view('completed', [bea, cy], { confirmAll: true, onConfirmDeleteAll })
    expect(renderToStaticMarkup(<OrdersView {...props} />)).toContain('Delete 1 order?')
    const confirm = findElement(OrdersView(props), InlineConfirm)
    ;(confirm?.props.onConfirm as () => void)()
    expect(onConfirmDeleteAll).toHaveBeenCalledWith([cy])
  })

  it('offers no Delete all on Completed when every order there still has items to serve', () => {
    expect(renderToStaticMarkup(<OrdersView {...view('completed', [bea])} />)).not.toContain('Delete all')
  })

  it('deletes every pending order with Delete all on Recent, and warns when some already have items out', () => {
    const onConfirmDeleteAll = vi.fn()
    const props = view('recent', [ana, bea], { confirmAll: true, onConfirmDeleteAll })
    // Bea's latte is under Completed: deleting her order takes it from there too.
    expect(renderToStaticMarkup(<OrdersView {...props} />)).toContain('Delete 2 orders? 1 already has items out.')
    const confirm = findElement(OrdersView(props), InlineConfirm)
    ;(confirm?.props.onConfirm as () => void)()
    expect(onConfirmDeleteAll).toHaveBeenCalledWith([ana, bea])
  })

  it('asks plainly on Recent when no order there has items out yet', () => {
    const html = renderToStaticMarkup(<OrdersView {...view('recent', [ana], { confirmAll: true })} />)
    expect(html).toContain('Delete 1 order?')
    expect(html).not.toContain('items out')
  })

  it('counts several orders with items out in the Recent warning', () => {
    const dee = sale('dee', 'Dee', '2026-11-24T11:45:00Z', [line('mocha', 'Mocha', OUT), line('waffle', 'Waffle')])
    const html = renderToStaticMarkup(<OrdersView {...view('recent', [ana, bea, dee], { confirmAll: true })} />)
    expect(html).toContain('Delete 3 orders? 2 already have items out.')
  })

  it('says all caught up when every order under Recent was just completed', () => {
    expect(renderToStaticMarkup(<OrdersView {...view('recent', [cy])} />)).toContain('All caught up.')
  })
})
