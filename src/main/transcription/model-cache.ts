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

/** Files any usable whisper checkpoint has, beyond the .onnx weights. */
const REQUIRED_JSON = ['config.json', 'tokenizer.json', 'preprocessor_config.json']

export type ModelState = 'ready' | 'missing' | 'corrupt'

interface Manifest {
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
 * Record what a completed download produced. Call only once the pipeline has
 * loaded — that is the point at which we know every byte arrived and parsed.
 */
export function writeManifest(cacheDir: string, modelId: string): void {
  const dir = modelDir(cacheDir, modelId)
  if (!existsSync(dir)) return
  const files: Record<string, number> = {}
  for (const rel of walk(dir)) files[rel.split('\\').join('/')] = statSync(join(dir, rel)).size
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, MANIFEST), JSON.stringify({ files }, null, 2), 'utf8')
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

  const present = walk(dir).map((p) => p.split('\\').join('/'))
  if (present.length === 0) return 'missing'

  const manifest = readManifest(dir)
  if (manifest) {
    for (const [rel, size] of Object.entries(manifest.files)) {
      const p = join(dir, rel)
      if (!existsSync(p) || statSync(p).size !== size) return 'corrupt'
    }
    return 'ready'
  }

  // No manifest: a cache written by an older build. Adopt it if it at least
  // looks complete — a truncated file still slips through here, but the load
  // path purges and re-fetches on failure, so it self-heals on the next try
  // instead of forcing everyone to re-download a working model.
  const hasJson = REQUIRED_JSON.every((f) => present.includes(f))
  const onnx = present.filter((p) => p.endsWith('.onnx'))
  const hasWeights = onnx.some((p) => p.includes('encoder')) && onnx.some((p) => p.includes('decoder'))
  if (!hasJson || !hasWeights) return 'corrupt'
  writeManifest(cacheDir, modelId)
  return 'ready'
}

/** Delete a model so the next load fetches clean copies instead of cache hits. */
export function purgeModel(cacheDir: string, modelId: string): void {
  rmSync(modelDir(cacheDir, modelId), { recursive: true, force: true })
}
