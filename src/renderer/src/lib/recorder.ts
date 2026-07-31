const TARGET_SAMPLE_RATE = 16000

const WORKLET_SOURCE = `
class PcmCollector extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel && channel.length) this.port.postMessage(channel.slice(0))
    return true
  }
}
registerProcessor('pcm-collector', PcmCollector)
`

export interface RecordingResult {
  pcm: Float32Array
  durationMs: number
}

function sinc(x: number): number {
  if (x === 0) return 1
  const p = Math.PI * x
  return Math.sin(p) / p
}

/**
 * Band-limited resampler. Downsampling needs a low-pass at the *output*
 * Nyquist, otherwise everything above 8 kHz folds back into the speech band
 * and wrecks Whisper's accuracy. Hann-windowed sinc, 6 lobes each side:
 * measured at 48k->16k that is flat to 3 kHz, -1.6 dB at 7 kHz, and -54 dB at
 * 12 kHz (which the old linear version passed at full amplitude, folding it
 * back to 4 kHz). See scripts/test-resample.mjs.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input
  const ratio = fromRate / toRate
  const outLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outLength)
  const cutoff = ratio > 1 ? 1 / ratio : 1
  const halfWidth = Math.max(2, Math.ceil(6 * ratio))
  for (let i = 0; i < outLength; i++) {
    const center = i * ratio
    const first = Math.max(0, Math.ceil(center) - halfWidth)
    const last = Math.min(input.length - 1, Math.floor(center) + halfWidth)
    let sum = 0
    let norm = 0
    for (let j = first; j <= last; j++) {
      const x = j - center
      const k = sinc(cutoff * x) * (0.5 + 0.5 * Math.cos((Math.PI * x) / halfWidth))
      sum += input[j] * k
      norm += k
    }
    output[i] = norm > 0 ? sum / norm : 0
  }
  return output
}

/**
 * Captures mono 16 kHz PCM from the microphone via an AudioWorklet.
 * Reports a smoothed RMS level (0..1) for waveform UI.
 */
export class MicRecorder {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private chunks: Float32Array[] = []
  private startedAt = 0
  private peak = 0

  async start(onLevel: (level: number) => void): Promise<void> {
    this.chunks = []
    this.peak = 0
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    // Forcing the context to 16 kHz makes Chromium resample the device's
    // native rate on the fly, which on some Windows audio drivers produces
    // near-silent/garbled input. Record at the device's native rate instead
    // and resample ourselves once, after capture.
    this.ctx = new AudioContext()
    // The bar window is focusable:false and shown with showInactive(), so it
    // never receives a user gesture. A suspended context fires no worklet
    // callbacks at all, which reads downstream as "51 seconds of silence".
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    if (this.ctx.state !== 'running') {
      const state = this.ctx.state
      await this.teardown()
      throw new Error(`Audio engine did not start (state: ${state})`)
    }
    const workletUrl = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
    )
    await this.ctx.audioWorklet.addModule(workletUrl)
    URL.revokeObjectURL(workletUrl)

    const source = this.ctx.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(this.ctx, 'pcm-collector')
    this.node.port.onmessage = (e: MessageEvent<Float32Array>): void => {
      const chunk = e.data
      this.chunks.push(chunk)
      let sum = 0
      for (let i = 0; i < chunk.length; i++) {
        const s = chunk[i]
        sum += s * s
        const a = s < 0 ? -s : s
        if (a > this.peak) this.peak = a
      }
      onLevel(Math.min(1, Math.sqrt(sum / chunk.length) * 4))
    }
    source.connect(this.node)
    // Keep the graph alive without echoing mic audio to speakers
    const silence = this.ctx.createGain()
    silence.gain.value = 0
    this.node.connect(silence)
    silence.connect(this.ctx.destination)
    this.startedAt = performance.now()
  }

  async stop(): Promise<RecordingResult> {
    const durationMs = Math.round(performance.now() - this.startedAt)
    const chunks = this.chunks
    const nativeRate = this.ctx?.sampleRate ?? TARGET_SAMPLE_RATE
    const state = this.ctx?.state ?? 'closed'
    this.chunks = []
    await this.teardown()
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const raw = new Float32Array(total)
    let offset = 0
    for (const c of chunks) {
      raw.set(c, offset)
      offset += c.length
    }
    const pcm = resample(raw, nativeRate, TARGET_SAMPLE_RATE)
    // Diagnostics: a peak near zero with a healthy sample count means the mic
    // stream itself is silent (driver, or Windows mic privacy); zero samples
    // means the worklet never fired.
    console.info('[recorder]', {
      chunks: chunks.length,
      samples: raw.length,
      nativeRate,
      state,
      peak: Number(this.peak.toFixed(4)),
      durationMs
    })
    return { pcm, durationMs }
  }

  async discard(): Promise<void> {
    this.chunks = []
    await this.teardown()
  }

  private async teardown(): Promise<void> {
    this.node?.port.close()
    this.node?.disconnect()
    this.node = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close()
    this.ctx = null
  }
}
