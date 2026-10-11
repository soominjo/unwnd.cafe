import { defineField, defineType } from 'sanity'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../../lib/sales/payments'

const METHOD_LIST = PAYMENT_METHODS.map(value => ({ title: PAYMENT_METHOD_LABELS[value], value }))

export const salePayment = defineType({
  name: 'salePayment',
  title: 'Payment',
  type: 'object',
  fields: [
    defineField({ name: 'method', title: 'Method', type: 'string', options: { list: METHOD_LIST } }),
    defineField({ name: 'amount', title: 'Amount (₱)', description: 'The part of the order this payment covers.', type: 'number' }),
    defineField({
      name: 'received',
      title: 'Cash received (₱)',
      description: 'Cash only: what the customer handed over. The change is the difference.',
      type: 'number',
    }),
    defineField({
      name: 'addedAt',
      title: 'Paid for items added later',
      description: 'When this payment was taken for items added to the order after it was first saved. Empty for the first checkout.',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'movedFrom',
      title: 'Taken as',
      description: 'Set when the payment was moved to another method on Sales: the method it was taken as. Empty when never moved, or moved back.',
      type: 'string',
      options: { list: METHOD_LIST },
      readOnly: true,
    }),
    defineField({
      name: 'movedAt',
      title: 'Moved at',
      description: 'When the payment last moved to another method on Sales.',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'receivedBefore',
      title: 'Cash received before the move (₱)',
      description: 'Taken as cash, then moved: what the customer handed over. Given back if the payment moves back to cash.',
      type: 'number',
      readOnly: true,
    }),
  ],
  preview: {
    select: { method: 'method', amount: 'amount' },
    prepare({ method, amount }) {
      const label = METHOD_LIST.find(m => m.value === method)?.title ?? 'Payment'
      return { title: `${label} ₱${amount ?? 0}` }
    },
  },
})
