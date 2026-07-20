import type { BarState, DictationMode, DictationPhase, TranscriptionRecord } from '@shared/types'
import { EVT } from '@shared/ipc-channels'
import { settings } from './settings'
import { transcribe } from './transcription'
import { cleanupText, translateText } from './cleanup'
import { applyReplacements, insertTranscription } from './db'
import { pasteText } from './paste'
import { getBarWindow, getMainWindow, hideBar, showBar } from './windows'

const RESULT_VISIBLE_MS = 2200
const ERROR_VISIBLE_MS = 3200
/** Safety cap so a forgotten recording cannot grow unbounded */
const MAX_RECORDING_MS = 5 * 60 * 1000

/**
 * The dictation state machine, driven by the global hotkey:
 * idle -> recording (bar shows, mic on) -> transcribing -> result/error -> idle
 */
export class DictationController {
  private phase: DictationPhase = 'idle'
  private mode: DictationMode = 'dictate'
  private startedAt = 0
  private session = 0
  private hideTimer: NodeJS.Timeout | null = null
  private maxTimer: NodeJS.Timeout | null = null

  constructor(
    private hooks: { onRecordingStart: () => void; onRecordingEnd: () => void }
  ) {}

  private setBar(state: BarState): void {
    getBarWindow()?.webContents.send(EVT.barState, state)
  }

  private clearTimers(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer)
    if (this.maxTimer) clearTimeout(this.maxTimer)
    this.hideTimer = null
    this.maxTimer = null
  }

  toggle(mode: DictationMode = 'dictate'): void {
    if (this.phase === 'idle' || this.phase === 'result' || this.phase === 'error') {
      this.startRecording(mode)
    } else if (this.phase === 'recording') {
      this.stopRecording()
    }
    // 'transcribing': ignore extra presses
  }

  private startRecording(mode: DictationMode): void {
    this.clearTimers()
    this.session++
    this.phase = 'recording'
    this.mode = mode
    this.startedAt = Date.now()
    showBar()
    this.setBar({ phase: 'recording', mode, startedAt: this.startedAt })
    getBarWindow()?.webContents.send(EVT.captureStart)
    this.hooks.onRecordingStart()
    this.maxTimer = setTimeout(() => this.stopRecording(), MAX_RECORDING_MS)
  }

  private stopRecording(): void {
    if (this.phase !== 'recording') return
    this.phase = 'transcribing'
    this.setBar({ phase: 'transcribing', mode: this.mode })
    getBarWindow()?.webContents.send(EVT.captureStop, { discard: false })
    this.hooks.onRecordingEnd()
    if (this.maxTimer) clearTimeout(this.maxTimer)
  }

  cancel(): void {
    if (this.phase !== 'recording' && this.phase !== 'transcribing') return
    this.session++ // invalidate any in-flight audio/result
    getBarWindow()?.webContents.send(EVT.captureStop, { discard: true })
    this.hooks.onRecordingEnd()
    this.toIdle()
  }

  private toIdle(): void {
    this.clearTimers()
    this.phase = 'idle'
    hideBar()
  }

  /** Called by the bar renderer with the captured PCM once recording stops. */
  async onAudio(pcm: Float32Array, durationMs: number): Promise<void> {
    const session = this.session
    if (this.phase !== 'transcribing') return
    const cfg = settings.get()
    try {
      const result = await transcribe({ pcm, language: cfg.language }, cfg)
      if (session !== this.session) return // cancelled while transcribing
      const raw = result.text
      if (!raw) {
        this.showError('No speech detected')
        return
      }
      const processed =
        this.mode === 'translate'
          ? await translateText(raw, cfg.translateTarget, cfg.cleanup)
          : await cleanupText(raw, cfg.cleanup)
      if (session !== this.session) return
      const text = applyReplacements(processed)
      const record = insertTranscription({
        text,
        rawText: raw,
        durationMs,
        engine: result.engine,
        model: result.model
      })
      const pasted = await pasteText(text, {
        autoPaste: cfg.autoPaste,
        restoreClipboard: cfg.restoreClipboard
      })
      this.phase = 'result'
      this.setBar({
        phase: 'result',
        transcript: pasted ? text : `${text}\n(copied to clipboard — paste manually)`
      })
      getMainWindow()?.webContents.send(EVT.dictationDone, { text, record })
      this.hideTimer = setTimeout(() => this.toIdle(), RESULT_VISIBLE_MS)
    } catch (err) {
      if (session !== this.session) return
      this.showError(err instanceof Error ? err.message : String(err))
    }
  }

  /** Bar could not record (mic permission denied, no device, ...) */
  onCaptureError(message: string): void {
    this.hooks.onRecordingEnd()
    this.showError(message)
  }

  private showError(message: string): void {
    this.phase = 'error'
    this.setBar({ phase: 'error', error: message })
    this.hideTimer = setTimeout(() => this.toIdle(), ERROR_VISIBLE_MS)
  }
}

/**
 * Transcribe an imported audio file into history. Shares the dictation
 * post-processing (cleanup + replacements) but never pastes or touches the bar.
 */
export async function importAudio(
  pcm: Float32Array,
  durationMs: number
): Promise<TranscriptionRecord> {
  const cfg = settings.get()
  const result = await transcribe({ pcm, language: cfg.language }, cfg)
  if (!result.text) throw new Error('No speech detected in this file')
  const cleaned = await cleanupText(result.text, cfg.cleanup)
  const text = applyReplacements(cleaned)
  const record = insertTranscription({
    text,
    rawText: result.text,
    durationMs,
    engine: result.engine,
    model: result.model
  })
  getMainWindow()?.webContents.send(EVT.dictationDone, { text, record })
  return record
}
