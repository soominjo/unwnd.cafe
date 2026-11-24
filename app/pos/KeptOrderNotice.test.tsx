import { describe, it, expect, vi } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { KeptOrderNotice } from './KeptOrderNotice'

// The notice uses no hooks, so calling it returns its element tree; this finds a button in it by label.
function buttonLabelled(node: ReactNode, label: string): { onClick: () => void } | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = buttonLabelled(child, label)
      if (hit) return hit
    }
    return undefined
  }
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined
  const { children, onClick } = node.props
  if (node.type === 'button' && children === label && onClick) return { onClick }
  return buttonLabelled(children, label)
}

describe('KeptOrderNotice', () => {
  it('says a save the reload cut short may have gone through, and to check Sales before charging again', () => {
    const html = renderToStaticMarkup(<KeptOrderNotice notice="maybe-saved" onDismiss={() => {}} />)
    expect(html).toContain('role="status"')
    expect(html).toContain('may be saved already')
    expect(html).toContain('Check Sales before charging again.')
    expect(html).not.toContain('Print their receipt')
  })

  it('says added items were saved just before the reload, and where to print their receipt', () => {
    const html = renderToStaticMarkup(<KeptOrderNotice notice="already-added" onDismiss={() => {}} />)
    expect(html).toContain('The new items were saved just before the page reloaded.')
    expect(html).toContain('Print their receipt from Sales.')
    expect(html).not.toContain('Check Sales before charging')
  })

  it('goes away on OK', () => {
    const onDismiss = vi.fn()
    buttonLabelled(KeptOrderNotice({ notice: 'maybe-saved', onDismiss }), 'OK')?.onClick()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
