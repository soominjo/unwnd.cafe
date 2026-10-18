'use client'

import { useEffect } from 'react'
import { watchIdle } from './watchIdle'

/** Manager mode, on the POS and on the Manager page, locks itself after this long with no tap or key press. */
export const MANAGER_IDLE_LOCK_MS = 2 * 60 * 1000

/**
 * While `active`, calls `lock` after `ms` with no tap or key press, or as soon as the screen goes
 * off or another app comes forward, so an unlocked screen is never left behind. `lock` should be
 * stable (useCallback).
 */
export function useIdleLock(active: boolean, lock: () => void, ms: number = MANAGER_IDLE_LOCK_MS): void {
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
