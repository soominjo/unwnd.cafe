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
      name: 'price',
      title: 'Price',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Coffee', value: 'coffee' },
          { title: 'Tea', value: 'tea' },
          { title: 'Frappe', value: 'frappe' },
          { title: 'Non-Coffee', value: 'non-coffee' },
          { title: 'Soda Fizz', value: 'soda fizz' },
          { title: 'Signature Drink', value: 'signature drink' },
          { title: 'Waffle', value: 'waffle' },
          { title: 'Nachos', value: 'nachos' },
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
      name: 'drinkType',
      title: 'Drink Type',
      type: 'string',
      options: {
        list: [
          { title: 'Hot', value: 'hot' },
          { title: 'Iced', value: 'iced' },
          { title: 'Both', value: 'both' },
        ],
        layout: 'radio',
      },
    }),
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
