import { app } from 'electron'
import { join } from 'node:path'
import type { LocalModelInfo } from '@shared/types'
import { checkModel, type ModelState } from './model-cache'

/** Curated whisper checkpoints known to work with transformers.js q8 on CPU. */
const CURATED: Omit<LocalModelInfo, 'downloaded' | 'state'>[] = [
  { id: 'onnx-community/whisper-tiny', label: 'Whisper Tiny (fastest, rough)', size: '~45 MB' },
  { id: 'onnx-community/whisper-base', label: 'Whisper Base (recommended)', size: '~85 MB' },
  {
    id: 'onnx-community/whisper-small',
    label: 'Whisper Small (better accuracy)',
    size: '~250 MB'
  },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    label: 'Whisper Large v3 Turbo (best, very slow on CPU)',
    size: '~500 MB'
  }
]

export function getModelCacheDir(): string {
  return process.env['WHISPRFLOW_MODEL_DIR'] ?? join(app.getPath('userData'), 'models')
}

export function modelState(modelId: string): ModelState {
  return checkModel(getModelCacheDir(), modelId)
}

export function isModelDownloaded(modelId: string): boolean {
  return modelState(modelId) === 'ready'
}

export function listLocalModels(): LocalModelInfo[] {
  return CURATED.map((m) => {
    const state = modelState(m.id)
    return { ...m, state, downloaded: state === 'ready' }
  })
}
