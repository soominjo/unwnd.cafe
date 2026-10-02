import { defineField, defineType } from 'sanity'

// A customer the owner has handed a loyalty card. Stamps are not stored here: they are
// counted from the sales linked to this card holder (sale.loyaltyMemberId).
export const loyaltyMember = defineType({
  name: 'loyaltyMember',
  title: 'Loyalty card holder',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name on the card',
      type: 'string',
      validation: (rule) => rule.required().min(2).max(60),
    }),
    defineField({
      name: 'cardNumber',
      title: 'Card number',
      description: 'Given by the POS when the card is handed out, and never reused. Written on the physical card; tells apart card holders with the same name.',
      type: 'number',
      readOnly: true,
      validation: (rule) => rule.required().integer().min(1),
    }),
  ],
  preview: {
    select: { name: 'name', cardNumber: 'cardNumber' },
    prepare({ name, cardNumber }) {
      return { title: `No. ${cardNumber} · ${name}` }
    },
  },
})
