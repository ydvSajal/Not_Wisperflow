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

  async start(onLevel: (level: number) => void): Promise<void> {
    this.chunks = []
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    // Chromium resamples to the requested context rate for us
    this.ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
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
      for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i]
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
    this.chunks = []
    await this.teardown()
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const pcm = new Float32Array(total)
    let offset = 0
    for (const c of chunks) {
      pcm.set(c, offset)
      offset += c.length
    }
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
