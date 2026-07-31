/**
 * Runs @huggingface/transformers Whisper (ONNX, CPU) off the main thread.
 * Protocol (parent -> worker):
 *   { type: 'load', modelId, expectedBytes }  -> progress* then loaded/load-error
 *   { type: 'transcribe', id, pcm, language } -> result/error with matching id
 * (worker -> parent):
 *   { type: 'progress', modelId, percent }
 *   { type: 'loaded', modelId } | { type: 'load-error', modelId, message }
 *   { type: 'result', id, text } | { type: 'error', id, message }
 */
import { parentPort, workerData } from 'node:worker_threads'
import {
  pipeline,
  env,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo
} from '@huggingface/transformers'
import { checkModel, purgeModel, writeManifest } from './model-cache'

interface WorkerData {
  cacheDir: string
}

type InMessage =
  | { type: 'load'; modelId: string; expectedBytes: number }
  | { type: 'transcribe'; id: number; pcm: Float32Array; language: string }

const { cacheDir } = workerData as WorkerData
env.cacheDir = cacheDir

const port = parentPort
if (!port) throw new Error('whisper-worker must run as a worker thread')

let asr: AutomaticSpeechRecognitionPipeline | null = null
let loadedModelId = ''

/** Bytes seen per file this load, so progress can be weighted by real size. */
const fileBytes = new Map<string, { loaded: number; total: number }>()

/**
 * Percent of the whole download, weighted by bytes rather than by file count —
 * averaging per-file percentages let five tiny JSON files read as 100% while
 * the half-gigabyte decoder had not started, which is what made the bar sit at
 * "100%" for the rest of the download.
 *
 * `expectedBytes` is the known total for the checkpoint. Without it the
 * denominator would grow as each new file appears and the bar would jump
 * backwards. Never reports 100: only a successful load means done.
 */
function onProgress(modelId: string, expected: number, info: ProgressInfo): void {
  if (info.status !== 'progress') return
  fileBytes.set(info.file, { loaded: info.loaded ?? 0, total: info.total ?? 0 })
  let loaded = 0
  let total = 0
  for (const f of fileBytes.values()) {
    loaded += f.loaded
    total += f.total
  }
  const denominator = Math.max(total, expected, 1)
  const percent = Math.min(99, Math.round((loaded / denominator) * 100))
  port!.postMessage({ type: 'progress', modelId, percent })
}

async function load(modelId: string, expected: number): Promise<void> {
  if (asr && loadedModelId === modelId) {
    port!.postMessage({ type: 'loaded', modelId })
    return
  }
  fileBytes.clear()

  // A cache left truncated by an interrupted download is never re-fetched by
  // transformers.js — it just serves the short file. Clear it first so this
  // load actually downloads whole files.
  if (checkModel(cacheDir, modelId) === 'corrupt') purgeModel(cacheDir, modelId)

  try {
    asr = await pipeline('automatic-speech-recognition', modelId, {
      dtype: 'q8',
      progress_callback: (info: ProgressInfo) => onProgress(modelId, expected, info)
    })
    loadedModelId = modelId
    // Only now is the download provably complete and parseable.
    writeManifest(cacheDir, modelId)
    port!.postMessage({ type: 'loaded', modelId })
  } catch (err) {
    asr = null
    loadedModelId = ''
    // Whatever is on disk could not be loaded. Drop it so the next attempt is
    // a clean download instead of replaying the same corrupt bytes forever.
    try {
      purgeModel(cacheDir, modelId)
    } catch {
      // best effort: a locked file must not mask the original load error
    }
    port!.postMessage({
      type: 'load-error',
      modelId,
      message: err instanceof Error ? err.message : String(err)
    })
  }
}

async function transcribe(id: number, pcm: Float32Array, language: string): Promise<void> {
  if (!asr) {
    port!.postMessage({ type: 'error', id, message: 'Model not loaded' })
    return
  }
  try {
    const isEnglishOnly = loadedModelId.endsWith('.en')
    const output = await asr(pcm, {
      chunk_length_s: 30,
      stride_length_s: 5,
      // English-only checkpoints reject a language option
      ...(language !== 'auto' && !isEnglishOnly ? { language, task: 'transcribe' } : {})
    })
    const text = (Array.isArray(output) ? output.map((o) => o.text).join(' ') : output.text).trim()
    port!.postMessage({ type: 'result', id, text })
  } catch (err) {
    port!.postMessage({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err)
    })
  }
}

port.on('message', (msg: InMessage) => {
  if (msg.type === 'load') void load(msg.modelId, msg.expectedBytes)
  else if (msg.type === 'transcribe') void transcribe(msg.id, msg.pcm, msg.language)
})
