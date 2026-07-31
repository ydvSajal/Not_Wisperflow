import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Download, Loader2 } from 'lucide-react'
import type { LocalModelInfo, ModelDownloadProgress } from '@shared/types'
import { Button } from '@/components/ui'
import { useToast } from '@/components/Toast'

export function ModelList({
  selected,
  onSelect
}: {
  selected: string
  onSelect: (modelId: string) => void
}): React.JSX.Element {
  const [models, setModels] = useState<LocalModelInfo[]>([])
  const [progress, setProgress] = useState<Record<string, ModelDownloadProgress>>({})
  const toast = useToast()

  const refresh = (): void => void window.api.listModels().then(setModels)

  useEffect(() => {
    refresh()
    return window.api.onModelProgress((p) => {
      setProgress((prev) => ({ ...prev, [p.modelId]: p }))
      if (p.status === 'ready') refresh()
      if (p.status === 'error') toast(p.error ?? 'Model download failed', 'error')
    })
  }, [toast])

  const download = (modelId: string): void => {
    setProgress((prev) => ({
      ...prev,
      [modelId]: { modelId, percent: 0, status: 'downloading' }
    }))
    window.api.downloadModel(modelId).catch(() => undefined) // errors arrive via progress events
  }

  return (
    <ul className="space-y-2">
      {models.map((m) => {
        const p = progress[m.id]
        const downloading = p?.status === 'downloading'
        return (
          <li
            key={m.id}
            onClick={() => m.downloaded && onSelect(m.id)}
            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
              selected === m.id
                ? 'border-accent bg-accent/10'
                : 'border-line bg-surface-2'
            } ${m.downloaded ? 'cursor-pointer hover:border-accent/50' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{m.label}</p>
              <p className="text-xs text-ink-dim">
                {m.size}
                {selected === m.id && ' · active'}
              </p>
              {m.state === 'corrupt' && !downloading && (
                <p className="mt-1 text-xs text-amber-300">
                  Incomplete download — re-download to repair.
                </p>
              )}
              {downloading && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-surface-3">
                  <div
                    className="h-full bg-accent transition-[width]"
                    style={{ width: `${p.percent}%` }}
                  />
                </div>
              )}
            </div>
            {m.downloaded ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : downloading ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-ink-dim">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {p.percent}%
              </span>
            ) : (
              <Button variant="ghost" onClick={() => download(m.id)}>
                {m.state === 'corrupt' ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" /> Repair
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" /> Download
                  </>
                )}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
