import { defineField, defineType } from 'sanity'

export const sale = defineType({
  name: 'sale',
  title: 'Sale',
  type: 'document',
  fields: [
    defineField({
      name: 'total',
      title: 'Total (₱)',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'paymentAmount',
      title: 'Payment Amount (₱)',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'change',
      title: 'Change (₱)',
      type: 'number',
    }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      of: [{ type: 'saleItem' }],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'string',
    }),
  ],
  preview: {
    select: { total: 'total' },
    prepare({ total }) {
      return { title: `₱${total}` }
    },
  },
})
