import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BoardRow, TimeShift } from '@/lib/timeclock/rules'
import ManagerClient, { MenuTab } from './ManagerClient'
import RecordsView, { ShiftRow, TotalCard } from './RecordsView'
import ShiftEditor from './ShiftEditor'
import StaffAdmin from './StaffAdmin'

const NOW = Date.parse('2026-10-15T12:00:00Z') // Thu, Oct 15, 8:00 PM in Manila
const noop = () => {}
const done = async () => null

const shift = (over: Partial<TimeShift> = {}): TimeShift => ({
  _id: 's1', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-14T23:44:00Z', clockOut: '2026-10-15T07:46:00Z', editedAt: null, ...over,
})

describe('the Manager page', () => {
  it('asks for the manager PIN before showing anything', () => {
    const html = renderToStaticMarkup(<ManagerClient />)
    expect(html).toContain('unwnd. manager')
    expect(html).toContain('Manager PIN')
    expect(html).toContain('Same PIN as the POS login.')
    expect(html.match(/data-pin-dot/g)).toHaveLength(4)
    expect(html).not.toContain('>Hours<')
    expect(html).not.toContain('>Lock<')
  })

  it('opens straight to the tabs and Lock when the manager left it unlocked', () => {
    const html = renderToStaticMarkup(<ManagerClient initiallyUnlocked />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Hours</)
    expect(html).toContain('Lock</button>')
    expect(html).not.toContain('Manager PIN')
  })

  it('takes menu editing back to the POS from the Menu tab', () => {
    const html = renderToStaticMarkup(<MenuTab onEdit={noop} />)
    expect(html).toContain('>Edit the menu</button>')
    expect(html).toContain('Takes you back to the POS with editing on.')
    // Editing no longer locks itself: a reload or idle minutes leave it on until Lock.
    expect(html).toContain('It stays on, through reloads, until you tap Lock there.')
    expect(html).not.toContain('it also locks after two idle minutes')
  })
})

describe('Hours', () => {
  it('opens on This week, waiting for its first read', () => {
    const html = renderToStaticMarkup(<RecordsView now={NOW} />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>This week</)
    expect(html).toContain('Mon, Oct 12 – Sun, Oct 18')
    expect(html).toContain('animate-pulse')
  })

  it('shows each shift with who, when and how long, and Edit and Delete', () => {
    const html = renderToStaticMarkup(<ShiftRow shift={shift()} now={NOW} onEdit={noop} onDelete={noop} />)
    expect(html).toContain('John Reyes')
    expect(html).toContain('7:44 AM – ')
    expect(html).toContain('3:46 PM')
    expect(html).toContain('8h 02m')
    expect(html).toContain('>Edit</button>')
    expect(html).toContain('>Delete</button>')
  })

  it('marks an edited shift, and flags one over 16 hours for checking', () => {
    const html = renderToStaticMarkup(
      <ShiftRow shift={shift({ clockIn: '2026-10-14T01:51:00Z', clockOut: '2026-10-15T03:00:00Z', editedAt: '2026-10-15T04:00:00Z' })} now={NOW} onEdit={noop} onDelete={noop} />,
    )
    expect(html).toContain('>Edited</span>')
    expect(html).toContain('Over 16h · check')
    expect(html).toContain('Thu, Oct 15, 11:00 AM')
  })

  it('shows a person’s total, whether they are on shift, and when they were removed', () => {
    const html = renderToStaticMarkup(
      <TotalCard total={{ staffId: 'ana', name: 'Ana Cruz', ms: 26 * 3600e3 + 54 * 60e3, count: 3, openSince: '2026-10-15T04:00:00Z' }} removed />,
    )
    expect(html).toContain('26h 54m')
    expect(html).toContain('3 shifts')
    expect(html).toContain(' · on shift')
    expect(html).toContain('>Removed</span>')
  })

  it('edits a shift in Manila time, and lets the time out of an open one stay empty', () => {
    const closed = renderToStaticMarkup(<ShiftEditor shift={shift()} now={NOW} busy={false} onSave={done} onCancel={noop} />)
    expect(closed).toContain('value="2026-10-15T07:44"')
    expect(closed).toContain('value="2026-10-15T15:46"')
    expect(closed).toContain('max="2026-10-15T20:00"')
    const open = renderToStaticMarkup(<ShiftEditor shift={shift({ clockOut: null })} now={NOW} busy={false} onSave={done} onCancel={noop} />)
    expect(open).toContain('Time out · empty while on shift')
  })
})

describe('Staff', () => {
  const board: BoardRow[] = [
    { staffId: 'john', name: 'John Reyes', hasPin: true, openShift: { _id: 's1', clockIn: '2026-10-15T10:00:00Z' } },
    { staffId: 'ana', name: 'Ana Cruz', hasPin: false, openShift: null },
  ]
  const html = renderToStaticMarkup(<StaffAdmin board={board} onAdd={done} onChangePin={done} onRemove={done} />)

  it('lists everyone with whether they are on shift and have a PIN, never the PIN', () => {
    expect(html).toContain('on shift · ')
    expect(html).toContain('PIN set')
    expect(html).toContain('No PIN yet')
    expect(html).toContain('>Change PIN</button>')
    expect(html).toContain('>Set PIN</button>')
    expect(html.match(/>Remove<\/button>/g)).toHaveLength(2)
  })

  it('adds someone with a name and a PIN', () => {
    expect(html).toContain('placeholder="Full name"')
    expect(html).toContain('placeholder="PIN"')
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('Add staff')
    expect(html).toContain('it can’t be the manager PIN')
  })
})
