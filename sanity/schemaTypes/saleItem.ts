import { defineField, defineType } from 'sanity'

export const saleItem = defineType({
  name: 'saleItem',
  title: 'Sale Item',
  type: 'object',
  fields: [
    defineField({ name: 'lineId',  title: 'Line ID',  type: 'string' }),
    defineField({ name: 'name',    title: 'Name',     type: 'string' }),
    defineField({ name: 'variant', title: 'Variant',  type: 'string' }),
    defineField({ name: 'price',   title: 'Price',    type: 'number' }),
    defineField({ name: 'qty',     title: 'Qty',      type: 'number' }),
  ],
})
