import { defineField, defineType } from 'sanity'
import { ORDER_TYPES, ORDER_TYPE_LABELS } from '../../lib/sales/payments'

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
      name: 'orderType',
      title: 'Dine in or take out',
      description: 'Empty on orders from before it was asked.',
      type: 'string',
      options: {
        list: ORDER_TYPES.map(value => ({ title: ORDER_TYPE_LABELS[value], value })),
        layout: 'radio',
        direction: 'horizontal',
      },
    }),
    defineField({
      name: 'payments',
      title: 'How it was paid',
      description: 'One payment, or two for a split; items added later are paid with their own. Orders from before payments were recorded have none.',
      type: 'array',
      of: [{ type: 'salePayment' }],
    }),
    defineField({
      name: 'subtotal',
      title: 'Subtotal before discounts (₱)',
      type: 'number',
    }),
    defineField({
      name: 'discounts',
      title: 'Discounts',
      type: 'array',
      of: [{ type: 'saleDiscount' }],
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
    defineField({
      name: 'loyaltyMemberId',
      title: 'Loyalty card holder',
      description: 'The _id of the loyaltyMember this order was linked to at checkout.',
      type: 'string',
    }),
    defineField({
      name: 'loyaltyRewards',
      title: 'Loyalty rewards used',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: [{ title: '10% off', value: 'ten' }, { title: 'Free drink', value: 'free' }] },
    }),
    defineField({
      name: 'isCompleted',
      title: 'Completed',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: { total: 'total' },
    prepare({ total }) {
      return { title: `₱${total}` }
    },
  },
})
