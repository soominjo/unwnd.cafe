import { defineField, defineType } from 'sanity'

// Someone on the POS time clock. Removing them on the POS only turns `active` off, so their
// shifts keep pointing at a real document. The PIN is kept only as a keyed fingerprint (see
// lib/timeclock/pins.ts), set from the Manager page.
export const staffMember = defineType({
  name: 'staffMember',
  title: 'Staff member',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required().min(2).max(60),
    }),
    defineField({
      name: 'active',
      title: 'On the time clock',
      description: 'Turned off when they are removed on the POS. Their shifts stay.',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'pinHash',
      title: 'PIN fingerprint',
      description: 'Set or changed on the POS Manager page. Not the PIN itself.',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
  ],
  preview: {
    select: { name: 'name', active: 'active' },
    prepare({ name, active }) {
      return { title: name, subtitle: active === false ? 'Removed' : 'On the time clock' }
    },
  },
})
