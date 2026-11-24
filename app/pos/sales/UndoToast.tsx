interface UndoToastProps {
  /**
   * The latest tick, untick or Complete, such as "Classic Fries moved to Completed" or "Bea’s order is
   * complete", and how to undo it. null when there is nothing to undo.
   */
  bar: { message: string; undo: () => void } | null
}

/**
 * The dark bar under the tabs after a tick, an untick or Complete, with Undo for a wrong tap. It sticks
 * to the top of the screen while it shows, so it stays in sight when the card ticked is far down the
 * list. Its live region stays on the page while empty, so screen readers announce each new message;
 * empty, it takes no room (mb-0 cancels the page's gap below it).
 */
export default function UndoToast({ bar }: UndoToastProps) {
  return (
    <div role="status" className={bar ? 'sticky top-2 z-20' : 'mb-0'}>
      {bar && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-foreground py-1.5 pl-3.5 pr-1.5 shadow-lg">
          <span className="min-w-0 text-[13px] font-medium text-cream">{bar.message}</span>
          <button
            type="button"
            onClick={bar.undo}
            className="h-11 shrink-0 rounded-md bg-cream/15 px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-cream transition-colors hover:bg-cream/25"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
