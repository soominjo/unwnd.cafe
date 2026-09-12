import { Bodoni_Moda } from 'next/font/google'

// The "unwnd" wordmark's own display face — a tall, high-contrast Bodoni/Didot
// revival that matches the brand mark, distinct from the Cormorant Garamond
// serif used for regular headline copy. Shared between the root layout (CSS
// variable, for on-screen text) and the thermal/PDF receipt logo (drawn on a
// <canvas> via `style.fontFamily`), so both render the exact same face.
export const bodoniModa = Bodoni_Moda({
  variable: '--font-bodoni',
  subsets: ['latin'],
  weight: ['700', '900'],
  display: 'swap',
})
