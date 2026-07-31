/**
 * Downloads whisper checkpoints from Hugging Face into the transformers.js
 * cache layout, then lets transformers.js load them from cache with no network
 * of its own.
 *
 * We do this rather than letting the library fetch, because its downloader
 * (FileCache.put in @huggingface/transformers/src/utils/hub.js) is a bare
 * fetch() that streams straight to the file's final path: no retry, no timeout,
 * no HTTP range resume, and no temp file. One network blip therefore loses the
 * whole download, the next attempt restarts from byte zero, and a truncated
 * .onnx is left sitting at the real path where the cache will serve it forever.
 *
 * Here every file is written to `<name>.part` and renamed only once it is
 * verified, so a partial download can never be mistaken for a complete one.
 *
 * Hugging Face serves the two kinds of file in this repo differently, and both
 * paths matter:
 *   - the .onnx weights are LFS-backed, sent uncompressed with a Content-Length
 *     and range support, so they are size-verified and resume mid-file;
 *   - the small JSON files are brotli-encoded, so they arrive with no usable
 *     length. Those are fetched whole (a few KB each) and verified by parsing.
 *
 * No electron import: the whisper worker thread uses this too.
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline as streamPipeline } from 'node:stream/promises'

const HF = process.env['HF_ENDPOINT'] ?? 'https://huggingface.co'

/**
 * The q8 ONNX layout every checkpoint in our curated list publishes. Verified
 * against onnx-community/whisper-{tiny,base,small,large-v3-turbo}.
 * Optional files are absent on some checkpoints and must not fail the download.
 */
const MODEL_FILES: { path: string; required: boolean }[] = [
  { path: 'config.json', required: true },
  { path: 'generation_config.json', required: false },
  { path: 'preprocessor_config.json', required: true },
  { path: 'tokenizer.json', required: true },
  { path: 'tokenizer_config.json', required: false },
  { path: 'onnx/encoder_model_quantized.onnx', required: true },
  { path: 'onnx/decoder_model_merged_quantized.onnx', required: true }
]

const MAX_ATTEMPTS = 5
/** Abort and retry if the server sends nothing for this long — a stalled
 *  socket otherwise hangs forever with no error. */
const STALL_MS = 30_000

export interface DownloadProgress {
  /** Bytes present locally across all sized files, completed ones included. */
  loaded: number
  /** Total bytes the complete model occupies, from the server. */
  total: number
}

/** `size` is null when the server gives no usable length (compressed files). */
interface RemoteFile {
  path: string
  size: number | null
}

function fileUrl(modelId: string, path: string): string {
  return `${HF}/${modelId}/resolve/main/${path}`
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function remoteInfo(url: string): Promise<{ exists: boolean; size: number | null }> {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
  if (res.status === 404) return { exists: false, size: null }
  if (!res.ok) throw new Error(`HEAD ${res.status} ${res.statusText}`)
  // Absent whenever the response is compressed, since the encoded length would
  // not match what we write to disk.
  const len = Number(res.headers.get('content-length'))
  return { exists: true, size: Number.isFinite(len) && len > 0 ? len : null }
}

/** Is the file already on disk and complete? */
function isIntact(dest: string, size: number | null): boolean {
  if (!existsSync(dest)) return false
  if (size !== null) return statSync(dest).size === size
  // No server length to compare against. For the JSON files that means parsing
  // them: a truncated one fails, which is the failure we care about.
  if (dest.endsWith('.json')) {
    try {
      JSON.parse(readFileSync(dest, 'utf8'))
      return true
    } catch {
      return false
    }
  }
  return statSync(dest).size > 0
}

/**
 * Fetch one file to `dest`. When the server gave a length, resume from
 * `dest.part` and verify the byte count; otherwise fetch it whole and verify by
 * parsing. Renames into place only once verified.
 */
async function downloadFile(
  url: string,
  dest: string,
  expected: number | null,
  onBytes: (delta: number) => void
): Promise<void> {
  const part = `${dest}.part`
  const resumable = expected !== null
  mkdirSync(dirname(dest), { recursive: true })

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let from = resumable && existsSync(part) ? statSync(part).size : 0
    // A .part at or past the real length is corrupt state from an older run.
    if (!resumable || from >= (expected ?? 0)) {
      rmSync(part, { force: true })
      from = 0
    }

    // Everything this attempt has reported, so a failure can correct the
    // caller's running total back to what is genuinely on disk rather than
    // double-counting bytes the next attempt re-fetches.
    let reported = 0
    const bump = (n: number): void => {
      reported += n
      if (resumable) onBytes(n)
    }

    const controller = new AbortController()
    let stall = setTimeout(() => controller.abort(), STALL_MS)
    try {
      const res = await fetch(url, {
        headers: from > 0 ? { Range: `bytes=${from}-` } : {},
        signal: controller.signal,
        redirect: 'follow'
      })

      // 416 means our .part is at or past the end: start clean.
      if (res.status === 416) {
        rmSync(part, { force: true })
        throw new Error('range not satisfiable, restarting')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      // Asked to resume but got a whole-file 200: the server ignored the range,
      // so the bytes we already have are not a prefix of this response.
      if (from > 0 && res.status !== 206) {
        rmSync(part, { force: true })
        bump(-from)
        from = 0
      }
      if (!res.body) throw new Error('empty response body')

      const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
      source.on('data', (chunk: Buffer) => {
        bump(chunk.length)
        clearTimeout(stall)
        stall = setTimeout(() => controller.abort(), STALL_MS)
      })
      await streamPipeline(source, createWriteStream(part, { flags: from > 0 ? 'a' : 'w' }))

      if (expected !== null) {
        const got = statSync(part).size
        if (got !== expected) throw new Error(`size mismatch: got ${got}, expected ${expected}`)
      } else if (!isIntact(part, null)) {
        throw new Error('downloaded file failed validation')
      }
      renameSync(part, dest) // atomic: only now can anything observe this file
      return
    } catch (err) {
      lastError = err
      // This attempt began with `from` bytes on disk and told the caller about
      // `reported` more. Correct that to the real figure.
      if (resumable) {
        const onDisk = existsSync(part) ? statSync(part).size : 0
        onBytes(onDisk - from - reported)
      }
      if (attempt < MAX_ATTEMPTS) await sleep(Math.min(8000, 500 * 2 ** (attempt - 1)))
    } finally {
      clearTimeout(stall)
    }
  }
  throw new Error(
    `Could not download ${url.split('/').pop()} after ${MAX_ATTEMPTS} attempts: ` +
      (lastError instanceof Error ? lastError.message : String(lastError))
  )
}

/**
 * Make sure every file of `modelId` is present and complete under `cacheDir`,
 * downloading or resuming whatever is missing. Files already verified are
 * skipped, so calling this on an intact cache costs a handful of HEAD requests
 * and no bytes.
 *
 * Returns the on-disk size of each file, for the manifest.
 */
export async function ensureModelDownloaded(
  cacheDir: string,
  modelId: string,
  onProgress: (p: DownloadProgress) => void
): Promise<Record<string, number>> {
  const dir = join(cacheDir, modelId)

  // Ask the server about everything before fetching anything, so progress is a
  // true fraction of the whole download from the first byte.
  const wanted: RemoteFile[] = []
  for (const f of MODEL_FILES) {
    const info = await remoteInfo(fileUrl(modelId, f.path))
    if (!info.exists) {
      if (f.required) throw new Error(`${modelId} is missing ${f.path} on Hugging Face`)
      continue
    }
    wanted.push({ path: f.path, size: info.size })
  }

  // Only sized files count toward progress. The unsized ones are the JSON
  // configs — a couple of MB against hundreds, so their absence from the bar is
  // not visible, and inventing a size for them would make it lie.
  const total = wanted.reduce((a, f) => a + (f.size ?? 0), 0)
  let loaded = 0
  for (const f of wanted) {
    if (f.size !== null && isIntact(join(dir, f.path), f.size)) loaded += f.size
  }
  onProgress({ loaded, total })

  for (const f of wanted) {
    const dest = join(dir, f.path)
    if (isIntact(dest, f.size)) continue
    // Present but wrong: a truncated download from an older build, which the
    // cache would otherwise serve forever.
    if (existsSync(dest)) rmSync(dest, { force: true })
    await downloadFile(fileUrl(modelId, f.path), dest, f.size, (delta) => {
      loaded += delta
      onProgress({ loaded, total })
    })
  }

  return Object.fromEntries(wanted.map((f) => [f.path, statSync(join(dir, f.path)).size]))
}
