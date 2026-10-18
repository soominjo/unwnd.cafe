import { defineField, defineType } from 'sanity'

// One shift on the POS time clock. The server stamps the time in and the time out; a manager's
// fix on the POS sets editedAt, which staff see as "Edited".
export const timeShift = defineType({
  name: 'timeShift',
  title: 'Time clock shift',
  type: 'document',
  fields: [
    defineField({ name: 'staffId', title: 'Staff member ID', type: 'string', readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: 'staffName', title: 'Name when they clocked in', type: 'string', readOnly: true }),
    defineField({ name: 'clockIn', title: 'Clocked in', type: 'datetime', validation: (rule) => rule.required() }),
    defineField({ name: 'clockOut', title: 'Clocked out', description: 'Empty while they are on shift.', type: 'datetime' }),
    defineField({ name: 'editedAt', title: 'Changed by a manager', type: 'datetime', readOnly: true }),
  ],
  orderings: [{ title: 'Newest first', name: 'clockInDesc', by: [{ field: 'clockIn', direction: 'desc' }] }],
  preview: {
    select: { staffName: 'staffName', clockIn: 'clockIn', clockOut: 'clockOut' },
    prepare({ staffName, clockIn, clockOut }) {
      const when = (iso?: string) =>
        iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
      return { title: staffName ?? 'Shift', subtitle: clockOut ? `${when(clockIn)} – ${when(clockOut)}` : `${when(clockIn)} · on shift` }
    },
  },
})
