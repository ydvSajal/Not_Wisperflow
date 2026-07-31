/**
 * Self-check for the model cache integrity rules.
 * Run: pnpm test:model-cache
 */
import { strict as assert } from 'node:assert'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { checkModel, writeManifest, purgeModel } = await import(
  '../src/main/transcription/model-cache.ts'
)

const MODEL = 'onnx-community/whisper-tiny'
const root = mkdtempSync(join(tmpdir(), 'nwf-cache-'))

/** Lay down a plausible whisper checkpoint. */
function seed(cacheDir, { decoderBytes = 4096 } = {}) {
  const dir = join(cacheDir, MODEL)
  mkdirSync(join(dir, 'onnx'), { recursive: true })
  for (const f of ['config.json', 'tokenizer.json', 'preprocessor_config.json']) {
    writeFileSync(join(dir, f), '{}')
  }
  writeFileSync(join(dir, 'onnx', 'encoder_model_quantized.onnx'), Buffer.alloc(8192))
  writeFileSync(join(dir, 'onnx', 'decoder_model_merged_quantized.onnx'), Buffer.alloc(decoderBytes))
  return dir
}

// Nothing on disk at all.
assert.equal(checkModel(root, MODEL), 'missing', 'empty cache must read as missing')

// A complete-looking cache from an older build is adopted, not thrown away.
const dir = seed(root)
assert.equal(checkModel(root, MODEL), 'ready', 'complete legacy cache should be adopted')
assert.ok(existsSync(join(dir, '.notwhisperflow-manifest.json')), 'adoption writes a manifest')

// The regression this whole change exists for: a download killed partway leaves
// a short .onnx that transformers.js would serve from cache forever.
writeFileSync(join(dir, 'onnx', 'decoder_model_merged_quantized.onnx'), Buffer.alloc(64))
assert.equal(checkModel(root, MODEL), 'corrupt', 'truncated weights must not read as ready')

// Re-downloading restores it: fresh bytes, fresh manifest.
seed(root)
writeManifest(root, MODEL)
assert.equal(checkModel(root, MODEL), 'ready', 'a re-downloaded model verifies again')

// A missing file is just as fatal as a truncated one.
rmSync(join(dir, 'onnx', 'encoder_model_quantized.onnx'))
assert.equal(checkModel(root, MODEL), 'corrupt', 'missing weights must not read as ready')

// Purge clears the way for a clean download.
purgeModel(root, MODEL)
assert.equal(checkModel(root, MODEL), 'missing', 'purge must leave nothing behind')

rmSync(root, { recursive: true, force: true })
console.log('model-cache: all checks passed')
