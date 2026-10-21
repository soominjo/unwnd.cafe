import type {StructureResolver} from 'sanity/structure'

import {GOOGLE_REVIEWS_ID, SINGLETON_TYPES} from './singletons'

// https://www.sanity.io/docs/structure-builder-cheat-sheet
// "Google reviews" is one fixed page rather than a list, so there is never a second copy.
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Google reviews')
        .id(GOOGLE_REVIEWS_ID)
        .child(S.document().schemaType('googleReviews').documentId(GOOGLE_REVIEWS_ID).title('Google reviews')),
      S.divider(),
      ...S.documentTypeListItems().filter((item) => !SINGLETON_TYPES.has(item.getId() ?? '')),
    ])
