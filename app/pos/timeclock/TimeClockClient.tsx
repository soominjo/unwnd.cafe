'use client'

import { useState } from 'react'
import { formatLongDay } from '@/lib/timeclock/time'
import { PageHeader, PageTabs } from '../PageChrome'
import ClockView from './ClockView'
import MyRecordsView from './MyRecordsView'
import { useNow } from './useNow'

type Tab = 'clock' | 'records'

const TABS = [
  { key: 'clock', label: 'Clock in or out' },
  { key: 'records', label: 'My records' },
] as const

// The Time clock page, opened from the POS header. Staff clock in or out on their own name with
// their own PIN, or see their own records under My records. Nothing here needs the manager PIN,
// and nothing here shows anyone else's records: those are on the Manager page.
export default function TimeClockClient() {
  const now = useNow()
  const [tab, setTab] = useState<Tab>('clock')
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader title="unwnd. time clock" note={formatLongDay(now)} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <PageTabs label="Time clock" tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'clock' ? <ClockView now={now} /> : <MyRecordsView now={now} />}
      </main>
    </div>
  )
}
