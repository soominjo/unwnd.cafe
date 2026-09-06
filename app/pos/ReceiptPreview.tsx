import type { ReceiptBlock } from '@/lib/printer/receiptDocument'

interface ReceiptPreviewProps {
  blocks: ReceiptBlock[]
  columns?: 32 | 48
}

function formatMoney(value: number): string {
  return `₱${value.toFixed(2)}`
}

const TORN_EDGE =
  'polygon(0% 0%,4% 100%,8% 0%,12% 100%,16% 0%,20% 100%,24% 0%,28% 100%,32% 0%,36% 100%,40% 0%,44% 100%,48% 0%,52% 100%,56% 0%,60% 100%,64% 0%,68% 100%,72% 0%,76% 100%,80% 0%,84% 100%,88% 0%,92% 100%,96% 0%,100% 100%,100% 0%)'

export default function ReceiptPreview({ blocks, columns = 32 }: ReceiptPreviewProps) {
  return (
    <div className="mx-auto" style={{ width: `${columns}ch` }}>
      <div
        className="h-2 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
        style={{ clipPath: TORN_EDGE }}
      />
      <div className="receipt-print-area bg-white text-black font-mono text-[11px] leading-[1.55] px-3 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.12)]">
        {blocks.map((block, i) => (
          <ReceiptBlockView key={i} block={block} />
        ))}
        <div className="flex items-center gap-1.5 pt-3 mt-1 border-t border-dotted border-black/25 text-black/30">
          <span className="text-[9px] tracking-[0.3em] uppercase">✂ cut here</span>
        </div>
      </div>
      <div
        className="h-2 bg-white shadow-[0_-1px_2px_rgba(0,0,0,0.08)] rotate-180"
        style={{ clipPath: TORN_EDGE }}
      />
    </div>
  )
}

function ReceiptBlockView({ block }: { block: ReceiptBlock }) {
  switch (block.kind) {
    case 'heading':
      return <p className="text-center font-bold text-sm tracking-wider mb-1">{block.text}</p>
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
    case 'itemNote':
      return <p className="pl-3 text-[10px] text-black/45 italic -mt-0.5">» {block.text}</p>
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
