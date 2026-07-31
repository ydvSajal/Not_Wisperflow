/**
 * Network self-check for the model downloader: resume correctness.
 * Downloads whisper-tiny (~43 MB) twice into a temp dir.
 * Run: pnpm test:model-download
 */
import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { ensureModelDownloaded } = await import('../src/main/transcription/model-download.ts')

const MODEL = 'onnx-community/whisper-tiny'
const ENCODER = 'onnx/encoder_model_quantized.onnx'
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

// --- 1. clean download, and progress must be sane ------------------------
const a = mkdtempSync(join(tmpdir(), 'nwf-dl-a-'))
const seen = []
const files = await ensureModelDownloaded(a, MODEL, (p) => seen.push(p))

for (const [rel, size] of Object.entries(files)) {
  assert.equal(statSync(join(a, MODEL, rel)).size, size, `${rel} must match the server's size`)
}
assert.ok(seen.length > 0, 'progress must be reported')
const pct = seen.map((p) => (p.total ? (p.loaded / p.total) * 100 : 0))
assert.ok(Math.max(...pct) <= 100.001, 'progress must never exceed 100%')
assert.ok(Math.min(...pct) >= -0.001, 'progress must never go negative')
assert.ok(pct.at(-1) > 99.9, 'progress must finish at 100%')
console.log(`clean download ok — ${Object.keys(files).length} files, final ${pct.at(-1).toFixed(1)}%`)

// No .part files may survive a successful download.
const strays = Object.keys(files).filter((rel) => {
  try {
    statSync(join(a, MODEL, `${rel}.part`))
    return true
  } catch {
    return false
  }
})
assert.equal(strays.length, 0, 'no .part files may be left behind')

// --- 2. resume must produce byte-identical output ------------------------
// Simulate a transfer cut off partway: put a prefix of the encoder in .part,
// exactly as an interrupted download would leave it.
const b = mkdtempSync(join(tmpdir(), 'nwf-dl-b-'))
const full = readFileSync(join(a, MODEL, ENCODER))
const cut = Math.floor(full.length / 3)
mkdirSync(join(b, MODEL, 'onnx'), { recursive: true })
writeFileSync(join(b, MODEL, `${ENCODER}.part`), full.subarray(0, cut))

let firstReport = null
await ensureModelDownloaded(b, MODEL, (p) => {
  if (firstReport === null) firstReport = p
})

assert.equal(
  sha(join(b, MODEL, ENCODER)),
  sha(join(a, MODEL, ENCODER)),
  'a resumed file must be byte-identical to one downloaded in a single pass'
)
console.log(`resume ok — restarted from ${(cut / 1e6).toFixed(1)} MB, hashes match`)

// --- 3. an already-complete cache must cost no bytes ---------------------
let downloaded = 0
let start = null
await ensureModelDownloaded(a, MODEL, (p) => {
  if (start === null) start = p.loaded
  downloaded = p.loaded - start
})
assert.equal(downloaded, 0, 'an intact cache must re-download nothing')
assert.equal(start, seen.at(-1).total, 'an intact cache must start at 100%')
console.log('intact cache ok — zero bytes re-downloaded')

rmSync(a, { recursive: true, force: true })
rmSync(b, { recursive: true, force: true })
console.log('model-download: all checks passed')
