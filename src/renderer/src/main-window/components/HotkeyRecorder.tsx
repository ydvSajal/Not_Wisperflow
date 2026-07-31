import { useEffect, useRef, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { prettyHotkey } from '@/lib/format'
import { useToast } from '@/components/Toast'

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])

function toAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  if (parts.length === 0) return null // require at least one modifier

  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.startsWith('Arrow')) key = key.slice(5)
  else if (key.length === 1) key = key.toUpperCase()
  else if (!/^(F\d{1,2}|Space|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Enter)$/.test(key)) {
    return null
  }
  parts.push(key)
  return parts.join('+')
}

export function HotkeyRecorder({
  value,
  onSave
}: {
  value: string
  onSave: (accelerator: string) => void
}): React.JSX.Element {
  const [capturing, setCapturing] = useState(false)
  const toast = useToast()
  const capturingRef = useRef(capturing)
  capturingRef.current = capturing

  useEffect(() => {
    if (!capturing) return
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturing(false)
        return
      }
      const accelerator = toAccelerator(e)
      if (!accelerator) return
      void window.api.validateHotkey(accelerator).then((result) => {
        if (!capturingRef.current) return
        if (result.ok) {
          onSave(accelerator)
          setCapturing(false)
        } else {
          toast(result.reason ?? 'That shortcut cannot be used', 'error')
        }
      })
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [capturing, onSave, toast])

  return (
    <button
      type="button"
      onClick={() => setCapturing((c) => !c)}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
        capturing
          ? 'border-accent bg-accent/10 text-accent-strong'
          : 'border-line bg-surface-2 text-ink hover:border-ink-dim'
      }`}
    >
      <Keyboard className="h-4 w-4" />
      {capturing ? 'Press a key combo… (Esc to cancel)' : prettyHotkey(value)}
    </button>
  )
}
