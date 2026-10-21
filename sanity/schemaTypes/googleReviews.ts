import { defineArrayMember, defineField, defineType } from 'sanity'

// One page in Studio (see sanity/structure.ts) holding what the home page shows from Google:
// the rating and count in the hero and above the reviews, and the reviews chosen to show.
export const googleReviews = defineType({
  name: 'googleReviews',
  title: 'Google reviews',
  type: 'document',
  fields: [
    defineField({
      name: 'rating',
      title: 'Google rating',
      type: 'number',
      description: 'As Google Maps shows it, for example 4.9.',
      initialValue: 5,
      validation: (rule) => rule.min(1).max(5).precision(1),
    }),
    defineField({
      name: 'reviewCount',
      title: 'Number of reviews',
      type: 'number',
      description: 'Check Google Maps before publishing.',
      initialValue: 34,
      validation: (rule) => rule.integer().min(0),
    }),
    defineField({
      name: 'reviews',
      title: 'Reviews to show',
      type: 'array',
      description: 'Copy reviews you like from Google Maps, word for word. Drag to change the order.',
      of: [
        defineArrayMember({
          name: 'googleReview',
          title: 'Review',
          type: 'object',
          fields: [
            defineField({
              name: 'quote',
              title: 'Review',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required().max(400),
            }),
            defineField({
              name: 'name',
              title: "Reviewer's first name",
              type: 'string',
              validation: (rule) => rule.required().max(40),
            }),
            defineField({
              name: 'date',
              title: 'Month of the review',
              type: 'date',
              options: { dateFormat: 'MMMM YYYY' },
            }),
            defineField({
              name: 'stars',
              title: 'Stars',
              type: 'number',
              initialValue: 5,
              validation: (rule) => rule.integer().min(1).max(5),
            }),
          ],
          preview: { select: { title: 'name', subtitle: 'quote' } },
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Google reviews' }) },
})
