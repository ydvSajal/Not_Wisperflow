import { useEffect, useState } from 'react'
import type { StatsSummary } from '@shared/types'

/** Live stats summary, refreshed whenever a dictation completes. */
export function useStats(): StatsSummary | null {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  useEffect(() => {
    const load = (): void => void window.api.getStats().then(setStats)
    load()
    return window.api.onDictationDone(load)
  }, [])
  return stats
}
