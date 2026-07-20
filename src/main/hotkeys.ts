import { globalShortcut } from 'electron'

/**
 * Owns global shortcut registrations. The main toggle comes from settings and
 * is re-applied whenever settings change; Escape is registered only while
 * a recording is active so it can cancel without swallowing Esc system-wide.
 */
export class HotkeyManager {
  private current = ''
  private escapeRegistered = false

  constructor(
    private onToggle: () => void,
    private onCancel: () => void
  ) {}

  apply(accelerator: string): { ok: boolean; reason?: string } {
    if (process.env['WHISPRFLOW_NO_HOTKEY']) return { ok: true }
    if (this.current) {
      globalShortcut.unregister(this.current)
      this.current = ''
    }
    try {
      const ok = globalShortcut.register(accelerator, this.onToggle)
      if (!ok) return { ok: false, reason: 'Shortcut is already in use by another app' }
      this.current = accelerator
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Invalid shortcut' }
    }
  }

  /** Test-register an accelerator without keeping it. */
  validate(accelerator: string): { ok: boolean; reason?: string } {
    if (accelerator === this.current) return { ok: true }
    try {
      const ok = globalShortcut.register(accelerator, () => undefined)
      if (ok) globalShortcut.unregister(accelerator)
      return ok ? { ok: true } : { ok: false, reason: 'Shortcut is already in use by another app' }
    } catch {
      return { ok: false, reason: 'Not a valid shortcut' }
    }
  }

  holdEscape(): void {
    if (this.escapeRegistered || process.env['WHISPRFLOW_NO_HOTKEY']) return
    this.escapeRegistered = globalShortcut.register('Escape', this.onCancel)
  }

  releaseEscape(): void {
    if (!this.escapeRegistered) return
    globalShortcut.unregister('Escape')
    this.escapeRegistered = false
  }

  dispose(): void {
    globalShortcut.unregisterAll()
  }
}
