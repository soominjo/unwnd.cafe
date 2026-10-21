import type { ImageLoader } from 'next/image'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import { urlFor } from '@/sanity/lib/image'

export const PHOTO_QUALITY = 70

/** Height over width of a menu card's photo: the whole 9:16 drink shot, uncropped. */
export const CARD_PHOTO_RATIO = 16 / 9

/** Height over width of the close-up's photo: tall, but leaving room for the Add button on a phone. */
export const SHEET_PHOTO_RATIO = 5 / 4

/**
 * A next/image loader that has Sanity's image CDN do the resizing: a crop of the given shape
 * (height = width × ratio) around the hotspot, at each width next/image asks for, as AVIF or
 * WebP where the browser takes them. Vercel's image optimiser is never involved.
 */
export function photoLoader(image: SanityImageSource, ratio: number): ImageLoader {
  return ({ width, quality }) =>
    urlFor(image)
      .width(width)
      .height(Math.round(width * ratio))
      .fit('crop')
      .auto('format')
      .quality(quality ?? PHOTO_QUALITY)
      .url()
}

/** The plain `src` next/image also needs: the same photo at 600px wide. */
export function photoSrc(image: SanityImageSource, ratio: number): string {
  return photoLoader(image, ratio)({ src: '', width: 600 })
}
