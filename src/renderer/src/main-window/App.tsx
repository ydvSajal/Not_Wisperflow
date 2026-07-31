import { useEffect, useState } from 'react'
import {
  AudioLines,
  BarChart3,
  History as HistoryIcon,
  NotebookPen,
  Settings as SettingsIcon
} from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { HistoryPage } from './pages/History'
import { NotesPage } from './pages/Notes'
import { StatsPage } from './pages/Stats'
import { SettingsPage } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { prettyHotkey } from '@/lib/format'

type Page = 'history' | 'notes' | 'stats' | 'settings'
type NavItem = { id: Page; label: string; icon: typeof HistoryIcon }

const NAV: NavItem[] = [
  { id: 'history', label: 'Dictation', icon: HistoryIcon },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'stats', label: 'Insights', icon: BarChart3 }
]
const NAV_FOOTER: NavItem[] = [{ id: 'settings', label: 'Settings', icon: SettingsIcon }]

const ENGINE_LABEL: Record<AppSettings['engine'], string> = {
  local: 'On-device',
  cloud: 'Cloud',
  sarvam: 'Sarvam'
}

function NavButton({
  item,
  active,
  onClick
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  const { label, icon: Icon } = item
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'border border-line bg-surface font-medium text-ink shadow-sm'
          : 'border border-transparent text-ink-dim hover:bg-surface/70 hover:text-ink'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {label}
    </button>
  )
}

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
    <div className="flex h-screen bg-canvas">
      {/* pt-11 clears the 40px native titlebar overlay drawn over the page */}
      <aside className="flex w-56 shrink-0 flex-col gap-1 px-3 pt-11 pb-4">
        <div className="flex items-center gap-2 px-2 py-3">
          <AudioLines className="h-5 w-5 text-accent" strokeWidth={2} />
          <span className="text-[15px] font-semibold tracking-tight">NotWhisperFlow</span>
          <span className="ml-auto rounded-full bg-accent-wash px-2 py-0.5 text-[11px] font-medium text-accent-strong">
            {ENGINE_LABEL[settings.engine]}
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => setPage(item.id)}
            />
          ))}
        </nav>
        <nav className="mt-auto flex flex-col gap-1">
          {NAV_FOOTER.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => setPage(item.id)}
            />
          ))}
        </nav>
        <div className="space-y-1 px-3 pt-3 text-[11px] text-ink-dim">
          <p>
            Dictate anywhere with{' '}
            <span className="font-medium text-ink">{prettyHotkey(settings.hotkey)}</span>
          </p>
          <p className="tnum">v{version}</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 pt-11 pr-2 pb-2">
        <div className="h-full overflow-y-auto rounded-2xl border border-line bg-surface">
          {page === 'history' && <HistoryPage />}
          {page === 'notes' && <NotesPage />}
          {page === 'stats' && <StatsPage />}
          {page === 'settings' && <SettingsPage settings={settings} onChange={setSettings} />}
        </div>
      </main>
    </div>
  )
}
