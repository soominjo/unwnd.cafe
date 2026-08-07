'use client'

interface CardActionsProps {
  onEdit?: () => void
  onDelete?: () => void
  isBusy?: boolean
}

export default function CardActions({ onEdit, onDelete, isBusy }: CardActionsProps) {
  if (!onEdit && !onDelete) return null

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          disabled={isBusy}
          title="Edit item"
          className="w-6 h-6 flex items-center justify-center text-foreground/25 hover:text-foreground hover:bg-foreground/8 rounded-full text-xs transition-colors leading-none disabled:cursor-not-allowed"
        >
          ✎
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          disabled={isBusy}
          title="Delete item"
          className="w-6 h-6 flex items-center justify-center text-foreground/25 hover:text-red-500 hover:bg-red-50 rounded-full text-sm transition-colors leading-none disabled:cursor-not-allowed"
        >
          {isBusy ? '…' : '×'}
        </button>
      )}
    </div>
  )
}
