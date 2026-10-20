'use client'

import { useCallback, useEffect, useState } from 'react'
import type { BoardRow } from '@/lib/timeclock/rules'
import { PageHeader, PageTabs } from '../PageChrome'
import PinPad from '../PinPad'
import { UnlockIcon } from '../sales/icons'
import { ActionButton, ErrorBanner, Skeleton } from '../sales/ui'
import { readTimeClock, sendTimeClock } from '../timeclock/sendTimeClock'
import { useNow } from '../timeclock/useNow'
import { PIN_CHECK_MESSAGES, verifyPosPin } from '../verifyPosPin'
import { forgetManagerUnlock, rememberManagerUnlock, rememberMenuEditing } from './managerUnlock'
import RecordsView from './RecordsView'
import StaffAdmin from './StaffAdmin'

type ManagerTab = 'hours' | 'staff' | 'menu'

const TABS = [
  { key: 'hours', label: 'Hours' },
  { key: 'staff', label: 'Staff' },
  { key: 'menu', label: 'Menu' },
] as const

// The Manager page, opened from the POS header. It asks for the manager PIN (the POS login PIN)
// first, then holds what a manager does: everyone's hours, the staff and their PINs, and the way
// into menu editing. Once unlocked it stays unlocked, through reloads, Back and trips to the POS,
// until its Lock button (see managerUnlock.ts). The routes behind it take any signed-in POS.
export default function ManagerClient({ initiallyUnlocked = false }: { initiallyUnlocked?: boolean }) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked)
  const [tab, setTab] = useState<ManagerTab>('hours')
  const lock = useCallback(() => {
    forgetManagerUnlock()
    setUnlocked(false)
  }, [])
  const unlock = useCallback(() => {
    rememberManagerUnlock()
    setUnlocked(true)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader title="unwnd. manager" note="hours · staff · menu">
        {unlocked && (
          <button
            type="button"
            onClick={lock}
            className="flex h-9 items-center gap-2 rounded-full bg-amber-400 px-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-amber-300"
          >
            <UnlockIcon width={14} height={14} />
            Lock
          </button>
        )}
      </PageHeader>
      {unlocked ? (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
          <PageTabs label="Manager" tabs={TABS} value={tab} onChange={setTab} />
          {tab === 'hours' ? <HoursTab /> : tab === 'staff' ? <StaffTab /> : <MenuTab />}
        </main>
      ) : (
        <ManagerPinGate onUnlock={unlock} />
      )}
    </div>
  )
}

/** The manager PIN, checked on the server by the POS login route, before anything shows. */
export function ManagerPinGate({ onUnlock }: { onUnlock: () => void }) {
  async function check(pin: string): Promise<string | null> {
    const result = await verifyPosPin(pin)
    if (result !== 'ok') return PIN_CHECK_MESSAGES[result]
    onUnlock()
    return null
  }

  return (
    <main className="flex min-h-[calc(100vh-4.5rem)] flex-col items-center justify-center bg-foreground px-4 py-10 text-cream">
      <p className="mb-10 text-[10px] font-semibold uppercase tracking-[0.3em] text-cream/60">Manager PIN</p>
      <PinPad onComplete={check} />
      <p className="mt-8 text-center text-xs text-cream/45">Same PIN as the POS login.</p>
    </main>
  )
}

// Its own component, so the once-a-second tick that keeps open shifts counting stays inside Hours.
function HoursTab() {
  const now = useNow()
  return <RecordsView now={now} />
}

const staffUrl = (row: BoardRow) => `/api/timeclock/staff/${encodeURIComponent(row.staffId)}`

function StaffTab() {
  const [board, setBoard] = useState<BoardRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => readTimeClock().then(data => {
    if (data) setBoard(data.board)
    setFailed(data === null)
  }), [])

  useEffect(() => {
    void load()
  }, [load])

  async function add(name: string, pin: string): Promise<string | null> {
    const reply = await sendTimeClock('/api/timeclock/staff', 'POST', { name, pin })
    if (reply.message === null || reply.unsure) await load()
    return reply.message
  }

  async function changePin(row: BoardRow, pin: string): Promise<string | null> {
    const reply = await sendTimeClock(staffUrl(row), 'PATCH', { pin })
    if (reply.message === null || reply.unsure || reply.gone) await load()
    return reply.message
  }

  async function remove(row: BoardRow): Promise<string | null> {
    const reply = await sendTimeClock(staffUrl(row), 'DELETE')
    if (reply.message === null || reply.unsure || reply.gone) await load()
    return reply.gone ? null : reply.message
  }

  if (board === null) {
    return failed
      ? <ErrorBanner message="Could not load the staff list." actionLabel="Try again" onDismiss={() => void load()} />
      : <Skeleton rows={3} height="h-12" />
  }
  return (
    <div className="space-y-3">
      {failed && <ErrorBanner message="Could not refresh the staff list. Showing it as last read." actionLabel="Try again" onDismiss={() => void load()} />}
      <StaffAdmin board={board} onAdd={add} onChangePin={changePin} onRemove={remove} />
    </div>
  )
}

/** "Edit the menu": back to the POS with menu editing on, and left on until the POS Lock. */
function openMenuEditing() {
  rememberMenuEditing()
  window.location.assign('/pos')
}

export function MenuTab({ onEdit = openMenuEditing }: { onEdit?: () => void }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Menu</h3>
      <div className="grid gap-3 rounded-lg border border-border bg-white/80 px-4 py-4">
        <p className="max-w-[60ch] text-sm leading-relaxed text-foreground/65">
          Menu editing happens on the POS itself, where the items are: add, edit and delete items, add or remove categories, and drag the tabs into order.
        </p>
        <div>
          <ActionButton tone="primary" onClick={onEdit}>Edit the menu</ActionButton>
        </div>
        <p className="text-xs text-foreground/45">Takes you back to the POS with editing on. It stays on, through reloads, until you tap Lock there.</p>
      </div>
    </section>
  )
}
