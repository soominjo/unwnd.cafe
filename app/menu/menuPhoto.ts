import type { ImageLoader } from 'next/image'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import { urlFor } from '@/sanity/lib/image'

export const PHOTO_QUALITY = 70

/**
 * A next/image loader that has Sanity's image CDN do the resizing: a square crop around the
 * hotspot, at each width next/image asks for, as AVIF or WebP where the browser takes them.
 * Vercel's image optimiser is never involved.
 */
export function photoLoader(image: SanityImageSource): ImageLoader {
  return ({ width, quality }) =>
    urlFor(image).width(width).height(width).fit('crop').auto('format').quality(quality ?? PHOTO_QUALITY).url()
}

/** The plain `src` next/image also needs: the same photo at 600px. */
export function photoSrc(image: SanityImageSource): string {
  return photoLoader(image)({ src: '', width: 600 })
}
