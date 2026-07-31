import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import type { Note } from '@shared/types'
import { Button, Input } from '@/components/ui'
import { timeAgo } from '@/lib/format'

export function NotesPage(): React.JSX.Element {
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = notes.find((n) => n.id === activeId) ?? null

  const load = useCallback((query: string) => {
    void window.api.listNotes(query || undefined).then(setNotes)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 200)
    return () => clearTimeout(t)
  }, [search, load])

  // Switching notes: hydrate the editor
  useEffect(() => {
    if (active) {
      setTitle(active.title)
      setBody(active.body)
    }
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = (nextTitle: string, nextBody: string): void => {
    if (!activeId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void window.api
        .updateNote(activeId, { title: nextTitle, body: nextBody })
        .then(() => load(search))
    }, 500)
  }

  const create = async (): Promise<void> => {
    const note = await window.api.createNote('Untitled note')
    load(search)
    setActiveId(note.id)
  }

  const remove = async (id: number): Promise<void> => {
    if (!window.confirm('Delete this note?')) return
    await window.api.deleteNote(id)
    if (activeId === id) setActiveId(null)
    load(search)
  }

  return (
    <div className="flex h-full">
      <div className="flex w-64 shrink-0 flex-col border-r border-line bg-surface-2">
        <div className="flex items-center gap-2 p-3">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-ink-dim" />
            <Input
              className="pl-8 text-xs"
              placeholder="Search notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="ghost" onClick={() => void create()} title="New note">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {notes.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-ink-dim">
              No notes yet. Create one, or append a dictation from History.
            </p>
          )}
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => setActiveId(n.id)}
              className={`group mb-1 block w-full rounded-lg px-3 py-2 text-left transition-colors ${
                n.id === activeId ? 'bg-accent/15' : 'hover:bg-surface-2'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-ink">{n.title}</span>
                <Trash2
                  className="h-3.5 w-3.5 shrink-0 text-red-400 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    void remove(n.id)
                  }}
                />
              </span>
              <span className="block truncate text-xs text-ink-dim">
                {timeAgo(n.updatedAt)}
                {n.body ? ` · ${n.body.slice(0, 60)}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        {active ? (
          <>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                scheduleSave(e.target.value, body)
              }}
              className="border-b border-line bg-transparent px-6 py-4 text-lg font-semibold text-ink focus:outline-none"
              placeholder="Note title"
            />
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                scheduleSave(title, e.target.value)
              }}
              className="flex-1 resize-none bg-transparent px-6 py-4 text-sm leading-relaxed text-ink select-text focus:outline-none"
              placeholder="Write, or append dictations from the History page…"
            />
          </>
        ) : (
          <p className="m-auto text-sm text-ink-dim">Select a note or create one</p>
        )}
      </div>
    </div>
  )
}
