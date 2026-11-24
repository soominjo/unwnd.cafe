import { describe, it, expect, vi } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import UndoToast from './UndoToast'

/** The first element of this type in a rendered tree (without rendering components). */
function findElement(node: ReactNode, type: string): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) return node.map(child => findElement(child, type)).find(Boolean) ?? null
  if (!isValidElement<Record<string, unknown>>(node)) return null
  if (node.type === type) return node
  return findElement(node.props.children as ReactNode, type)
}

describe('UndoToast', () => {
  it('keeps its live region on the page while there is nothing to undo, so the next message is announced', () => {
    expect(renderToStaticMarkup(<UndoToast bar={null} />)).toMatch(/^<div role="status"[^>]*><\/div>$/)
  })

  it('says what moved inside that live region, with an Undo button', () => {
    const html = renderToStaticMarkup(<UndoToast bar={{ message: 'Classic Fries moved to Completed', undo: () => {} }} />)
    expect(html).toMatch(/^<div role="status"/)
    expect(html).toContain('Classic Fries moved to Completed')
    expect(html).toMatch(/<button[^>]*>Undo<\/button>/)
  })

  it('undoes the change when Undo is tapped', () => {
    const undo = vi.fn()
    const button = findElement(UndoToast({ bar: { message: 'Bea’s order is complete', undo } }), 'button')
    ;(button?.props.onClick as () => void)()
    expect(undo).toHaveBeenCalledTimes(1)
  })
})
