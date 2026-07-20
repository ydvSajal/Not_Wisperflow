import type { AppSettings } from '@shared/types'
import type { TranscribeInput, TranscribeOutput } from './types'
import { localWhisper } from './local-whisper'
import { CloudTranscriber } from './cloud'
import { isModelDownloaded } from './model-manager'

/** Route a transcription to the engine chosen in settings. */
export async function transcribe(
  input: TranscribeInput,
  settings: AppSettings
): Promise<TranscribeOutput> {
  if (settings.engine === 'cloud') {
    return new CloudTranscriber(settings.cloud).transcribe(input)
  }
  if (!isModelDownloaded(settings.localModel)) {
    throw new Error(
      'Local model not downloaded yet. Open Settings → Engine and download it first.'
    )
  }
  localWhisper.setModel(settings.localModel)
  return localWhisper.transcribe(input)
}
