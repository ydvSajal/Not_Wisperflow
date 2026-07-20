import { useEffect, useState } from 'react'
import type { StatsSummary } from '@shared/types'
import { Card } from '@/components/ui'
import { formatDuration } from '@/lib/format'

function StatTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/5 bg-surface p-4">
      <p className="text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-dim">{label}</p>
    </div>
  )
}

export function StatsPage(): React.JSX.Element | null {
  const [stats, setStats] = useState<StatsSummary | null>(null)

  useEffect(() => {
    const load = (): void => void window.api.getStats().then(setStats)
    load()
    return window.api.onDictationDone(load)
  }, [])

  if (!stats) return null

  const maxWords = Math.max(1, ...stats.daily.map((d) => d.words))

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="mb-5 text-lg font-semibold">Stats</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Words dictated" value={stats.totalWords.toLocaleString()} />
        <StatTile label="Dictations" value={stats.totalCount.toLocaleString()} />
        <StatTile label="Average WPM" value={String(stats.avgWpm)} />
        <StatTile label="Time speaking" value={formatDuration(stats.totalDurationMs)} />
        <StatTile label="Day streak" value={`${stats.streakDays}🔥`} />
      </div>
      <Card title="Last 30 days" subtitle="Words dictated per day" className="mt-6">
        <div className="flex h-40 items-end gap-[3px]">
          {stats.daily.map((d) => (
            <div
              key={d.day}
              className="group relative flex-1 rounded-t bg-accent/70 transition-colors hover:bg-accent"
              style={{ height: `${Math.max(2, (d.words / maxWords) * 100)}%` }}
              title={`${d.day}: ${d.words} words (${d.count} dictation${d.count === 1 ? '' : 's'})`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-ink-dim">
          <span>{stats.daily[0]?.day}</span>
          <span>{stats.daily[stats.daily.length - 1]?.day}</span>
        </div>
      </Card>
    </div>
  )
}
