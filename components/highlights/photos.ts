// The "life at unwnd." photos, in the owner's walk-through of 2026-10-23: the entrance, inside, the
// order window, inside again, then out to the garden. Each is cropped to 4:5 (public/highlights/).

export interface HighlightPhoto {
  src: string
  /** What the photo shows, for anyone who can't see it. */
  alt: string
}

/** The photos' size as cropped, so the page keeps their space before they load. */
export const HIGHLIGHT_WIDTH = 1200
export const HIGHLIGHT_HEIGHT = 1500

export const HIGHLIGHT_PHOTOS: readonly HighlightPhoto[] = [
  { src: '/highlights/01-entrance.jpg', alt: 'The café from the driveway at dusk, string lights over the walk to the order window.' },
  { src: '/highlights/02-mirror.jpg', alt: 'A wood-framed mirror lettered “Damn, you look good!”, reflecting the garden at dusk.' },
  { src: '/highlights/03-order-window.jpg', alt: 'The order window, the menu boards beside it and the “Order & pay here” sign below.' },
  { src: '/highlights/04-tables.jpg', alt: 'Rattan chairs round a table with a gold lamp, beside the bar window.' },
  { src: '/highlights/05-patio.jpg', alt: 'The covered patio seen from the garden, lit up at blue hour.' },
  { src: '/highlights/06-garden.jpg', alt: 'Umbrella tables on the gravel garden under string lights.' },
  { src: '/highlights/07-umbrella.jpg', alt: 'Rattan tables under a big umbrella, palms all around.' },
]
