import type { KeptNotice } from './orderDraft'

export type { KeptNotice }

const MESSAGES: Record<KeptNotice, string> = {
  'maybe-saved': 'The page reloaded while this order was being saved, so it may be saved already. Check Sales before charging again.',
  'already-added': 'The new items were saved just before the page reloaded. Print their receipt from Sales.',
  'added-other-amounts': 'An earlier save of the new items went through just before the page reloaded, with other amounts. The order shows what was saved: add anything still missing.',
}

interface KeptOrderNoticeProps {
  notice: KeptNotice
  /** OK: the cashier has seen it. */
  onDismiss: () => void
}

/** Under the POS header after a reload came in the middle of a save, until OK. */
export function KeptOrderNotice({ notice, onDismiss }: KeptOrderNoticeProps) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 px-6 py-2.5 bg-amber-50 border-b border-amber-200 shrink-0">
      <span className="text-xs text-amber-800 font-medium">{MESSAGES[notice]}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="h-9 px-3 shrink-0 rounded-sm text-[11px] font-bold uppercase tracking-widest text-amber-800 hover:bg-amber-100 transition-colors"
      >
        OK
      </button>
    </div>
  )
}
