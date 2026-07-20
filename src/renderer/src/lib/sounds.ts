function beep(frequency: number, durationMs: number, type: OscillatorType = 'sine'): void {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + durationMs / 1000)
  osc.onended = (): void => void ctx.close()
}

export const sounds = {
  start: (): void => beep(880, 120),
  done: (): void => beep(660, 150),
  error: (): void => beep(220, 250, 'square')
}
