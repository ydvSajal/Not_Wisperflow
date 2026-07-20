import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Replacement } from '@shared/types'
import { Button, Card, Input } from '@/components/ui'
import { useToast } from '@/components/Toast'

export function DictionaryCard(): React.JSX.Element {
  const [rows, setRows] = useState<Replacement[]>([])
  const [pattern, setPattern] = useState('')
  const [replacement, setReplacement] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const toast = useToast()

  const refresh = (): void => void window.api.listReplacements().then(setRows)
  useEffect(refresh, [])

  const add = async (): Promise<void> => {
    try {
      await window.api.addReplacement({ pattern, replacement, isRegex })
      setPattern('')
      setReplacement('')
      setIsRegex(false)
      refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message.replace(/^.*Error: /, '') : 'Could not add entry', 'error')
    }
  }

  const remove = (id: number): void => {
    void window.api.deleteReplacement(id).then(refresh)
  }

  return (
    <Card
      title="Dictionary"
      subtitle="Fix words Whisper keeps getting wrong — replacements are applied to every dictation (case-insensitive)."
    >
      {rows.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-sm"
            >
              <code className="text-ink-dim">{r.pattern}</code>
              <span className="text-ink-dim">→</span>
              <span className="text-ink">{r.replacement}</span>
              {r.isRegex && (
                <span className="rounded bg-surface-3 px-1.5 text-[10px] text-ink-dim">regex</span>
              )}
              <button
                onClick={() => remove(r.id)}
                className="ml-auto rounded p-1 text-red-400 hover:bg-surface-3"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-44"
          placeholder="heard as… (e.g. agen pay)"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />
        <span className="text-ink-dim">→</span>
        <Input
          className="max-w-44"
          placeholder="replace with (e.g. AgenPay)"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-xs text-ink-dim">
          <input
            type="checkbox"
            checked={isRegex}
            onChange={(e) => setIsRegex(e.target.checked)}
          />
          regex
        </label>
        <Button variant="ghost" onClick={() => void add()} disabled={!pattern}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </Card>
  )
}
