import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2, Mic } from 'lucide-react'
import type { BarState } from '@shared/types'
import { MicRecorder } from '@/lib/recorder'
import { sounds } from '@/lib/sounds'
import { formatTimer } from '@/lib/format'
import { Waveform } from './Waveform'

const LEVEL_BARS = 24

export function BarApp(): React.JSX.Element | null {
  const [state, setState] = useState<BarState>({ phase: 'idle' })
  const [levels, setLevels] = useState<number[]>(() => Array<number>(LEVEL_BARS).fill(0))
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MicRecorder | null>(null)
  const soundsEnabled = useRef(true)

  useEffect(() => {
    void window.api.getSettings().then((s) => (soundsEnabled.current = s.sounds))
    return window.api.onSettingsChanged((s) => (soundsEnabled.current = s.sounds))
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
      recorder.start(onLevel).catch((err: unknown) => {
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
        void recorder.stop().then(({ pcm, durationMs }) => window.api.sendAudio(pcm, durationMs))
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

  if (state.phase === 'idle') return null

  return (
    <div className="flex h-screen w-screen items-end justify-center pb-2">
      <div className="flex min-h-[64px] w-[440px] items-center gap-3 rounded-2xl border border-white/10 bg-[#12121aee] px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur">
        {state.phase === 'recording' && (
          <>
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-pulse-dot absolute inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <Waveform levels={levels} />
            <span className="w-10 shrink-0 text-right font-mono text-sm text-ink-dim">
              {formatTimer(elapsed)}
            </span>
          </>
        )}
        {state.phase === 'transcribing' && (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
            <span className="text-sm text-ink-dim">Transcribing…</span>
          </>
        )}
        {state.phase === 'result' && (
          <>
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <p className="line-clamp-2 text-sm leading-snug text-ink">{state.transcript}</p>
          </>
        )}
        {state.phase === 'error' && (
          <>
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="line-clamp-2 text-sm leading-snug text-amber-200">{state.error}</p>
          </>
        )}
        {state.phase === 'recording' && (
          <span className="ml-1 hidden shrink-0 items-center gap-1 text-[11px] text-ink-dim sm:flex">
            <Mic className="h-3 w-3" /> Esc cancels
          </span>
        )}
      </div>
    </div>
  )
}
