'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { renderLogoBitmap, renderQrBitmap, type Bitmap } from '@/lib/printer/rasterize'
import { DOTS_PER_COLUMN, THERMAL_IMAGE_SIZES, type ThermalColumns } from '@/lib/printer/thermalConfig'

// Preview-side twins of the bitmaps the thermal printer receives. They paint the
// very same canvases rasterize.ts hands to the ESC/POS encoder, scaled so that
// 12 printer dots = 1ch — the width of one character on the paper.

interface BitmapCanvasProps {
  render: () => Promise<Bitmap>
  dots: number
  label: string
  /** Shown instead of the canvas when the bitmap cannot be rendered — mirrors the printer's own fallback. */
  fallback?: ReactNode
}

function dotsToCh(dots: number): string {
  return `${dots / DOTS_PER_COLUMN}ch`
}

function BitmapCanvas({ render, dots, label, fallback = null }: BitmapCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Remembers which render function failed, so a new one (new url / size) gets a fresh attempt.
  const [failedRender, setFailedRender] = useState<BitmapCanvasProps['render'] | null>(null)

  useEffect(() => {
    let cancelled = false
    render()
      .then(({ canvas }) => {
        const target = ref.current
        if (cancelled || !target) return
        target.width = canvas.width
        target.height = canvas.height
        target.style.width = dotsToCh(canvas.width)
        target.getContext('2d')?.drawImage(canvas, 0, 0)
      })
      .catch((error: unknown) => {
        console.warn(`Receipt preview could not render the ${label}.`, error)
        if (!cancelled) setFailedRender(() => render)
      })
    return () => {
      cancelled = true
    }
  }, [render, label])

  if (failedRender === render) return <>{fallback}</>
  return (
    <canvas
      ref={ref}
      width={dots}
      height={dots}
      role="img"
      aria-label={label}
      className="block mx-auto"
      style={{ width: dotsToCh(dots) }}
    />
  )
}

export function LogoBitmap({ columns, fallback }: { columns: ThermalColumns; fallback?: ReactNode }) {
  const dots = THERMAL_IMAGE_SIZES[columns].logo
  const render = useCallback(() => renderLogoBitmap(dots), [dots])
  return <BitmapCanvas render={render} dots={dots} label="unwnd. cafe logo" fallback={fallback} />
}

export function QrBitmap({ url, columns }: { url: string; columns: ThermalColumns }) {
  const dots = THERMAL_IMAGE_SIZES[columns].qr
  const render = useCallback(() => renderQrBitmap(url, dots), [url, dots])
  return <BitmapCanvas render={render} dots={dots} label="Google review QR code" />
}
