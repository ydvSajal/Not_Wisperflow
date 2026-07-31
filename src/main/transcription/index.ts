import type { AppSettings } from '@shared/types'
import type { TranscribeInput, TranscribeOutput } from './types'
import { localWhisper } from './local-whisper'
import { CloudTranscriber } from './cloud'
import { SarvamTranscriber } from './sarvam'
import { isModelDownloaded } from './model-manager'

/** Anything shorter than this cannot hold a word. */
const MIN_SAMPLES = 16000 * 0.3
/** Below this peak the clip is silence; Whisper hallucinates "you" on it. */
const MIN_PEAK = 0.005

function peakOf(pcm: Float32Array): number {
  let peak = 0
  for (let i = 0; i < pcm.length; i++) {
    const a = pcm[i] < 0 ? -pcm[i] : pcm[i]
    if (a > peak) peak = a
  }
  return peak
}

/** Route a transcription to the engine chosen in settings. */
export async function transcribe(
  input: TranscribeInput,
  settings: AppSettings
): Promise<TranscribeOutput> {
  // Gate before any engine runs: silence costs a full inference (or a paid API
  // call) and yields a hallucination that gets written to history as if real.
  if (input.pcm.length < MIN_SAMPLES) {
    throw new Error('No audio captured — check that your microphone is working.')
  }
  if (peakOf(input.pcm) < MIN_PEAK) {
    throw new Error(
      'Microphone captured only silence. Check your input device and Windows microphone privacy settings.'
    )
  }
  if (settings.engine === 'cloud') {
    return new CloudTranscriber(settings.cloud).transcribe(input)
  }
  if (settings.engine === 'sarvam') {
    return new SarvamTranscriber(settings.sarvam).transcribe(input)
  }
  if (!isModelDownloaded(settings.localModel)) {
    throw new Error(
      'Local model not downloaded yet. Open Settings → Engine and download it first.'
    )
  }
  localWhisper.setModel(settings.localModel)
  return localWhisper.transcribe(input)
}
