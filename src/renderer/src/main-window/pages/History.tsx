import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, FileAudio, Loader2, Mic, Search, Trash2 } from 'lucide-react'
import type { TranscriptionRecord } from '@shared/types'
import { Button, Input } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { formatDuration, timeAgo } from '@/lib/format'
import { decodeAudioFile } from '@/lib/audio-import'
import { useStats } from '@/lib/use-stats'
import { AppendToNote } from '../components/AppendToNote'

function StatsRail(): React.JSX.Element | null {
  const stats = useStats()
  if (!stats) return null
  const rows = [
    { value: stats.totalWords.toLocaleString(), label: 'total words' },
    { value: String(stats.avgWpm), label: 'average wpm' },
    { value: String(stats.streakDays), label: 'day streak' }
  ]
  return (
    <aside className="hidden w-64 shrink-0 xl:block">
      <div className="rounded-2xl bg-surface-2 p-5">
        <dl className="space-y-3">
          {rows.map(({ value, label }) => (
            <div key={label} className="flex items-baseline gap-2">
              <dd className="tnum text-2xl leading-none font-semibold tracking-tight text-ink">
                {value}
              </dd>
              <dt className="text-sm text-ink-dim">{label}</dt>
            </div>
          ))}
        </dl>
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-medium text-ink">Time spoken</p>
          <p className="tnum mt-1 text-sm leading-relaxed text-ink-dim">
            {formatDuration(stats.totalDurationMs)} across {stats.totalCount.toLocaleString()}{' '}
            dictations
          </p>
        </div>
      </div>
    </aside>
  )
}

function EmptyState({ searching }: { searching: boolean }): React.JSX.Element {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
        {searching ? (
          <Search className="h-5 w-5 text-ink-dim" strokeWidth={1.75} />
        ) : (
          <Mic className="h-5 w-5 text-ink-dim" strokeWidth={1.75} />
        )}
      </div>
      <h2 className="mt-4 text-base font-semibold text-ink">
        {searching ? 'No matches' : 'No dictations yet'}
      </h2>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-ink-dim">
        {searching
          ? 'Try a different word, or clear the search to see everything.'
          : 'Press your hotkey anywhere and start talking. Everything you dictate lands here.'}
      </p>
    </div>
  )
}

export function HistoryPage(): React.JSX.Element {
  const [records, setRecords] = useState<TranscriptionRecord[]>([])
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const load = useCallback((query: string) => {
    void window.api.listHistory({ search: query || undefined, limit: 200 }).then(setRecords)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 200)
    return () => clearTimeout(t)
  }, [search, load])

  useEffect(() => window.api.onDictationDone(() => load(search)), [load, search])

  const copy = (text: string): void => {
    void window.api.copyText(text)
    toast('Copied to clipboard', 'success')
  }

  const remove = (id: number): void => {
    void window.api.deleteHistory(id).then(() => load(search))
  }

  const clearAll = (): void => {
    if (!window.confirm('Delete ALL dictation history? This cannot be undone.')) return
    void window.api.clearHistory().then(() => load(search))
  }

  const importFiles = async (files: FileList | File[]): Promise<void> => {
    for (const file of Array.from(files)) {
      setImporting(file.name)
      try {
        const { pcm, durationMs } = await decodeAudioFile(file)
        await window.api.importAudio(pcm, durationMs)
        toast(`Transcribed “${file.name}”`, 'success')
      } catch (err) {
        toast(err instanceof Error ? err.message.replace(/^.*Error: /, '') : 'Import failed', 'error')
      }
    }
    setImporting(null)
    load(search)
  }

  return (
    <div
      className="px-7 py-6"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files)
      }}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dictation</h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void importFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing !== null}
          >
            {importing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="max-w-40 truncate">{importing}</span>
              </>
            ) : (
              <>
                <FileAudio className="h-3.5 w-3.5" /> Import audio
              </>
            )}
          </Button>
          {records.length > 0 && (
            <Button variant="ghost" onClick={clearAll}>
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          {dragOver && (
            <div className="mb-4 rounded-2xl border-2 border-dashed border-accent bg-accent-wash p-6 text-center text-sm font-medium text-accent-strong">
              Drop audio files to transcribe them
            </div>
          )}
          <div className="relative mb-2">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-ink-dim" strokeWidth={1.75} />
            <Input
              className="pl-9"
              placeholder="Search dictations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {records.length === 0 ? (
            <EmptyState searching={search.length > 0} />
          ) : (
            <ul className="divide-y divide-line">
              {records.map((r) => (
                <li key={r.id} className="group py-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink select-text">
                    {r.text}
                  </p>
                  <div className="tnum mt-2 flex items-center gap-3 text-[11px] text-ink-dim">
                    <span>{timeAgo(r.createdAt)}</span>
                    <span>{r.words} words</span>
                    <span>{r.wpm} WPM</span>
                    <span>{formatDuration(r.durationMs)}</span>
                    <span className="rounded bg-surface-3 px-1.5 py-0.5">{r.engine}</span>
                    <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <AppendToNote text={r.text} />
                      <button
                        onClick={() => copy(r.text)}
                        className="rounded p-1.5 hover:bg-surface-3"
                        title="Copy"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        className="rounded p-1.5 text-red-600 hover:bg-surface-3"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <StatsRail />
      </div>
    </div>
  )
}
