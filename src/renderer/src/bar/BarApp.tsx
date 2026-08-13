import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ClipboardCopy } from 'lucide-react'
import type { BarState } from '@shared/types'
import { MicRecorder } from '@/lib/recorder'
import { sounds } from '@/lib/sounds'
import { formatTimer } from '@/lib/format'
import { Waveform } from './Waveform'

const LEVEL_BARS = 14

/** Shared shell for every non-idle state: one dark capsule, one radius. */
function Pill({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-9 items-center gap-2.5 rounded-full bg-[#16161ef2] px-3.5 text-white shadow-lg shadow-black/30 ring-1 ring-white/12 backdrop-blur">
      {children}
    </div>
  )
}

export function BarApp(): React.JSX.Element {
  const [state, setState] = useState<BarState>({ phase: 'idle' })
  const [levels, setLevels] = useState<number[]>(() => Array<number>(LEVEL_BARS).fill(0))
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MicRecorder | null>(null)
  const soundsEnabled = useRef(true)
  const [translateTarget, setTranslateTarget] = useState('en')

  useEffect(() => {
    const apply = (s: { sounds: boolean; translateTarget: string }): void => {
      soundsEnabled.current = s.sounds
      setTranslateTarget(s.translateTarget)
    }
    void window.api.getSettings().then(apply)
    return window.api.onSettingsChanged(apply)
  }, [])

  const onLevel = useCallback((level: number) => {
    setLevels((prev) => [...prev.slice(1), level])
  }, [])

  // Start/stop capture on main-process command
  useEffect(() => {
    const offStart = window.api.onCaptureStart(() => {
      setLevels(Array<number>(LEVEL_BARS).fill(0))
      const recorder = new MicRecorder()
      recorderRef.current = recorder
      if (soundsEnabled.current) sounds.start()
      recorder.start(
        onLevel,
        (pcm: Float32Array, durationMs: number) => {
          void window.api.sendAudioChunk(pcm, durationMs)
        }
      ).catch((err: unknown) => {
        recorderRef.current = null
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone access denied. Allow it in your OS privacy settings.'
            : err instanceof DOMException && err.name === 'NotFoundError'
              ? 'No microphone found.'
              : `Could not start recording: ${err instanceof Error ? err.message : String(err)}`
        void window.api.reportCaptureError(message)
      })
    })
    const offStop = window.api.onCaptureStop(({ discard }) => {
      const recorder = recorderRef.current
      recorderRef.current = null
      if (!recorder) return
      if (discard) {
        void recorder.discard()
      } else {
        void recorder
          .stop()
          .then(({ pcm, durationMs }) => window.api.sendAudio(pcm, durationMs))
          .catch((err: unknown) =>
            window.api.reportCaptureError(
              `Could not finish recording: ${err instanceof Error ? err.message : String(err)}`
            )
          )
      }
    })
    return () => {
      offStart()
      offStop()
    }
  }, [onLevel])

  // Bar state pushed from main
  useEffect(() => {
    return window.api.onBarState((next) => {
      setState(next)
      if (soundsEnabled.current) {
        if (next.phase === 'result') sounds.done()
        if (next.phase === 'error') sounds.error()
      }
    })
  }, [])

  // Recording timer
  useEffect(() => {
    if (state.phase !== 'recording' || !state.startedAt) return
    const started = state.startedAt
    setElapsed(Date.now() - started)
    const interval = setInterval(() => setElapsed(Date.now() - started), 250)
    return () => clearInterval(interval)
  }, [state.phase, state.startedAt])

  return (
    <div className="flex h-screen w-screen items-end justify-center pb-1.5">
      {state.phase === 'idle' ? (
        // Resting state: a small capsule that marks where the pill will appear.
        <span className="mb-1 h-[5px] w-11 rounded-full bg-[#16161e]/45 ring-1 ring-white/15" />
      ) : (
        <Pill>
          {state.phase === 'recording' && (
            <>
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              <Waveform levels={levels} />
              <span className="tnum w-9 shrink-0 text-right text-xs text-white/70">
                {formatTimer(elapsed)}
              </span>
              {state.mode === 'translate' && (
                <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
                  {translateTarget.toUpperCase()}
                </span>
              )}
            </>
          )}

          {state.phase === 'transcribing' && (
            <>
              <span className="flex shrink-0 items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="animate-dot h-1.5 w-1.5 rounded-full bg-white"
                    style={{ animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </span>
              <span className="text-xs text-white/80">
                {state.mode === 'translate'
                  ? `Translating to ${translateTarget.toUpperCase()}`
                  : 'Transcribing'}
              </span>
            </>
          )}

          {state.phase === 'result' && (
            <>
              {state.pasted ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2.5} />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={2.25} />
              )}
              <span className="max-w-[240px] truncate text-xs text-white/85">
                {state.pasted ? state.transcript : 'Copied. Paste it yourself.'}
              </span>
            </>
          )}

          {state.phase === 'error' && (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={2.25} />
              <span className="max-w-[260px] truncate text-xs text-amber-100">{state.error}</span>
            </>
          )}
        </Pill>
      )}
    </div>
  )
}
