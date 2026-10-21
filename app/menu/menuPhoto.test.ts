import { describe, it, expect, vi } from 'vitest'

// sanity/env.ts reads these when the image builder is imported.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'proj'
  process.env.NEXT_PUBLIC_SANITY_DATASET = 'prod'
})

import { CARD_PHOTO_RATIO, SHEET_PHOTO_RATIO, photoLoader, photoSrc } from './menuPhoto'

const IMG = { asset: { _ref: 'image-abc123-800x600-jpg' } }

describe('menu photos from Sanity', () => {
  it("asks Sanity for the card's tall shape at the width shown, in the best format", () => {
    const url = photoLoader(IMG, CARD_PHOTO_RATIO)({ src: '', width: 480 })
    expect(url.startsWith('https://cdn.sanity.io/images/proj/prod/abc123-800x600.jpg?')).toBe(true)
    for (const p of ['w=480', 'h=853', 'fit=crop', 'auto=format', 'q=70']) expect(url).toContain(p)
  })

  it("asks for the close-up's 4:5 shape", () => {
    const url = photoLoader(IMG, SHEET_PHOTO_RATIO)({ src: '', width: 480 })
    expect(url).toContain('w=480')
    expect(url).toContain('h=600')
  })

  it('uses the quality next/image passes', () => {
    expect(photoLoader(IMG, CARD_PHOTO_RATIO)({ src: '', width: 480, quality: 50 })).toContain('q=50')
  })

  it('keeps the crop and hotspot chosen in Studio', () => {
    const cropped = { ...IMG, crop: { top: 0.1, bottom: 0.1, left: 0, right: 0 }, hotspot: { x: 0.5, y: 0.4, width: 0.5, height: 0.5 } }
    // At 9:16, the uncropped 800×600 gives its full 600 height and 338 of its width, centred:
    // left 231. With 10% cropped off the top and bottom it is 480 high and 270 wide, from top 60,
    // centred on the hotspot (x 400): left 265.
    expect(photoLoader(cropped, CARD_PHOTO_RATIO)({ src: '', width: 480 })).toContain('rect=265,60,270,480')
    expect(photoLoader(IMG, CARD_PHOTO_RATIO)({ src: '', width: 480 })).toContain('rect=231,0,338,600')
  })

  it('gives a 600px-wide plain src in the shape asked for', () => {
    const src = photoSrc(IMG, CARD_PHOTO_RATIO)
    expect(src).toContain('w=600')
    expect(src).toContain('h=1067')
  })
})
