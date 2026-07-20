// Headless smoke test for the local transcription path.
// Downloads whisper-tiny (once), runs it on a synthetic tone + silence buffer,
// and proves the ONNX pipeline works end-to-end in this environment.
// Usage: pnpm test:whisper
import { pipeline, env } from '@huggingface/transformers'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const cacheDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.model-cache')
env.cacheDir = cacheDir

const MODEL = 'onnx-community/whisper-tiny'
console.log(`loading ${MODEL} (cache: ${cacheDir}) …`)
const started = Date.now()
const asr = await pipeline('automatic-speech-recognition', MODEL, {
  dtype: 'q8',
  progress_callback: (p) => {
    if (p.status === 'progress' && p.progress) {
      process.stdout.write(`\r  ${p.file}: ${p.progress.toFixed(0)}%   `)
    }
  }
})
console.log(`\nmodel ready in ${((Date.now() - started) / 1000).toFixed(1)}s`)

// 2s of near-silence with a soft 440Hz hum — whisper should return quickly
// (empty or trivial text). This validates inference, not accuracy.
const sampleRate = 16000
const pcm = new Float32Array(sampleRate * 2)
for (let i = 0; i < pcm.length; i++) {
  pcm[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.01
}
const t0 = Date.now()
const out = await asr(pcm)
console.log(`inference ok in ${Date.now() - t0}ms; output: ${JSON.stringify(out.text)}`)
console.log('local whisper pipeline: PASS')
