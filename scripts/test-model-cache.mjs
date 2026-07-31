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

const MODEL = 'onnx-community/whisper-base'
const ENCODER = 'onnx/encoder_model_quantized.onnx'
const DECODER = 'onnx/decoder_model_merged_quantized.onnx'
/** Real sizes published for this checkpoint. */
const SIZES = {
  'config.json': 2243,
  'tokenizer.json': 2480466,
  'preprocessor_config.json': 339,
  [ENCODER]: 23201314,
  [DECODER]: 53693315
}

const root = mkdtempSync(join(tmpdir(), 'nwf-cache-'))
const dir = join(root, MODEL)

/** Lay down a checkpoint; `overrides` sets a different (e.g. truncated) size. */
function seed(overrides = {}) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'onnx'), { recursive: true })
  for (const [rel, size] of Object.entries(SIZES)) {
    writeFileSync(join(dir, rel), Buffer.alloc(overrides[rel] ?? size))
  }
}

// Nothing on disk at all.
assert.equal(checkModel(root, MODEL), 'missing', 'empty cache must read as missing')

// THE REGRESSION THIS EXISTS FOR. v1.1.0 adopted any cache that merely had an
// encoder and a decoder *present*, which a download interrupted midway through
// the decoder also satisfies — and then recorded the truncated length as
// correct, so it verified as healthy forever and the download was skipped.
seed({ [DECODER]: 20_000_000 })
assert.equal(
  checkModel(root, MODEL),
  'corrupt',
  'a download cut off inside the decoder must not read as ready'
)

// Files with no manifest of ours cannot be trusted either way: report corrupt
// so they get re-verified against the server (which keeps whole files).
seed()
assert.equal(checkModel(root, MODEL), 'corrupt', 'an unverified cache must not read as ready')
assert.ok(!existsSync(join(dir, '.notwhisperflow-manifest.json')), 'checking writes no manifest')

// A verified download records server-confirmed sizes and then reads as ready.
writeManifest(root, MODEL, SIZES)
assert.equal(checkModel(root, MODEL), 'ready', 'a verified download must read as ready')

// Truncation after the fact is caught by the size comparison.
writeFileSync(join(dir, DECODER), Buffer.alloc(64))
assert.equal(checkModel(root, MODEL), 'corrupt', 'truncated weights must not read as ready')

// A missing file is just as fatal as a truncated one.
seed()
writeManifest(root, MODEL, SIZES)
rmSync(join(dir, ENCODER))
assert.equal(checkModel(root, MODEL), 'corrupt', 'missing weights must not read as ready')

// A manifest from 1.1.0 (no source marker) must not be trusted.
seed()
writeFileSync(
  join(dir, '.notwhisperflow-manifest.json'),
  JSON.stringify({ files: { ...SIZES, [DECODER]: 20_000_000 } })
)
assert.equal(checkModel(root, MODEL), 'corrupt', 'a pre-1.1.2 manifest must be re-verified')

// Purge clears the way for a clean download.
purgeModel(root, MODEL)
assert.equal(checkModel(root, MODEL), 'missing', 'purge must leave nothing behind')

rmSync(root, { recursive: true, force: true })
console.log('model-cache: all checks passed')
