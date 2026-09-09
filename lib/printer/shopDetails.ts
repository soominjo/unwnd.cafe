// Brand and location details printed on every receipt. Kept in one place so the
// thermal print, the on-screen preview, and the PDF can never disagree on them.
//
// These strings travel through the ESC/POS encoder, whose default code pages
// (e.g. CP437) have no glyphs for "–" or "·" — stick to plain ASCII punctuation.

export interface ShopDetails {
  name: string
  /** Street address, pre-split into lines that fit a 32-column receipt. */
  addressLines: readonly string[]
  hours: string
  instagram: string
  /** Google Maps review link, printed as a scannable QR code. */
  reviewUrl: string
}

export const UNWND_SHOP: ShopDetails = {
  name: 'unwnd. cafe',
  addressLines: ['Tuesday St., St. Joseph Village', 'Niog, Bacoor, Cavite'],
  hours: 'Open 5:00 PM - 12:00 AM',
  instagram: '@unwnd.cafe',
  reviewUrl: 'https://maps.app.goo.gl/ubi9AsWpWSRoBMVj9?g_st=ic',
}
