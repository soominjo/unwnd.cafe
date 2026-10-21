import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ManageMenuModal, { CategoryRow } from './ManageMenuModal'

const noop = () => {}
const tab = (id: string, label: string) => ({ id, label, type: 'drink' as const, order: 1, _sanityId: `menu-category-${id}` })
const tabs = [tab('signature', 'Signature'), tab('espresso', 'Classic'), tab('add-ons', 'Add ons')]
const row = (mode: 'view' | 'rename' | 'confirm') => renderToStaticMarkup(
  <CategoryRow tab={tabs[1]} itemCount={3} mode={mode} busy={false} onRename={noop} onDelete={noop} onCancel={noop} onSave={noop} onConfirmDelete={noop} />,
)

describe('the category manager', () => {
  it('lists every tab, Add ons included, each with Rename and Delete, and still adds tabs', () => {
    const html = renderToStaticMarkup(
      <ManageMenuModal categories={tabs} itemCounts={{ espresso: 3 }} onClose={noop} onCategoryAdded={noop} onCategoryRenamed={noop} onCategoryDeleted={noop} />,
    )
    for (const name of ['>Signature<', '>Classic<', '>Add ons<']) expect(html).toContain(name)
    expect(html.match(/>Rename</g)).toHaveLength(3)
    expect(html.match(/>Delete</g)).toHaveLength(3)
    expect(html).toContain('Add Category')
  })

  it('renames in place, up to 40 characters', () => {
    const html = row('rename')
    expect(html).toContain('value="Classic"')
    expect(html).toContain('maxLength="40"')
    expect(html).toContain('>Save<')
    expect(html).toContain('>Cancel<')
  })

  it('asks before deleting, with the item count and the loyalty warning', () => {
    const html = row('confirm')
    expect(html).toContain('Delete Classic and its 3 items? This can’t be undone.')
    expect(html).toContain('Classic gives loyalty stamps, the free drink and 10% off.')
    expect(html).toContain('>Delete<')
    expect(html).toContain('>Cancel<')
  })
})
