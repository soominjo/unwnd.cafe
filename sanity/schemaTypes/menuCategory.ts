import { defineField, defineType } from 'sanity'

export const menuCategory = defineType({
  name: 'menuCategory',
  title: 'Menu Category',
  type: 'document',
  fields: [
    defineField({
      name: 'id',
      title: 'ID (slug)',
      type: 'string',
      description: 'URL-safe lowercase key used in code (e.g. frappe, soda-fizz)',
      validation: (rule) => rule.required().regex(/^[a-z0-9-]+$/, { name: 'slug' }),
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'Display name shown in POS tabs and on the menu page',
      validation: (rule) => rule.required().max(40),
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { title: 'Drink', value: 'drink' },
          { title: 'Food', value: 'food' },
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Lower numbers appear first among tabs that have no place in the order set by dragging tabs on the POS.',
      initialValue: 99,
      validation: (rule) => rule.required().min(0),
    }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'type' },
  },
})
