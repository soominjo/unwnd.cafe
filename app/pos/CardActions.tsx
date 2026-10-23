'use client'

interface CardActionsProps {
  onEdit?: () => void
  onDelete?: () => void
  isBusy?: boolean
}

export default function CardActions({ onEdit, onDelete, isBusy }: CardActionsProps) {
  if (!onEdit && !onDelete) return null

  return (
    // Stacked on a phone, so the item's name keeps more of a narrow card's width.
    <div className="absolute top-2 right-2 z-10 flex max-sm:flex-col items-center gap-1">
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          disabled={isBusy}
          title="Edit item"
          className="w-7 h-7 flex items-center justify-center text-foreground/25 hover:text-foreground hover:bg-foreground/8 rounded-full text-xs transition-colors leading-none disabled:cursor-not-allowed"
        >
          ✎
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          disabled={isBusy}
          title="Delete item"
          className="w-7 h-7 flex items-center justify-center text-foreground/25 hover:text-red-500 hover:bg-red-50 rounded-full text-sm transition-colors leading-none disabled:cursor-not-allowed"
        >
          {isBusy ? '…' : '×'}
        </button>
      )}
    </div>
  )
}
