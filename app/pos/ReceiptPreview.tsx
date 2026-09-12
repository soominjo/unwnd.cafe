'use client'

import type { ReactElement, ReactNode } from 'react'
import { IBM_Plex_Mono } from 'next/font/google'
import { assertNeverBlock, type ReceiptBlock } from '@/lib/printer/receiptDocument'
import { RECEIPT_COLUMNS, THERMAL_COLUMNS, type ThermalColumns } from '@/lib/printer/thermalConfig'
import { LogoBitmap, QrBitmap } from './ReceiptBitmaps'

// A thin, evenly spaced monospace: the closest a screen gets to the printer's
// regular-weight Font A. Loaded here rather than in the root layout so only the
// POS pays for it.
const receiptFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['300'], display: 'swap' })

interface ReceiptPreviewProps {
  blocks: readonly ReceiptBlock[]
  columns?: ThermalColumns
}

/** Line height as a multiple of the font size; spacers use it too so blank lines match text lines. */
const LINE_HEIGHT = 1.75
/** One blank printed line, as a CSS length — the printer feeds this much after every bitmap. */
const ONE_LINE = `${LINE_HEIGHT}em`
/** Unprintable margin either side of the paper, in ch, so a full-width line never wraps in the preview. */
const PAPER_MARGIN_CH = 3

// 1ch is one printed character, so the encoder's column widths map straight to CSS.
const ch = (characters: number) => `${characters}ch`
const QTY_COLUMN = ch(RECEIPT_COLUMNS.qty)
const MONEY_COLUMN = ch(RECEIPT_COLUMNS.money)
const TOTAL_VALUE_COLUMN = ch(RECEIPT_COLUMNS.totalValue)

function formatMoney(value: number): string {
  return `₱${value.toFixed(2)}`
}

const TORN_EDGE =
  'polygon(0% 0%,4% 100%,8% 0%,12% 100%,16% 0%,20% 100%,24% 0%,28% 100%,32% 0%,36% 100%,40% 0%,44% 100%,48% 0%,52% 100%,56% 0%,60% 100%,64% 0%,68% 100%,72% 0%,76% 100%,80% 0%,84% 100%,88% 0%,92% 100%,96% 0%,100% 100%,100% 0%)'

export default function ReceiptPreview({ blocks, columns = THERMAL_COLUMNS }: ReceiptPreviewProps) {
  return (
    <div className={`${receiptFont.className} mx-auto text-[11px]`} style={{ width: ch(columns + PAPER_MARGIN_CH * 2) }}>
      <div className="h-2 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]" style={{ clipPath: TORN_EDGE }} />
      <div
        className="bg-white text-black font-light py-6 shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
        style={{ paddingInline: ch(PAPER_MARGIN_CH), lineHeight: LINE_HEIGHT }}
      >
        {blocks.map((block, i) => (
          <ReceiptBlockView key={i} block={block} columns={columns} />
        ))}
        <div className="pt-4 mt-2 border-t border-dotted border-black/25 text-black/30 text-center">
          <span className="text-[9px] tracking-[0.3em] uppercase">✂ cut here</span>
        </div>
      </div>
      <div className="h-2 bg-white shadow-[0_-1px_2px_rgba(0,0,0,0.08)] rotate-180" style={{ clipPath: TORN_EDGE }} />
    </div>
  )
}

/** Emulates ESC/POS double-height text: glyphs keep their width and grow to twice their height. */
function Stretched({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative" style={{ height: `${LINE_HEIGHT * 2}em` }}>
      <div
        className={`absolute inset-x-0 bottom-0 ${className}`}
        style={{ transform: 'scaleY(2)', transformOrigin: 'bottom' }}
      >
        {children}
      </div>
    </div>
  )
}

function TotalRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  const row = (
    <>
      <span className={`text-right ${emphasis ? '' : 'text-black/70'}`}>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </>
  )
  const gridStyle = { gridTemplateColumns: `1fr ${TOTAL_VALUE_COLUMN}` }
  if (emphasis) {
    return (
      <Stretched>
        <div className="grid" style={gridStyle}>
          {row}
        </div>
      </Stretched>
    )
  }
  return (
    <div className="grid" style={gridStyle}>
      {row}
    </div>
  )
}

function ReceiptBlockView({ block, columns }: { block: ReceiptBlock; columns: ThermalColumns }): ReactElement {
  switch (block.kind) {
    case 'logo':
      return (
        <div style={{ marginBottom: ONE_LINE }}>
          <LogoBitmap columns={columns} fallback={<Stretched className="text-center">{block.fallbackText}</Stretched>} />
        </div>
      )
    case 'meta':
      return <p className="text-center text-black/70">{block.text}</p>
    case 'rule':
      return (
        <div
          className={`my-2 border-black/50 ${block.style === 'double' ? 'border-t-[3px] border-double' : 'border-t border-dashed'}`}
        />
      )
    case 'detail':
      return (
        <div className="flex justify-between gap-2">
          <span className="text-black/70">{block.label}</span>
          <span className="tabular-nums text-right">{block.value}</span>
        </div>
      )
    case 'item':
      return (
        <div
          className="grid"
          style={{ gridTemplateColumns: block.lineTotal === null ? `${QTY_COLUMN} 1fr` : `${QTY_COLUMN} 1fr ${MONEY_COLUMN}` }}
        >
          <span>{block.qty}</span>
          <span className="wrap-break-word">
            {block.name}
            {block.variant && <span className="text-black/60"> ({block.variant})</span>}
          </span>
          {block.lineTotal !== null && <span className="text-right tabular-nums">{formatMoney(block.lineTotal)}</span>}
        </div>
      )
    case 'itemNote':
      return (
        <p className="text-black/55 wrap-break-word" style={{ paddingLeft: QTY_COLUMN }}>
          » {block.text}
        </p>
      )
    case 'total':
      return (
        <TotalRow
          label={block.label}
          value={`${block.isDiscount ? '-' : ''}${formatMoney(block.value)}`}
          emphasis={block.emphasis}
        />
      )
    case 'spacer':
      return <div aria-hidden style={{ height: `${(block.lines ?? 1) * LINE_HEIGHT}em` }} />
    case 'qr':
      return (
        <div className="text-center">
          <QrBitmap url={block.url} columns={columns} />
          <p className="text-black/70" style={{ marginTop: ONE_LINE }}>
            {block.caption}
          </p>
        </div>
      )
    case 'footer':
      return <p className="text-center">{block.text}</p>
    default:
      return assertNeverBlock(block)
  }
}
