const TARGET_SAMPLE_RATE = 16000
const MAX_DURATION_MIN = 30

/**
 * Decode any browser-supported audio file (wav/mp3/ogg/m4a/webm) and resample
 * to 16 kHz mono Float32 — the format the whisper pipeline expects.
 */
export async function decodeAudioFile(
  file: File
): Promise<{ pcm: Float32Array; durationMs: number }> {
  const bytes = await file.arrayBuffer()
  const probe = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await probe.decodeAudioData(bytes)
  } catch {
    throw new Error(`Could not decode "${file.name}" — not a supported audio format`)
  } finally {
    await probe.close()
  }
  if (decoded.duration > MAX_DURATION_MIN * 60) {
    throw new Error(`File is longer than ${MAX_DURATION_MIN} minutes`)
  }
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE
  )
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return {
    pcm: rendered.getChannelData(0).slice(0),
    durationMs: Math.round(decoded.duration * 1000)
  }
}
