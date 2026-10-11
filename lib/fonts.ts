import { Noto_Serif_Display } from 'next/font/google'

// The brand wordmark's display face. The cups carry the mark in Bodoni MT
// Condensed Bold, a Microsoft Office font that can't be served on the web, so on
// screen the wordmark uses Noto Serif Display at its condensed width (62.5), the
// closest free match: a tall, high-contrast Didone with the same crossed W.
// The `font-logo` utility in app/globals.css sets the width and weight that go
// with it. The printed receipt logo is drawn separately (lib/printer/rasterize.ts).
export const notoSerifDisplay = Noto_Serif_Display({
  variable: '--font-noto-serif-display',
  subsets: ['latin'],
  weight: 'variable',
  axes: ['wdth'],
  display: 'swap',
})
