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
      name: 'addonType',
      title: 'Add-on Type',
      type: 'string',
      description: 'Only used for items in the "Add ons" category — distinguishes drink add-ons from food add-ons.',
      options: {
        list: [
          { title: 'Drink', value: 'drink' },
          { title: 'Food', value: 'food' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'applicableCategories',
      title: 'Show for categories',
      type: 'array',
      description: 'Only used for Add-ons items — which menu categories show this add-on in the POS order panel. Leave empty to show for every category.',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Signature', value: 'signature' },
          { title: 'Espresso', value: 'espresso' },
          { title: 'Non-Coffee', value: 'non-coffee' },
          { title: 'Matcha Series', value: 'matcha-series' },
          { title: 'Meal', value: 'meal' },
          { title: 'Waffle', value: 'waffle' },
          { title: 'Snack', value: 'snack' },
        ],
      },
    }),
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
      name: 'hiddenFromPos',
      title: 'Hide from POS ordering',
      type: 'boolean',
      description: 'When enabled, this item is removed from the POS ordering grid but still appears on the customer-facing /menu page.',
      initialValue: false,
    }),
    defineField({
      name: 'featured',
      title: 'Featured on Homepage',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})
