import { app } from 'electron'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { LocalModelInfo } from '@shared/types'

/** Curated whisper checkpoints known to work with transformers.js q8 on CPU. */
const CURATED: Omit<LocalModelInfo, 'downloaded'>[] = [
  { id: 'onnx-community/whisper-tiny', label: 'Whisper Tiny (fastest, rough)', size: '~50 MB' },
  { id: 'onnx-community/whisper-base', label: 'Whisper Base (recommended)', size: '~85 MB' },
  { id: 'onnx-community/whisper-small', label: 'Whisper Small (better accuracy)', size: '~270 MB' },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    label: 'Whisper Large v3 Turbo (best, slow on CPU)',
    size: '~880 MB'
  }
]

export function getModelCacheDir(): string {
  return process.env['WHISPRFLOW_MODEL_DIR'] ?? join(app.getPath('userData'), 'models')
}

function hasOnnxFiles(dir: string): boolean {
  if (!existsSync(dir)) return false
  const walk = (d: string): boolean => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory() && walk(p)) return true
      if (entry.isFile() && entry.name.endsWith('.onnx')) return true
    }
    return false
  }
  return walk(dir)
}

export function isModelDownloaded(modelId: string): boolean {
  return hasOnnxFiles(join(getModelCacheDir(), modelId))
}

export function listLocalModels(): LocalModelInfo[] {
  return CURATED.map((m) => ({ ...m, downloaded: isModelDownloaded(m.id) }))
}
