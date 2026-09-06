import { defineField, defineType } from 'sanity'

export const saleDiscount = defineType({
  name: 'saleDiscount',
  title: 'Sale Discount',
  type: 'object',
  fields: [
    defineField({ name: 'lineId', title: 'Line ID', type: 'string' }),
    defineField({ name: 'name',   title: 'Name',    type: 'string' }),
    defineField({ name: 'amount', title: 'Amount',  type: 'number' }),
  ],
})
