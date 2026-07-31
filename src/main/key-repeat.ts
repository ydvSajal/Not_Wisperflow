/**
 * Electron's globalShortcut gives us no key-up and no "is this a repeat" flag,
 * so a held accelerator is indistinguishable from real presses one event at a
 * time. It is distinguishable as a *stream*: Windows waits out its repeat delay
 * (500 ms by default, 250-1000 ms depending on the user's setting) and then
 * fires every ~30 ms for as long as the key is down.
 *
 * Two conditions catch both halves of that shape. Neither works alone: a plain
 * debounce shorter than the repeat delay lets the first repeat through, and one
 * longer than it still lets a long hold through once the threshold elapses.
 *
 * ponytail: a real key-up would make this exact instead of heuristic, but that
 * needs a WH_KEYBOARD_LL native helper (what openwhispr ships). Do that only if
 * push-to-talk is wanted.
 */

/** Repeats arrive far faster than a human can tap; collapses a sustained hold. */
export const BURST_GAP_MS = 200
/** Longer than the slowest Windows repeat delay; collapses the *first* repeat. */
export const MIN_TOGGLE_GAP_MS = 1100

export function ignoreKeyRepeat(fn: () => void, now: () => number = Date.now): () => void {
  // -Infinity, not 0: with a zeroed clock, 0 would swallow the first press.
  let lastEvent = -Infinity
  let lastAccepted = -Infinity
  return () => {
    const t = now()
    const isBurst = t - lastEvent < BURST_GAP_MS
    // Every event updates lastEvent, including rejected ones — that is what
    // keeps a long hold suppressed for its whole duration.
    lastEvent = t
    if (isBurst || t - lastAccepted < MIN_TOGGLE_GAP_MS) return
    lastAccepted = t
    fn()
  }
}
