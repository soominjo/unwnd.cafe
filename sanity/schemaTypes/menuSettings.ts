import { defineField, defineType } from 'sanity'

export const menuSettings = defineType({
  name: 'menuSettings',
  title: 'Menu Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'hiddenItemIds',
      title: 'Hidden Built-In Item IDs',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Built-in menu item IDs hidden via the POS.',
    }),
    defineField({
      name: 'categoryOrder',
      title: 'Category Order',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Category ids in display order, set by dragging category tabs in the POS.',
    }),
  ],
})
