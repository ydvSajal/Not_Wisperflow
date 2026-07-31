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

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    this.worker = new Worker(join(import.meta.dirname, 'whisper-worker.js'), {
      workerData: { cacheDir: getModelCacheDir() }
    })
    this.worker.on('message', (msg: WorkerMessage) => this.onMessage(msg))
    this.worker.on('error', (err) => {
      for (const p of this.pending.values()) p.reject(err)
      this.pending.clear()
      for (const w of this.loadWaiters) w.reject(err)
      this.loadWaiters = []
      this.worker = null
      this.loadPromise = null
    })
    return this.worker
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
    const text = await new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      // Transfer a copy: transferring input.pcm.buffer detaches the caller's
      // array, so any retry or second consumer would see an empty clip.
      const pcm = input.pcm.slice()
      worker.postMessage({ type: 'transcribe', id, pcm, language: input.language }, [
        pcm.buffer as ArrayBuffer
      ])
    })
    return { text, engine: 'local', model: this.modelId }
  }
}

export const localWhisper = new LocalWhisper()
