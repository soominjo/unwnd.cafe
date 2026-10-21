import { describe, it, expect, vi } from 'vitest'

// sanity/env.ts reads these when the image builder is imported.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'proj'
  process.env.NEXT_PUBLIC_SANITY_DATASET = 'prod'
})

import { photoLoader, photoSrc } from './menuPhoto'

const IMG = { asset: { _ref: 'image-abc123-800x600-jpg' } }

describe('menu photos from Sanity', () => {
  it('asks Sanity for a square crop at the width shown, in the best format', () => {
    const url = photoLoader(IMG)({ src: '', width: 480 })
    expect(url.startsWith('https://cdn.sanity.io/images/proj/prod/abc123-800x600.jpg?')).toBe(true)
    for (const p of ['w=480', 'h=480', 'fit=crop', 'auto=format', 'q=70']) expect(url).toContain(p)
  })

  it('uses the quality next/image passes', () => {
    expect(photoLoader(IMG)({ src: '', width: 480, quality: 50 })).toContain('q=50')
  })

  it('keeps the crop and hotspot chosen in Studio', () => {
    const cropped = { ...IMG, crop: { top: 0.1, bottom: 0.1, left: 0, right: 0 }, hotspot: { x: 0.5, y: 0.4, width: 0.5, height: 0.5 } }
    // 800×600 with 10% cropped off the top and bottom leaves 800×480; the square is 480 wide,
    // centred on the hotspot (x 400): left 160, top 60. Uncropped, it is the middle 600×600.
    expect(photoLoader(cropped)({ src: '', width: 480 })).toContain('rect=160,60,480,480')
    expect(photoLoader(IMG)({ src: '', width: 480 })).toContain('rect=100,0,600,600')
  })

  it('gives a 600px square as the plain src', () => {
    const src = photoSrc(IMG)
    expect(src).toContain('w=600')
    expect(src).toContain('h=600')
  })
})
