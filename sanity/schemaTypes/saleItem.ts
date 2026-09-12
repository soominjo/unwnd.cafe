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
    defineField({ name: 'note',    title: 'Note',     type: 'string' }),
    defineField({ name: 'isAddon', title: 'Is Add-on', type: 'boolean' }),
    defineField({ name: 'parentLineId', title: 'Parent Line ID', type: 'string' }),
  ],
})
