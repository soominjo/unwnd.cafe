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
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Signature Drink', value: 'signature drink' },
          { title: 'Coffee', value: 'coffee' },
          { title: 'Non-Coffee', value: 'non-coffee' },
          { title: 'Tea', value: 'tea' },
          { title: 'Frappe', value: 'frappe' },
          { title: 'Soda Fizz', value: 'soda fizz' },
          { title: 'Waffle', value: 'waffle' },
          { title: 'Nachos', value: 'nachos' },
        ],
      },
    }),
    defineField({
      name: 'drinkType',
      title: 'Drink Type',
      type: 'string',
      options: {
        list: [
          { title: 'Hot only', value: 'hot' },
          { title: 'Iced only', value: 'iced' },
          { title: 'Both (Hot & Iced)', value: 'both' },
        ],
        layout: 'radio',
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
      title: 'Price — Fixed (₱, food / single-price items)',
      type: 'number',
      description: 'Use this for food or any item that has one price regardless of temperature.',
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
    {
      name: 'sizes',
      title: 'Available Sizes',
      type: 'array' as const,
      of: [{ type: 'string' as const }],
      options: {
        list: [
          { title: '16oz', value: '16oz' },
          { title: '22oz', value: '22oz' },
        ],
      },
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
