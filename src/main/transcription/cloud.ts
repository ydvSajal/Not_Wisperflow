import type { CloudConfig } from '@shared/types'
import type { TranscribeInput, TranscribeOutput, TranscriptionProvider } from './types'
import { encodeWavPcm16 } from './wav'

const SAMPLE_RATE = 16000

/**
 * OpenAI-compatible /audio/transcriptions client. Works with Groq (free tier),
 * OpenAI, or any compatible endpoint — provider is just config.
 */
export class CloudTranscriber implements TranscriptionProvider {
  constructor(private config: CloudConfig) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    if (!this.config.apiKey) {
      throw new Error('Cloud engine selected but no API key set. Add one in Settings.')
    }
    const wav = encodeWavPcm16(input.pcm, SAMPLE_RATE)
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav')
    form.append('model', this.config.model)
    form.append('response_format', 'json')
    if (input.language !== 'auto') form.append('language', input.language)

    const res = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body: form
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Cloud transcription failed (${res.status}): ${body.slice(0, 300)}`)
    }
    const json = (await res.json()) as { text?: string }
    return { text: (json.text ?? '').trim(), engine: 'cloud', model: this.config.model }
  }
}

/** Cheap connectivity/key check against the provider's model list. */
export async function testCloudConfig(config: CloudConfig): Promise<{ ok: boolean; reason?: string }> {
  if (!config.apiKey) return { ok: false, reason: 'No API key set' }
  try {
    const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    })
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
