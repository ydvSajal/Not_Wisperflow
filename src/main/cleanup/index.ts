import type { CleanupConfig } from '@shared/types'

const SYSTEM_PROMPT = [
  'You clean up raw speech-to-text dictation.',
  'Fix punctuation, capitalization and obvious transcription mistakes.',
  'Remove filler words (um, uh, like) and false starts.',
  'Do NOT add, summarize or rephrase content. Keep the original language.',
  'Return ONLY the cleaned text, nothing else.'
].join(' ')

/**
 * Optional LLM pass over the transcript via any OpenAI-compatible chat endpoint.
 * Never throws: on failure the raw transcript is returned so a dictation is never lost.
 */
export async function cleanupText(text: string, config: CleanupConfig): Promise<string> {
  if (!config.enabled || !config.apiKey || !text) return text
  try {
    const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ]
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const cleaned = json.choices?.[0]?.message?.content?.trim()
    return cleaned || text
  } catch (err) {
    console.error('[cleanup] failed, using raw transcript:', err)
    return text
  }
}

/**
 * Translate a transcript to the target ISO-639-1 language using the same
 * OpenAI-compatible config as cleanup. Never throws: returns the original
 * text on failure so the dictation still pastes.
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  config: CleanupConfig
): Promise<string> {
  if (!config.apiKey || !text) return text
  try {
    const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You translate dictated speech. Translate the user's text to the language with ISO code "${targetLanguage}". Fix punctuation. Output ONLY the translation, nothing else.`
          },
          { role: 'user', content: text }
        ]
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const translated = json.choices?.[0]?.message?.content?.trim()
    return translated || text
  } catch (err) {
    console.error('[translate] failed, using original transcript:', err)
    return text
  }
}

export async function testCleanupConfig(
  config: CleanupConfig
): Promise<{ ok: boolean; reason?: string }> {
  if (!config.apiKey) return { ok: false, reason: 'No API key set' }
  try {
    const cleaned = await cleanupText('hello world test', { ...config, enabled: true })
    return cleaned ? { ok: true } : { ok: false, reason: 'Empty response' }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
