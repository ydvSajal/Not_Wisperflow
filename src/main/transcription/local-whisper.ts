import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import type { TranscribeInput, TranscribeOutput, TranscriptionProvider } from './types'
import { getModelCacheDir } from './model-manager'

type WorkerMessage =
  | { type: 'progress'; modelId: string; percent: number }
  | { type: 'loaded'; modelId: string }
  | { type: 'load-error'; modelId: string; message: string }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; id: number; message: string }

/**
 * Whisper on CPU is far slower than realtime, so a fixed timeout would kill
 * legitimate work on a long clip. Allow this multiple of the clip's own
 * duration before declaring the worker wedged.
 */
const TIMEOUT_PER_AUDIO_SECOND = 30
const MIN_TIMEOUT_MS = 90_000

/**
 * Owns the whisper worker thread. Emits 'progress' {modelId, percent}
 * so the UI can render model downloads.
 */
class LocalWhisper extends EventEmitter implements TranscriptionProvider {
  private worker: Worker | null = null
  private nextId = 1
  private modelId = ''
  private loadingModelId = ''
  private loadedModelId = ''
  private loadPromise: Promise<void> | null = null
  private pending = new Map<
    number,
    { resolve: (text: string) => void; reject: (err: Error) => void }
  >()
  private loadWaiters: { resolve: () => void; reject: (err: Error) => void }[] = []

  setModel(modelId: string): void {
    this.modelId = modelId
  }

  /** True while a model download/load is in flight. */
  get isLoading(): boolean {
    return this.loadingModelId !== ''
  }

  get downloadingModelId(): string {
    return this.loadingModelId
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    this.worker = new Worker(join(import.meta.dirname, 'whisper-worker.js'), {
      workerData: { cacheDir: getModelCacheDir() }
    })
    this.worker.on('message', (msg: WorkerMessage) => this.onMessage(msg))
    this.worker.on('error', (err) => this.failAll(err))
    // A worker killed by the OS (an out-of-memory ONNX session on a large
    // checkpoint is the usual cause) emits 'exit', not 'error'. Without this
    // every in-flight promise stayed pending and the bar sat in "transcribing"
    // forever instead of surfacing the failure.
    this.worker.on('exit', (code) => {
      if (code === 0 && this.pending.size === 0 && this.loadWaiters.length === 0) {
        this.worker = null
        return
      }
      this.failAll(
        new Error(
          `Speech engine stopped unexpectedly (exit code ${code}). ` +
            'This usually means the model was too large for the available memory — ' +
            'try a smaller model in Settings → Engine.'
        )
      )
    })
    return this.worker
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err)
    this.pending.clear()
    for (const w of this.loadWaiters) w.reject(err)
    this.loadWaiters = []
    this.worker = null
    this.loadPromise = null
    this.loadingModelId = ''
    this.loadedModelId = ''
  }

  private onMessage(msg: WorkerMessage): void {
    switch (msg.type) {
      case 'progress':
        this.emit('progress', { modelId: msg.modelId, percent: msg.percent })
        break
      case 'loaded':
        if (msg.modelId !== this.loadingModelId) break
        this.loadingModelId = ''
        this.loadedModelId = msg.modelId
        for (const w of this.loadWaiters) w.resolve()
        this.loadWaiters = []
        break
      case 'load-error': {
        if (msg.modelId !== this.loadingModelId) break
        this.loadingModelId = ''
        const err = new Error(msg.message)
        for (const w of this.loadWaiters) w.reject(err)
        this.loadWaiters = []
        this.loadPromise = null
        break
      }
      case 'result':
        this.pending.get(msg.id)?.resolve(msg.text)
        this.pending.delete(msg.id)
        break
      case 'error':
        this.pending.get(msg.id)?.reject(new Error(msg.message))
        this.pending.delete(msg.id)
        break
    }
  }

  /**
   * Loads (downloading if needed) the current model. Idempotent per model;
   * queued (not raced) behind any load already in flight for another model,
   * since the worker only holds one pipeline/progress state at a time.
   */
  load(): Promise<void> {
    if (!this.modelId) return Promise.reject(new Error('No local model configured'))
    const modelId = this.modelId
    if (this.loadingModelId === modelId && this.loadPromise) return this.loadPromise
    // Already resolved for this model and nothing else queued: genuinely a no-op.
    if (this.loadedModelId === modelId && !this.loadingModelId) return Promise.resolve()
    const worker = this.ensureWorker()
    const prior = this.loadPromise ?? Promise.resolve()
    this.loadPromise = prior.catch(() => undefined).then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (this.modelId !== modelId) {
            resolve() // superseded while queued
            return
          }
          this.loadingModelId = modelId
          this.loadWaiters.push({ resolve, reject })
          worker.postMessage({ type: 'load', modelId })
        })
    )
    return this.loadPromise
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    await this.load()
    const worker = this.ensureWorker()
    const id = this.nextId++
    const audioSeconds = input.pcm.length / 16000
    const timeoutMs = Math.max(MIN_TIMEOUT_MS, audioSeconds * TIMEOUT_PER_AUDIO_SECOND * 1000)
    const text = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return
        this.pending.delete(id)
        reject(
          new Error(
            'Transcription timed out. The model may be too large for this machine — ' +
              'try a smaller model in Settings → Engine.'
          )
        )
      }, timeoutMs)
      const done = <T,>(fn: (v: T) => void) => (v: T): void => {
        clearTimeout(timer)
        fn(v)
      }
      this.pending.set(id, { resolve: done(resolve), reject: done(reject) })
      // Transfer a copy: transferring input.pcm.buffer detaches the caller's
      // array, so any retry or second consumer would see an empty clip.
      const pcm = input.pcm.slice()
      worker.postMessage({ type: 'transcribe', id, pcm, language: input.language }, [
        pcm.buffer as ArrayBuffer
      ])
    })
    return { text, engine: 'local', model: this.modelId }
  }

  /**
   * Stop the worker. An ONNX session mid-inference keeps the thread — and so
   * the whole process — alive, which is why Quit could leave the app running.
   */
  async dispose(): Promise<void> {
    const worker = this.worker
    this.worker = null
    this.loadPromise = null
    this.loadingModelId = ''
    this.loadedModelId = ''
    if (worker) await worker.terminate()
  }
}

export const localWhisper = new LocalWhisper()
