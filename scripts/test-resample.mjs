// Checks that the capture resampler actually band-limits before decimating.
// Without a low-pass, content above the 8 kHz output Nyquist folds back into
// the speech band and quietly degrades every transcription.
//
//   node --experimental-strip-types scripts/test-resample.mjs
import assert from 'node:assert/strict'
import { resample } from '../src/renderer/src/lib/recorder.ts'

const FROM = 48000
const TO = 16000

function tone(hz) {
  const a = new Float32Array(FROM) // one second
  for (let i = 0; i < a.length; i++) a[i] = Math.sin((2 * Math.PI * hz * i) / FROM)
  return a
}

/** Peak amplitude, ignoring the edges where the kernel is truncated. */
function peak(a) {
  let p = 0
  for (let i = 200; i < a.length - 200; i++) {
    const v = Math.abs(a[i])
    if (v > p) p = v
  }
  return p
}

const at = (hz) => peak(resample(tone(hz), FROM, TO))

// Speech band passes through essentially untouched.
for (const hz of [200, 1000, 3000]) {
  const got = at(hz)
  assert.ok(got > 0.97 && got < 1.03, `${hz} Hz should pass flat, got ${got.toFixed(3)}`)
}

// Above the output Nyquist everything must be crushed, or it aliases.
// 12 kHz in particular would fold to 4 kHz, right on top of speech.
for (const hz of [12000, 20000]) {
  const got = at(hz)
  assert.ok(got < 0.02, `${hz} Hz must be attenuated, got ${got.toFixed(3)}`)
}

// Identity and empty input are pass-through.
assert.equal(resample(new Float32Array(0), FROM, TO).length, 0)
const same = tone(1000)
assert.equal(resample(same, TO, TO), same)

// Output length tracks the rate ratio.
assert.equal(resample(tone(1000), FROM, TO).length, FROM / (FROM / TO))

console.log('resample: ok')
