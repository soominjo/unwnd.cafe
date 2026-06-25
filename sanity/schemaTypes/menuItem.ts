import { defineField, defineType } from 'sanity'

export const menuItem = defineType({
  name: 'menuItem',
  title: 'Menu Item',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
    }),
    defineField({
      name: 'subtitle',
      title: 'Subtitle / Short Description',
      type: 'string',
      description: 'Shown under the item name in the POS grid (ingredients, tagline, etc.)',
      validation: (rule) => rule.max(200),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      description: 'Must match a category id: signature, espresso, non-coffee, meal, waffle, snack, or a custom one.',
      options: {
        list: [
          { title: 'Signature', value: 'signature' },
          { title: 'Espresso', value: 'espresso' },
          { title: 'Non-Coffee', value: 'non-coffee' },
          { title: 'Meal', value: 'meal' },
          { title: 'Waffle', value: 'waffle' },
          { title: 'Snack', value: 'snack' },
        ],
      },
    }),
    // ── Pricing ──────────────────────────────────────────────────
    defineField({
      name: 'priceHot',
      title: 'Price — Hot (₱)',
      type: 'number',
      description: 'Leave empty if this item has no hot option.',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'priceIce',
      title: 'Price — Iced/Cold (₱)',
      type: 'number',
      description: 'Leave empty if this item has no iced option.',
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'price',
      title: 'Price — Fixed (₱)',
      type: 'number',
      description: 'Use for food or any item with a single price (no hot/iced split).',
      validation: (rule) => rule.min(0),
    }),
    // ─────────────────────────────────────────────────────────────
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
    }),
    {
      name: 'ingredients',
      title: 'Ingredients',
      type: 'array' as const,
      of: [{ type: 'string' as const }],
    },
    defineField({
      name: 'available',
      title: 'Available',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'featured',
      title: 'Featured on Homepage',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})
