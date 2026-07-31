import { Card } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import { useStats } from '@/lib/use-stats'

function StatTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <p className="tnum text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-dim">{label}</p>
    </div>
  )
}

export function StatsPage(): React.JSX.Element | null {
  const stats = useStats()
  if (!stats) return null

  const maxWords = Math.max(1, ...stats.daily.map((d) => d.words))

  return (
    <div className="px-7 py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Insights</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Words dictated" value={stats.totalWords.toLocaleString()} />
        <StatTile label="Dictations" value={stats.totalCount.toLocaleString()} />
        <StatTile label="Average WPM" value={String(stats.avgWpm)} />
        <StatTile label="Time speaking" value={formatDuration(stats.totalDurationMs)} />
        <StatTile label="Day streak" value={String(stats.streakDays)} />
      </div>
      <Card title="Last 30 days" subtitle="Words dictated per day" className="mt-6">
        <div className="flex h-40 items-end gap-[3px]">
          {stats.daily.map((d) => (
            <div
              key={d.day}
              className="flex-1 rounded-t bg-accent/60 transition-colors hover:bg-accent"
              style={{ height: `${Math.max(2, (d.words / maxWords) * 100)}%` }}
              title={`${d.day}: ${d.words} words (${d.count} dictation${d.count === 1 ? '' : 's'})`}
            />
          ))}
        </div>
        <div className="tnum mt-2 flex justify-between text-[10px] text-ink-dim">
          <span>{stats.daily[0]?.day}</span>
          <span>{stats.daily[stats.daily.length - 1]?.day}</span>
        </div>
      </Card>
    </div>
  )
}
