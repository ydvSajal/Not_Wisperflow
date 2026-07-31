// A held global shortcut fires repeatedly, which toggled record/stop and made
// the second dictation "activate and finish automatically". Windows waits out
// its repeat delay (250-1000 ms) and then fires every ~30 ms.
//
//   node --experimental-strip-types scripts/test-key-repeat.mjs
import assert from 'node:assert/strict'
import { ignoreKeyRepeat } from '../src/main/key-repeat.ts'

/** Feed a list of timestamps (ms) and count how many got through. */
function accepted(times) {
  let clock = 0
  let hits = 0
  const toggle = ignoreKeyRepeat(() => hits++, () => clock)
  for (const t of times) {
    clock = t
    toggle()
  }
  return hits
}

/** Press at t, then OS repeats every 30 ms after `delay`, while held for `heldMs`. */
function hold(t, delay, heldMs) {
  const times = [t]
  for (let r = t + delay; r <= t + heldMs; r += 30) times.push(r)
  return times
}

// A single tap is always one toggle.
assert.equal(accepted([1000]), 1)

// The bug from the log: repeat delay lands at ~460 ms and ~870 ms and used to
// stop the recording. Across every repeat-delay setting Windows offers, and
// however long the key is held, a hold must still count as exactly one press.
for (const delay of [250, 500, 750, 1000]) {
  for (const heldMs of [0, 500, 1200, 3000, 10000]) {
    const got = accepted(hold(5000, delay, heldMs))
    assert.equal(got, 1, `delay=${delay} held=${heldMs} should toggle once, got ${got}`)
  }
}

// Two deliberate presses far apart are two toggles.
assert.equal(accepted([1000, 3000]), 2)

// Two holds, released and pressed again, are two toggles.
assert.equal(accepted([...hold(1000, 500, 2000), ...hold(6000, 500, 2000)]), 2)

// A real second press right after a hold ends still registers.
assert.equal(accepted([...hold(1000, 500, 2000), 4500]), 2)

console.log('key-repeat: ok')
