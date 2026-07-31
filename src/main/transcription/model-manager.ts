import { app } from 'electron'
import { join } from 'node:path'
import type { LocalModelInfo } from '@shared/types'
import { checkModel, purgeModel, type ModelState } from './model-cache'

/** Curated whisper checkpoints known to work with transformers.js q8 on CPU. */
const CURATED: (Omit<LocalModelInfo, 'downloaded' | 'state'> & { bytes: number })[] = [
  {
    id: 'onnx-community/whisper-tiny',
    label: 'Whisper Tiny (fastest, rough)',
    size: '~45 MB',
    bytes: 43_000_000
  },
  {
    id: 'onnx-community/whisper-base',
    label: 'Whisper Base (recommended)',
    size: '~85 MB',
    bytes: 86_000_000
  },
  {
    id: 'onnx-community/whisper-small',
    label: 'Whisper Small (better accuracy)',
    size: '~250 MB',
    bytes: 252_000_000
  },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    label: 'Whisper Large v3 Turbo (best, very slow on CPU)',
    size: '~500 MB',
    bytes: 498_000_000
  }
]

export function getModelCacheDir(): string {
  return process.env['WHISPRFLOW_MODEL_DIR'] ?? join(app.getPath('userData'), 'models')
}

/** Download size in bytes, used to keep download progress honest. 0 if unknown. */
export function expectedBytes(modelId: string): number {
  return CURATED.find((m) => m.id === modelId)?.bytes ?? 0
}

export function modelState(modelId: string): ModelState {
  return checkModel(getModelCacheDir(), modelId)
}

export function isModelDownloaded(modelId: string): boolean {
  return modelState(modelId) === 'ready'
}

/** Drop a half-written model so the next load re-fetches it cleanly. */
export function purgeLocalModel(modelId: string): void {
  purgeModel(getModelCacheDir(), modelId)
}

export function listLocalModels(): LocalModelInfo[] {
  return CURATED.map(({ bytes: _bytes, ...m }) => {
    const state = modelState(m.id)
    return { ...m, state, downloaded: state === 'ready' }
  })
}
