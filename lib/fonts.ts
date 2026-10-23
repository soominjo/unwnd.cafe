import localFont from 'next/font/local'

// The brand wordmark's display face. The cups carry the mark in Bodoni MT
// Condensed Bold, a Microsoft Office font that can't be served on the web, so on
// screen the wordmark uses Noto Serif Display at its condensed width (62.5), the
// closest free match: a tall, high-contrast Didone with the same crossed W.
// The file is that one cut (width 62.5, weight 800) holding only the letters a
// wordmark needs, about 9 KB where the whole variable font was 76 KB on every
// page; scripts/fetch-wordmark-font.ts makes it. Use it through the `font-logo`
// utility in app/globals.css. The printed receipt logo is drawn separately
// (lib/printer/rasterize.ts).
export const notoSerifDisplay = localFont({
  src: '../app/fonts/NotoSerifDisplay-CondensedExtraBold-wordmark.woff2',
  weight: '800',
  style: 'normal',
  variable: '--font-noto-serif-display',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
})
