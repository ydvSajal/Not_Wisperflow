/** Settings persisted to <userData>/settings.json */
export interface CloudConfig {
  /** OpenAI-compatible base URL, e.g. https://api.groq.com/openai/v1 */
  baseUrl: string
  apiKey: string
  /** Transcription model id, e.g. whisper-large-v3-turbo */
  model: string
}

export interface CleanupConfig {
  enabled: boolean
  /** OpenAI-compatible chat completions base URL */
  baseUrl: string
  apiKey: string
  model: string
}

export interface AppSettings {
  /** Electron accelerator for toggling dictation */
  hotkey: string
  engine: 'local' | 'cloud'
  /** HuggingFace ONNX model id for local whisper */
  localModel: string
  /** 'auto' or ISO-639-1 code ('en', 'hi', ...) */
  language: string
  cloud: CloudConfig
  cleanup: CleanupConfig
  autoPaste: boolean
  restoreClipboard: boolean
  launchAtLogin: boolean
  sounds: boolean
  onboarded: boolean
}

export type DictationPhase = 'idle' | 'recording' | 'transcribing' | 'result' | 'error'

/** State pushed from main to the floating bar window */
export interface BarState {
  phase: DictationPhase
  /** Set when phase === 'result' */
  transcript?: string
  /** Set when phase === 'error' */
  error?: string
  /** ms timestamp when recording started; bar renders its own timer */
  startedAt?: number
}

export interface TranscriptionRecord {
  id: number
  text: string
  rawText: string
  words: number
  durationMs: number
  wpm: number
  engine: string
  model: string
  createdAt: string
}

export interface HistoryQuery {
  search?: string
  limit?: number
  offset?: number
}

export interface DailyStat {
  /** YYYY-MM-DD (local time) */
  day: string
  words: number
  count: number
}

export interface StatsSummary {
  totalWords: number
  totalCount: number
  totalDurationMs: number
  avgWpm: number
  /** Consecutive days ending today (or yesterday) with at least one dictation */
  streakDays: number
  daily: DailyStat[]
}

export interface LocalModelInfo {
  id: string
  label: string
  /** Approximate download size, display only */
  size: string
  downloaded: boolean
}

export interface ModelDownloadProgress {
  modelId: string
  /** 0-100 across all files, best effort */
  percent: number
  status: 'downloading' | 'ready' | 'error'
  error?: string
}

export interface MicCheckResult {
  ok: boolean
  error?: string
}

/** Result of a completed dictation, forwarded to renderers */
export interface DictationResult {
  text: string
  record: TranscriptionRecord | null
}
