import type { SarvamConfig } from '@shared/types'
import type { TranscribeInput, TranscribeOutput, TranscriptionProvider } from './types'
import { encodeWavPcm16 } from './wav'

const SAMPLE_RATE = 16000
const ENDPOINT = 'https://api.sarvam.ai/speech-to-text'

/** Sarvam AI speech-to-text client (api.sarvam.ai/speech-to-text). */
export class SarvamTranscriber implements TranscriptionProvider {
  constructor(private config: SarvamConfig) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    if (!this.config.apiKey) {
      throw new Error('Sarvam engine selected but no API key set. Add one in Settings.')
    }
    const wav = encodeWavPcm16(input.pcm, SAMPLE_RATE)
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav')
    form.append('model', this.config.model)
    form.append('language_code', this.config.languageCode || 'unknown')

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'api-subscription-key': this.config.apiKey },
      body: form
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Sarvam transcription failed (${res.status}): ${body.slice(0, 300)}`)
    }
    const json = (await res.json()) as { transcript?: string }
    return { text: (json.transcript ?? '').trim(), engine: 'sarvam', model: this.config.model }
  }
}

/** Cheap connectivity/key check: a 1-sample silent clip is enough to validate the key. */
export async function testSarvamConfig(
  config: SarvamConfig
): Promise<{ ok: boolean; reason?: string }> {
  if (!config.apiKey) return { ok: false, reason: 'No API key set' }
  try {
    const silence = encodeWavPcm16(new Float32Array(SAMPLE_RATE * 0.1), SAMPLE_RATE)
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(silence)], { type: 'audio/wav' }), 'audio.wav')
    form.append('model', config.model)
    form.append('language_code', config.languageCode || 'unknown')
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'api-subscription-key': config.apiKey },
      body: form
    })
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
