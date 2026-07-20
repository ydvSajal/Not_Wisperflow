import { useEffect, useState } from 'react'
import { AudioLines, BarChart3, History as HistoryIcon, Settings as SettingsIcon } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { HistoryPage } from './pages/History'
import { StatsPage } from './pages/Stats'
import { SettingsPage } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { prettyHotkey } from '@/lib/format'

type Page = 'history' | 'stats' | 'settings'

const NAV: { id: Page; label: string; icon: typeof HistoryIcon }[] = [
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon }
]

export function App(): React.JSX.Element | null {
  const [page, setPage] = useState<Page>('history')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
    void window.api.appVersion().then(setVersion)
    return window.api.onSettingsChanged(setSettings)
  }, [])

  if (!settings) return null

  if (!settings.onboarded) {
    return <Onboarding settings={settings} onDone={setSettings} />
  }

  return (
    <div className="flex h-screen">
      <aside className="flex w-52 shrink-0 flex-col border-r border-white/5 bg-surface">
        <div className="flex items-center gap-2 px-5 py-5">
          <AudioLines className="h-5 w-5 text-accent" />
          <span className="text-base font-semibold tracking-tight">WhisprFlow</span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                page === id ? 'bg-accent/15 text-accent-soft' : 'text-ink-dim hover:bg-surface-2'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-1 px-5 py-4 text-[11px] text-ink-dim">
          <p>
            Dictate anywhere: <span className="text-ink">{prettyHotkey(settings.hotkey)}</span>
          </p>
          <p>v{version}</p>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {page === 'history' && <HistoryPage />}
        {page === 'stats' && <StatsPage />}
        {page === 'settings' && <SettingsPage settings={settings} onChange={setSettings} />}
      </main>
    </div>
  )
}
