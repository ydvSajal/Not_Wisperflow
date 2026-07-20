/**
 * Runs @huggingface/transformers Whisper (ONNX, CPU) off the main thread.
 * Protocol (parent -> worker):
 *   { type: 'load', modelId }                  -> progress* then loaded/load-error
 *   { type: 'transcribe', id, pcm, language }  -> result/error with matching id
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

interface WorkerData {
  cacheDir: string
}

type InMessage =
  | { type: 'load'; modelId: string }
  | { type: 'transcribe'; id: number; pcm: Float32Array; language: string }

const { cacheDir } = workerData as WorkerData
env.cacheDir = cacheDir

const port = parentPort
if (!port) throw new Error('whisper-worker must run as a worker thread')

let asr: AutomaticSpeechRecognitionPipeline | null = null
let loadedModelId = ''

// One file at a time reports progress; track per-file to average a rough total
const fileProgress = new Map<string, number>()

function onProgress(modelId: string, info: ProgressInfo): void {
  if (info.status === 'progress') {
    fileProgress.set(info.file, info.progress ?? 0)
    const values = [...fileProgress.values()]
    const percent = values.reduce((a, b) => a + b, 0) / values.length
    port!.postMessage({ type: 'progress', modelId, percent: Math.round(percent) })
  }
}

async function load(modelId: string): Promise<void> {
  if (asr && loadedModelId === modelId) {
    port!.postMessage({ type: 'loaded', modelId })
    return
  }
  fileProgress.clear()
  try {
    asr = await pipeline('automatic-speech-recognition', modelId, {
      dtype: 'q8',
      progress_callback: (info: ProgressInfo) => onProgress(modelId, info)
    })
    loadedModelId = modelId
    port!.postMessage({ type: 'loaded', modelId })
  } catch (err) {
    asr = null
    loadedModelId = ''
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
  if (msg.type === 'load') void load(msg.modelId)
  else if (msg.type === 'transcribe') void transcribe(msg.id, msg.pcm, msg.language)
})
