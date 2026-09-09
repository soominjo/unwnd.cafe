import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { ActionButton } from './ui'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

const ELLIPSIS = '…'

/** First, last, and the two pages either side of the current one; gaps collapse to an ellipsis. */
function visiblePages(page: number, totalPages: number): Array<number | typeof ELLIPSIS> {
  const kept = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2,
  )
  return kept.flatMap((p, i) => (i > 0 && p - kept[i - 1] > 1 ? [ELLIPSIS, p] : [p]))
}

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  return (
    <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Pages">
      <ActionButton tone="neutral" icon={<ChevronLeftIcon />} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prev
      </ActionButton>

      <div className="flex items-center gap-1">
        {visiblePages(page, totalPages).map((p, i) =>
          p === ELLIPSIS ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-foreground/30">
              {ELLIPSIS}
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={page === p ? 'page' : undefined}
              className={`h-10 w-10 rounded-md text-xs font-bold tabular-nums transition-colors ${
                page === p
                  ? 'bg-foreground text-cream'
                  : 'border border-foreground/15 text-foreground/55 hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <ActionButton
        tone="neutral"
        trailingIcon={<ChevronRightIcon />}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </ActionButton>
    </nav>
  )
}
