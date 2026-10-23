// The "life at unwnd." photos, in the owner's order of 2026-10-23: outside 1 (the patio), entrance 1,
// the cashier, inside 1, inside 2, outside 2, outside 3. Each is cropped to 4:5 (public/highlights/).

export interface HighlightPhoto {
  src: string
  /** What the photo shows, for anyone who can't see it. */
  alt: string
}

/** The photos' size as cropped, so the page keeps their space before they load. */
export const HIGHLIGHT_WIDTH = 1200
export const HIGHLIGHT_HEIGHT = 1500

export const HIGHLIGHT_PHOTOS: readonly HighlightPhoto[] = [
  { src: '/highlights/patio.jpg', alt: 'The covered patio seen from the garden, lit up at blue hour.' },
  { src: '/highlights/entrance.jpg', alt: 'The café from the driveway at dusk, string lights over the walk to the order window.' },
  { src: '/highlights/order-window.jpg', alt: 'The order window, the menu boards beside it and the “Order & pay here” sign below.' },
  { src: '/highlights/mirror.jpg', alt: 'A wood-framed mirror lettered “Damn, you look good!”, reflecting the garden at dusk.' },
  { src: '/highlights/tables.jpg', alt: 'Rattan chairs round a table with a gold lamp, beside the bar window.' },
  { src: '/highlights/garden.jpg', alt: 'Umbrella tables on the gravel garden under string lights.' },
  { src: '/highlights/umbrella.jpg', alt: 'Rattan tables under a big umbrella, palms all around.' },
]
