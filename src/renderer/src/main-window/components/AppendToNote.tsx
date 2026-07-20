import { useEffect, useRef, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import type { Note } from '@shared/types'
import { useToast } from '@/components/Toast'

/** Small popover on a history row: pick a note (or create one) to append the text to. */
export function AppendToNote({ text }: { text: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const ref = useRef<HTMLSpanElement>(null)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    void window.api.listNotes().then(setNotes)
    const close = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const append = async (noteId: number, title: string): Promise<void> => {
    await window.api.appendToNote(noteId, text)
    setOpen(false)
    toast(`Appended to “${title}”`, 'success')
  }

  const appendToNew = async (): Promise<void> => {
    const note = await window.api.createNote(`Note ${new Date().toLocaleDateString()}`)
    await append(note.id, note.title)
  }

  return (
    <span className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1.5 hover:bg-surface-3"
        title="Append to note"
      >
        <NotebookPen className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-20 mb-1 w-52 rounded-lg border border-white/10 bg-surface-2 p-1 shadow-xl">
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => void append(n.id, n.title)}
              className="block w-full truncate rounded px-2.5 py-1.5 text-left text-xs text-ink hover:bg-surface-3"
            >
              {n.title}
            </button>
          ))}
          <button
            onClick={() => void appendToNew()}
            className="block w-full rounded px-2.5 py-1.5 text-left text-xs text-accent-soft hover:bg-surface-3"
          >
            + New note
          </button>
        </div>
      )}
    </span>
  )
}
