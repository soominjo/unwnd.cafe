import type { ReceiptBlock } from '@/lib/printer/receiptDocument'

interface ReceiptPreviewProps {
  blocks: ReceiptBlock[]
  columns?: 32 | 48
}

function formatMoney(value: number): string {
  return `₱${value.toFixed(2)}`
}

export default function ReceiptPreview({ blocks, columns = 32 }: ReceiptPreviewProps) {
  return (
    <div
      className="receipt-print-area bg-white text-black font-mono text-[11px] leading-relaxed mx-auto px-3 py-4"
      style={{ width: `${columns}ch` }}
    >
      {blocks.map((block, i) => (
        <ReceiptBlockView key={i} block={block} />
      ))}
    </div>
  )
}

function ReceiptBlockView({ block }: { block: ReceiptBlock }) {
  switch (block.kind) {
    case 'heading':
      return <p className="text-center font-bold text-sm mb-1">{block.text}</p>
    case 'meta':
      return <p className="text-center text-black/60 mb-2">{block.text}</p>
    case 'rule':
      return (
        <div
          className={`my-1.5 border-t border-black/40 ${block.style === 'double' ? 'border-double border-t-4' : 'border-dashed'}`}
        />
      )
    case 'item':
      return (
        <div className="flex justify-between gap-2 py-0.5">
          <span className="truncate">
            {block.name}
            {block.variant && <span className="text-black/55"> ({block.variant})</span>}
          </span>
          <span className="shrink-0 tabular-nums">
            {block.qty}x {formatMoney(block.lineTotal)}
          </span>
        </div>
      )
    case 'total':
      return (
        <div className={`flex justify-between py-0.5 ${block.emphasis ? 'font-bold text-sm' : ''}`}>
          <span>{block.label}</span>
          <span className="tabular-nums">
            {block.isDiscount ? '-' : ''}
            {formatMoney(block.value)}
          </span>
        </div>
      )
    case 'note':
      return <p className="py-0.5 wrap-break-word">Note: {block.text}</p>
    case 'footer':
      return <p className="text-center mt-2">{block.text}</p>
  }
}
