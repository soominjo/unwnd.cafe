'use client'

import { useEffect, useState } from 'react'

/** The time now, updated every `everyMs` while the component is on screen. Drives the running timers. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}
