import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, FileAudio, Loader2, Search, Trash2 } from 'lucide-react'
import type { TranscriptionRecord } from '@shared/types'
import { Button, Input } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { formatDuration, timeAgo } from '@/lib/format'
import { decodeAudioFile } from '@/lib/audio-import'
import { AppendToNote } from '../components/AppendToNote'

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
      className="mx-auto max-w-3xl px-8 py-8"
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
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">History</h1>
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {importing}
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
      {dragOver && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-accent bg-accent/10 p-6 text-center text-sm text-accent-soft">
          Drop audio files to transcribe them
        </div>
      )}
      <div className="relative mb-4">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-ink-dim" />
        <Input
          className="pl-9"
          placeholder="Search dictations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {records.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink-dim">
          {search ? 'No dictations match your search.' : 'No dictations yet. Press your hotkey and start talking.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li key={r.id} className="group rounded-xl border border-white/5 bg-surface p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink select-text">
                {r.text}
              </p>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-dim">
                <span>{timeAgo(r.createdAt)}</span>
                <span>{r.words} words</span>
                <span>{r.wpm} WPM</span>
                <span>{formatDuration(r.durationMs)}</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5">{r.engine}</span>
                <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                    className="rounded p-1.5 text-red-400 hover:bg-surface-3"
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
  )
}
