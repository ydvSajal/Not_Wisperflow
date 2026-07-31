export interface TranscribeInput {
  /** Mono PCM at 16 kHz */
  pcm: Float32Array
  /** 'auto' or ISO-639-1 code */
  language: string
}

export interface TranscribeOutput {
  text: string
  engine: 'local' | 'cloud' | 'sarvam'
  model: string
}

export interface TranscriptionProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeOutput>
}
