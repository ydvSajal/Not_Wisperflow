import type {
  AppSettings,
  BarState,
  DictationResult,
  HistoryQuery,
  LocalModelInfo,
  ModelDownloadProgress,
  StatsSummary,
  TranscriptionRecord
} from './types'

/** Typed surface exposed by the preload script as window.api */
export interface WhisprApi {
  getSettings(): Promise<AppSettings>
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  validateHotkey(accelerator: string): Promise<{ ok: boolean; reason?: string }>

  toggleDictation(): Promise<void>
  cancelDictation(): Promise<void>
  /** Bar window only: deliver captured PCM (16kHz mono) and its duration */
  sendAudio(pcm: Float32Array, durationMs: number): Promise<void>
  reportCaptureError(message: string): Promise<void>

  listHistory(query: HistoryQuery): Promise<TranscriptionRecord[]>
  deleteHistory(id: number): Promise<void>
  clearHistory(): Promise<void>
  getStats(): Promise<StatsSummary>

  listModels(): Promise<LocalModelInfo[]>
  downloadModel(modelId: string): Promise<void>

  testCloud(): Promise<{ ok: boolean; reason?: string }>
  testCleanup(): Promise<{ ok: boolean; reason?: string }>

  appVersion(): Promise<string>
  openMainWindow(): Promise<void>
  copyText(text: string): Promise<void>

  onBarState(cb: (state: BarState) => void): () => void
  onCaptureStart(cb: () => void): () => void
  onCaptureStop(cb: (opts: { discard: boolean }) => void): () => void
  onModelProgress(cb: (p: ModelDownloadProgress) => void): () => void
  onDictationDone(cb: (r: DictationResult) => void): () => void
  onSettingsChanged(cb: (s: AppSettings) => void): () => void
}
