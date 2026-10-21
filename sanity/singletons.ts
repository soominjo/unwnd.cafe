// Documents that Studio shows as one fixed page each, instead of a list to add to.
// No imports, so both the Studio config and the site can use it.

/** The one "Google reviews" document: the rating, the count and the reviews shown on the home page. */
export const GOOGLE_REVIEWS_ID = 'google-reviews'

export const SINGLETON_TYPES: ReadonlySet<string> = new Set(['googleReviews'])
