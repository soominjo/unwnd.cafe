import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import OrderTypeToggle from './OrderTypeToggle'
import PaymentPicker from './PaymentPicker'
import PaymentReadout from './PaymentReadout'
import { NO_PAYMENT, checkPay, type PayState } from './payState'

// The review controls keep no state of their own (the POS does), so calling them returns their
// element tree. This walks it, expanding child components, to find a control and use it.
type Props = { children?: ReactNode; onClick?: () => void; onChange?: (e: { target: { value: string } }) => void; [key: string]: unknown }

function walk(node: ReactNode, visit: (el: ReactElement<Props>) => boolean): ReactElement<Props> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = walk(child, visit)
      if (hit) return hit
    }
    return undefined
  }
  if (!isValidElement<Props>(node)) return undefined
  if (typeof node.type === 'function') return walk((node.type as (p: Props) => ReactNode)(node.props), visit)
  if (visit(node)) return node
  return walk(node.props.children, visit)
}

const textOf = (node: ReactNode): string =>
  Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : isValidElement<Props>(node) ? textOf(node.props.children) : ''

function button(tree: ReactNode, label: string): ReactElement<Props> {
  const hit = walk(tree, el => el.type === 'button' && textOf(el.props.children).includes(label))
  if (!hit) throw new Error(`No button "${label}"`)
  return hit
}

function inputWith(tree: ReactNode, placeholder: string): ReactElement<Props> {
  const hit = walk(tree, el => el.type === 'input' && el.props.placeholder === placeholder)
  if (!hit) throw new Error(`No input "${placeholder}"`)
  return hit
}

const cash = (received: number | null = null, receivedText = ''): PayState => ({ ...NO_PAYMENT, method: 'cash', received, receivedText })

describe('OrderTypeToggle', () => {
  it('asks dine in or take out, with the chosen one pressed', () => {
    const html = renderToStaticMarkup(<OrderTypeToggle value="dine-in" onChange={() => {}} />)
    expect(html).toContain('Dine in or take out?')
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Dine in</)
    expect(html).not.toContain('kitchen ticket will say')
  })

  it('picks Take out with one tap, and says the kitchen ticket will show it', () => {
    const picked: string[] = []
    button(OrderTypeToggle({ value: 'dine-in', onChange: v => picked.push(v) }), 'Take out').props.onClick?.()
    expect(picked).toEqual(['take-out'])
    expect(renderToStaticMarkup(<OrderTypeToggle value="take-out" onChange={() => {}} />)).toContain('The kitchen ticket will say TAKE OUT.')
  })
})

describe('PaymentPicker', () => {
  const changes: PayState[] = []
  const picker = (pay: PayState, due = 420) => PaymentPicker({ due, pay, onChange: p => changes.push(p) })
  const last = () => changes[changes.length - 1]

  it('offers Cash, E-wallet and Card, and picks the one tapped', () => {
    const html = renderToStaticMarkup(<PaymentPicker due={420} pay={NO_PAYMENT} onChange={() => {}} />)
    expect(html).toContain('How are they paying?')
    expect(html).toContain('GCash · Maya')
    button(picker(NO_PAYMENT), 'Card').props.onClick?.()
    expect(last()).toEqual({ ...NO_PAYMENT, method: 'card' })
  })

  it('shows quick cash amounts and an Other field once Cash is picked', () => {
    const html = renderToStaticMarkup(<PaymentPicker due={420} pay={cash()} onChange={() => {}} />)
    for (const amount of ['Exact', '₱420', '₱450', '₱500', '₱1,000', '₱2,000']) expect(html).toContain(amount)
    expect(html).toContain('placeholder="Other amount"')
    expect(renderToStaticMarkup(<PaymentPicker due={420} pay={{ ...NO_PAYMENT, method: 'card' }} onChange={() => {}} />)).not.toContain('Other amount')
  })

  it('sets what the customer handed over from a quick amount or the Other field', () => {
    button(picker(cash()), '₱500').props.onClick?.()
    expect(last()).toEqual(cash(500))
    inputWith(picker(cash()), 'Other amount').props.onChange?.({ target: { value: '600' } })
    expect(last()).toEqual(cash(600, '600'))
    // Something typed that isn't an amount counts as nothing handed over, so it shows as short.
    inputWith(picker(cash()), 'Other amount').props.onChange?.({ target: { value: '-' } })
    expect(last()).toEqual(cash(0, '-'))
    button(picker(cash(600, '600')), 'Exact').props.onClick?.()
    expect(last()).toEqual(cash())
  })

  it('says what e-wallet and card need before the order is completed', () => {
    expect(renderToStaticMarkup(<PaymentPicker due={420} pay={{ ...NO_PAYMENT, method: 'ewallet' }} onChange={() => {}} />)).toContain('GCash or Maya')
    expect(renderToStaticMarkup(<PaymentPicker due={420} pay={{ ...NO_PAYMENT, method: 'card' }} onChange={() => {}} />)).toContain('card terminal')
  })

  it('splits between two methods, the rest worked out, and goes back to one', () => {
    button(picker({ ...NO_PAYMENT, method: 'ewallet' }), 'Split payment').props.onClick?.()
    expect(last().split).toEqual({ first: 'ewallet', firstAmount: null, firstText: '', rest: 'cash' })

    const split: PayState = { ...NO_PAYMENT, split: { first: 'ewallet', firstAmount: 200, firstText: '200', rest: 'cash' } }
    const html = renderToStaticMarkup(<PaymentPicker due={420} pay={split} onChange={() => {}} />)
    expect(html).toContain('First part')
    expect(html).toContain('The rest')
    expect(html).toContain('₱220')
    expect(html).toContain('worked out')

    inputWith(picker(split), 'Amount').props.onChange?.({ target: { value: '150' } })
    expect(last().split).toEqual({ first: 'ewallet', firstAmount: 150, firstText: '150', rest: 'cash' })
    button(picker(split), 'Back to one method').props.onClick?.()
    expect(last()).toEqual({ ...NO_PAYMENT, method: 'ewallet' })
  })

  it('asks for nothing on a ₱0 order', () => {
    const html = renderToStaticMarkup(<PaymentPicker due={0} pay={NO_PAYMENT} onChange={() => {}} />)
    expect(html).toContain('Nothing to pay')
    expect(html).not.toContain('How are they paying?')
  })
})

describe('PaymentReadout', () => {
  const readout = (pay: PayState, due = 420) => renderToStaticMarkup(<PaymentReadout due={due} pay={pay} check={checkPay(due, pay)} />)

  it('shows the change from what a cash customer handed over', () => {
    const html = readout(cash(500))
    expect(html).toContain('Change')
    expect(html).toContain('₱80')
    expect(html).toContain('Cash received ₱500')
  })

  it('shows how much cash is short', () => {
    const html = readout(cash(400, '400'))
    expect(html).toContain('Short')
    expect(html).toContain('₱20')
  })

  it('names the method for e-wallet and card, which pay the exact total', () => {
    expect(readout({ ...NO_PAYMENT, method: 'ewallet' })).toContain('E-wallet')
    expect(readout({ ...NO_PAYMENT, method: 'ewallet' })).toContain('no change')
  })

  it('sums up a split, and says when nothing is picked yet', () => {
    expect(readout({ ...NO_PAYMENT, split: { first: 'ewallet', firstAmount: 200, firstText: '200', rest: 'cash' } })).toContain('E-wallet ₱200 + Cash ₱220')
    expect(readout(NO_PAYMENT)).toContain('Not chosen yet')
  })
})
