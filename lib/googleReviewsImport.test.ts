import { describe, it, expect } from 'vitest'
import {
  assertPublishable,
  importWarnings,
  parseExportFile,
  parseTakeoutReviews,
  summarize,
  toStudioReviews,
  type TakeoutReview,
} from './googleReviewsImport'

// A review as a Google Takeout export of a Business Profile holds it (the Business Profile API's shape).
const takeoutReview = (over: Record<string, unknown> = {}) => ({
  name: 'accounts/111/locations/222/reviews/AbCdEf1',
  reviewer: { profilePhotoUrl: 'https://lh3.googleusercontent.com/a/x', displayName: 'Angela Reyes' },
  starRating: 'FIVE',
  comment: 'Good coffee and great ambiance.',
  createTime: '2026-06-03T09:15:00.123Z',
  updateTime: '2026-06-03T09:15:00.123Z',
  reviewReply: { comment: 'Thank you, Angela!', updateTime: '2026-06-04T01:00:00Z' },
  ...over,
})

const parsed = (over: Partial<TakeoutReview> = {}): TakeoutReview => ({
  id: 'r1',
  displayName: 'Angela Reyes',
  anonymous: false,
  stars: 5,
  text: 'Good coffee and great ambiance.',
  createTime: '2026-06-03T09:15:00.123Z',
  ...over,
})

describe('parseTakeoutReviews', () => {
  it('reads a Business Profile review, and not the owner reply inside it', () => {
    expect(parseTakeoutReviews({ reviews: [takeoutReview()] })).toEqual([
      {
        id: 'AbCdEf1',
        displayName: 'Angela Reyes',
        anonymous: false,
        stars: 5,
        text: 'Good coffee and great ambiance.',
        createTime: '2026-06-03T09:15:00.123Z',
      },
    ])
  })

  it('reads a rating without words as a review with no text', () => {
    const [review] = parseTakeoutReviews({ reviews: [takeoutReview({ comment: undefined, starRating: 'FOUR' })] })
    expect(review.text).toBe('')
    expect(review.stars).toBe(4)
  })

  it('finds reviews wherever the export nests them, across files, and counts a repeated one once', () => {
    const a = takeoutReview({ name: 'accounts/1/locations/2/reviews/A' })
    const b = takeoutReview({ name: 'accounts/1/locations/2/reviews/B', reviewer: { displayName: 'Ben Cruz' } })
    const files = [{ location: { reviews: [a] } }, { reviews: [a, b] }]
    expect(parseTakeoutReviews(files).map((r) => r.id)).toEqual(['A', 'B'])
  })

  it('takes the id from reviewId when there is no resource name, and numeric or unknown ratings', () => {
    const [numeric, unknown] = parseTakeoutReviews([
      takeoutReview({ name: undefined, reviewId: 'xyz', starRating: 4 }),
      takeoutReview({ name: undefined, reviewId: 'abc', starRating: 'STAR_RATING_UNSPECIFIED' }),
    ])
    expect(numeric.id).toBe('xyz')
    expect(numeric.stars).toBe(4)
    expect(unknown.stars).toBeNull()
  })

  it('reads a rating written as a number in a string, from "1" to "5" only', () => {
    const ratings = parseTakeoutReviews(
      ['1', ' 5 ', '6', '4.5', '0'].map((starRating, i) => takeoutReview({ name: undefined, reviewId: `s${i}`, starRating }))
    ).map((r) => r.stars)
    expect(ratings).toEqual([1, 5, null, null, null])
  })

  it("keeps the reviewer's own words when Google added a translation, in either order", () => {
    const [translatedFirst, originalFirst] = parseTakeoutReviews([
      takeoutReview({ reviewId: 't1', name: undefined, comment: '(Translated by Google) Very delicious\n\n(Original)\nNapakasarap ng kape' }),
      takeoutReview({ reviewId: 't2', name: undefined, comment: 'Napakasarap ng kape\n\n(Translated by Google)\nThe coffee is very delicious' }),
    ])
    expect(translatedFirst.text).toBe('Napakasarap ng kape')
    expect(originalFirst.text).toBe('Napakasarap ng kape')
  })

  it('marks a reviewer Google shows as anonymous', () => {
    const [review] = parseTakeoutReviews([takeoutReview({ reviewer: { displayName: 'A Google User', isAnonymous: true } })])
    expect(review.anonymous).toBe(true)
  })

  it('finds nothing in something that is not an export', () => {
    expect(parseTakeoutReviews(null)).toEqual([])
    expect(parseTakeoutReviews({ title: 'Business info', phone: '+63' })).toEqual([])
  })
})

describe('toStudioReviews', () => {
  it('shows only reviews with words and four or five stars', () => {
    const shown = toStudioReviews(
      [
        parsed({ id: 'five', text: 'Lovely place.' }),
        parsed({ id: 'four', stars: 4, text: 'Nice drinks.' }),
        parsed({ id: 'three', stars: 3, text: 'It was fine.' }),
        parsed({ id: 'starsOnly', text: '' }),
        parsed({ id: 'noRating', stars: null, text: 'Hmm.' }),
      ],
      []
    )
    expect(shown.map((r) => r.quote)).toEqual(['Lovely place.', 'Nice drinks.'])
  })

  it("leaves out the owner's own review", () => {
    const shown = toStudioReviews([parsed({ id: 'own', displayName: 'Gens Contreras', text: 'Best café!' })], [])
    expect(shown).toEqual([])
  })

  it('shows the first name only, and keeps a whole "A Google user"', () => {
    const shown = toStudioReviews(
      [
        parsed({ id: 'a', displayName: 'Jasper Villanueva Santos', createTime: '2026-10-02T00:00:00Z' }),
        parsed({ id: 'b', displayName: 'A Google User', anonymous: true, text: 'Great.', createTime: '2026-10-01T00:00:00Z' }),
      ],
      []
    )
    expect(shown.map((r) => r.name)).toEqual(['Jasper', 'A Google user'])
  })

  it('keeps a first name that starts with an abbreviation, such as "Ma." for Maria', () => {
    const shown = toStudioReviews([parsed({ displayName: 'Ma. Cristina Santos' })], [])
    expect(shown[0].name).toBe('Ma. Cristina')
  })

  it('keeps the key and the name of a review already in Studio, however its quotation marks and spaces were typed', () => {
    const shown = toStudioReviews(
      [parsed({ id: 'sj', displayName: 'Sarah Jane Dela Cruz', text: 'Spanish Latte —  9/10 ☕✨' })],
      [{ _key: 'google-2', quote: '“Spanish Latte — 9/10 ☕✨”', name: 'Sarah Jane' }]
    )
    expect(shown).toEqual([
      { _key: 'google-2', _type: 'googleReview', quote: 'Spanish Latte — 9/10 ☕✨', name: 'Sarah Jane', date: '2026-06-03', stars: 5 },
    ])
  })

  it('gives a new review a key that is the same on every run and differs between reviews', () => {
    const first = toStudioReviews([parsed({ id: 'one' }), parsed({ id: 'two', text: 'Other words.' })], [])
    const again = toStudioReviews([parsed({ id: 'one' })], [])
    expect(again[0]._key).toBe(first[0]._key)
    expect(first[0]._key).not.toBe(first[1]._key)
    expect(first[0]._key).toMatch(/^[a-z0-9]+$/)
    expect(first.every((r) => r._type === 'googleReview')).toBe(true)
  })

  it('puts the review on its Manila date and the newest first', () => {
    const shown = toStudioReviews(
      [
        parsed({ id: 'older', text: 'Older.', createTime: '2026-04-10T03:00:00Z' }),
        // 18:30 UTC on 31 May is 02:30 on 1 June in Manila.
        parsed({ id: 'newer', text: 'Newer.', createTime: '2026-05-31T18:30:00Z' }),
        parsed({ id: 'undated', text: 'Undated.', createTime: '' }),
      ],
      []
    )
    expect(shown.map((r) => [r.quote, r.date])).toEqual([
      ['Newer.', '2026-06-01'],
      ['Older.', '2026-04-10'],
      ['Undated.', undefined],
    ])
  })

  it('runs the lines of a review together and cuts one over 400 characters at a word, with an ellipsis', () => {
    const [lines] = toStudioReviews([parsed({ text: 'Great coffee.\n\nNice   staff.' })], [])
    expect(lines.quote).toBe('Great coffee. Nice staff.')

    const long = `${'word '.repeat(90)}ending`
    const [cut] = toStudioReviews([parsed({ text: long })], [])
    expect(cut.quote.length).toBeLessThanOrEqual(400)
    expect(cut.quote.endsWith('word…')).toBe(true)
  })

  it('cuts a long run of emoji without a space whole, never through one', () => {
    const [cut] = toStudioReviews([parsed({ text: 'Wow '.concat('😀'.repeat(250)) })], [])
    expect(cut.quote.length).toBeLessThanOrEqual(400)
    expect(cut.quote.endsWith('😀…')).toBe(true)
    // A lone half of a surrogate pair is a broken character.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(cut.quote)).toBe(false)
  })
})

describe('parseExportFile', () => {
  it('reads a file saved with a byte order mark', () => {
    expect(parseExportFile('reviews.json', '﻿{"reviews":[]}')).toEqual({ reviews: [] })
  })

  it('names the file that is not JSON', () => {
    expect(() => parseExportFile('Takeout/location-2/reviews.json', '{ "reviews": [')).toThrow(/Takeout\/location-2\/reviews\.json/)
  })
})

describe('importWarnings', () => {
  it('warns when the export counts fewer reviews than Studio has, since Google may have removed some', () => {
    const [warning, ...rest] = importWarnings({ exportCount: 60, studioCount: 62, hasDraft: false })
    expect(warning).toMatch(/60/)
    expect(warning).toMatch(/62/)
    expect(rest).toEqual([])
  })

  it('warns when unpublished Studio changes would overwrite the import once published', () => {
    const [warning, ...rest] = importWarnings({ exportCount: 62, studioCount: 62, hasDraft: true })
    expect(warning).toMatch(/unpublished/i)
    expect(rest).toEqual([])
  })

  it('has nothing to warn about otherwise', () => {
    expect(importWarnings({ exportCount: 62, studioCount: 62, hasDraft: false })).toEqual([])
    expect(importWarnings({ exportCount: 63, studioCount: 62, hasDraft: false })).toEqual([])
    expect(importWarnings({ exportCount: 5, studioCount: null, hasDraft: false })).toEqual([])
  })
})

describe('assertPublishable', () => {
  it('refuses to publish no reviews, so an export it could not read never wipes the ones in Studio', () => {
    expect(() => assertPublishable([])).toThrow(/nothing to publish/i)
    expect(() => assertPublishable(toStudioReviews([parsed()], []))).not.toThrow()
  })
})

describe('summarize', () => {
  it('gives the mean of every rating to one decimal and counts every review, words or not', () => {
    expect(
      summarize([
        parsed({ id: 'a', stars: 5 }),
        parsed({ id: 'b', stars: 5, text: '' }),
        parsed({ id: 'c', stars: 5, displayName: 'Gens Contreras' }),
        parsed({ id: 'd', stars: 4 }),
      ])
    ).toEqual({ rating: 4.8, reviewCount: 4 })
  })

  it('has no rating without any rated review', () => {
    expect(summarize([])).toEqual({ rating: null, reviewCount: 0 })
    expect(summarize([parsed({ stars: null })])).toEqual({ rating: null, reviewCount: 1 })
  })
})
