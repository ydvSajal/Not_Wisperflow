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
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { purgeModel, writeManifest } from './model-cache'
import { ensureModelDownloaded } from './model-download'

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

async function load(modelId: string): Promise<void> {
  if (asr && loadedModelId === modelId) {
    port!.postMessage({ type: 'loaded', modelId })
    return
  }

  // Distinguishes "the download did not finish" from "the files are all here
  // and still will not load", which need opposite recovery.
  let downloadComplete = false
  try {
    // Fetch and verify every file ourselves first, resuming anything a previous
    // attempt left half-done. By the time pipeline() runs, the whole checkpoint
    // is in cache at server-confirmed sizes, so it does no network at all.
    // Progress is an exact fraction of the real download, and never reports 100
    // before the model has actually loaded.
    const files = await ensureModelDownloaded(cacheDir, modelId, ({ loaded, total }) => {
      const percent = total > 0 ? Math.min(99, Math.floor((loaded / total) * 100)) : 0
      port!.postMessage({ type: 'progress', modelId, percent })
    })
    downloadComplete = true

    asr = await pipeline('automatic-speech-recognition', modelId, { dtype: 'q8' })
    loadedModelId = modelId
    writeManifest(cacheDir, modelId, files)
    port!.postMessage({ type: 'loaded', modelId })
  } catch (err) {
    asr = null
    loadedModelId = ''
    // Every file is the length the server said and it still failed to load, so
    // the bytes themselves are bad: drop them. If instead the *download* was
    // what failed, keep what is on disk — the partial files are what the next
    // attempt resumes from, and deleting them would restart from zero.
    if (downloadComplete) {
      try {
        purgeModel(cacheDir, modelId)
      } catch {
        // best effort: a locked file must not mask the original load error
      }
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
  if (msg.type === 'load') void load(msg.modelId)
  else if (msg.type === 'transcribe') void transcribe(msg.id, msg.pcm, msg.language)
})
