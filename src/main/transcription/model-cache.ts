/**
 * Integrity tracking for the transformers.js model cache.
 *
 * transformers.js streams a download straight to its final path, and its cache
 * lookup only asks whether the file *exists*. So a download interrupted partway
 * — app quit, OOM, crash, lost network — leaves a truncated .onnx behind that is
 * then served from cache forever and never re-fetched. The app reports the model
 * as present, onnxruntime chokes on the truncated protobuf, and dictation either
 * hangs or fails with "model not available".
 *
 * We therefore keep our own manifest, written only after a load has actually
 * succeeded, and treat a model whose files no longer match it as absent.
 *
 * Deliberately free of any electron import: the whisper worker thread uses this
 * too, and it only ever gets a plain cache directory path.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const MANIFEST = '.notwhisperflow-manifest.json'

/**
 * Only a manifest we wrote ourselves, against sizes the server confirmed, is
 * trustworthy. Manifests from 1.1.0 lack this marker: that build would adopt a
 * cache merely because an encoder and a decoder file *existed*, which a
 * download interrupted midway through the decoder also satisfies — recording
 * the truncated length as if it were correct. Re-verifying those is cheap now
 * that downloads resume and complete files are skipped.
 */
const MANIFEST_SOURCE = 'verified-download'

export type ModelState = 'ready' | 'missing' | 'corrupt'

interface Manifest {
  source?: string
  files: Record<string, number>
}

export function modelDir(cacheDir: string, modelId: string): string {
  return join(cacheDir, modelId)
}

/** Every real file under `dir`, as paths relative to it. Manifest excluded. */
function walk(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p, base))
    else if (entry.isFile() && entry.name !== MANIFEST) out.push(relative(base, p))
  }
  return out
}

function readManifest(dir: string): Manifest | null {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8')) as Manifest
    return parsed && typeof parsed.files === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Record the sizes a verified download produced. `files` comes from
 * ensureModelDownloaded, which took them from the server's Content-Length —
 * never from whatever happens to be on disk, which is how a truncated file
 * could previously certify itself.
 */
export function writeManifest(
  cacheDir: string,
  modelId: string,
  files: Record<string, number>
): void {
  const dir = modelDir(cacheDir, modelId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, MANIFEST),
    JSON.stringify({ source: MANIFEST_SOURCE, files }, null, 2),
    'utf8'
  )
}

/**
 * 'ready'   — verified complete, safe to load
 * 'missing' — nothing downloaded yet
 * 'corrupt' — files on disk, but truncated or unverifiable: must be purged
 *             before transformers.js will fetch clean copies
 */
export function checkModel(cacheDir: string, modelId: string): ModelState {
  const dir = modelDir(cacheDir, modelId)
  if (!existsSync(dir)) return 'missing'

  const present = walk(dir)
  if (present.length === 0) return 'missing'

  // Anything without a manifest we wrote needs re-verifying against the server.
  // 'corrupt' rather than 'missing' because there are bytes here worth resuming
  // from: ensureModelDownloaded keeps every file whose length already matches.
  const manifest = readManifest(dir)
  if (!manifest || manifest.source !== MANIFEST_SOURCE) return 'corrupt'

  for (const [rel, size] of Object.entries(manifest.files)) {
    const p = join(dir, rel)
    if (!existsSync(p) || statSync(p).size !== size) return 'corrupt'
  }
  return 'ready'
}

/** Delete a model so the next load fetches clean copies instead of cache hits. */
export function purgeModel(cacheDir: string, modelId: string): void {
  rmSync(modelDir(cacheDir, modelId), { recursive: true, force: true })
}
