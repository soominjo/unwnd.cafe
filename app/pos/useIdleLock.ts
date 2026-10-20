'use client'

import { useEffect } from 'react'
import { watchIdle } from './watchIdle'

/**
 * While `active`, calls `lock` after `ms` with no tap or key press, or as soon as the screen goes
 * off or another app comes forward, so an unlocked screen is never left behind. `lock` should be
 * stable (useCallback).
 */
export function useIdleLock(active: boolean, lock: () => void, ms: number): void {
  useEffect(() => {
    if (!active) return
    const stopWatching = watchIdle(window, ms, lock)
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') lock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopWatching()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [active, lock, ms])
}
