import { useEffect, useRef, useState } from 'react'
import { AudioLines, Check, Mic } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { Button, Card } from '@/components/ui'
import { prettyHotkey } from '@/lib/format'
import { HotkeyRecorder } from '../components/HotkeyRecorder'
import { ModelList } from '../components/ModelList'

type Step = 'welcome' | 'mic' | 'model' | 'hotkey' | 'try'
const STEPS: Step[] = ['welcome', 'mic', 'model', 'hotkey', 'try']

function MicCheck({ onOk }: { onOk: (ok: boolean) => void }): React.JSX.Element {
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const cleanupRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const interval = setInterval(() => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (const v of data) sum += (v - 128) ** 2
          setLevel(Math.min(1, Math.sqrt(sum / data.length) / 24))
        }, 80)
        cleanupRef.current = () => {
          clearInterval(interval)
          stream.getTracks().forEach((t) => t.stop())
          void ctx.close()
        }
        onOk(true)
      } catch {
        if (!cancelled) {
          setError('Microphone access failed. Check Windows Settings → Privacy → Microphone, then retry.')
          onOk(false)
        }
      }
    })()
    return () => {
      cancelled = true
      cleanupRef.current()
    }
  }, [onOk])

  if (error) return <p className="text-sm text-amber-300">{error}</p>
  return (
    <div className="flex items-center gap-3">
      <Mic className="h-5 w-5 text-accent" />
      <div className="h-2 flex-1 overflow-hidden rounded bg-surface-3">
        <div
          className="h-full bg-emerald-400 transition-[width] duration-100"
          style={{ width: `${level * 100}%` }}
        />
      </div>
      <span className="text-xs text-ink-dim">Say something…</span>
    </div>
  )
}

export function Onboarding({
  settings,
  onDone
}: {
  settings: AppSettings
  onDone: (s: AppSettings) => void
}): React.JSX.Element {
  const [step, setStep] = useState<Step>('welcome')
  const [micOk, setMicOk] = useState(false)
  const [tried, setTried] = useState<string | null>(null)

  useEffect(() => window.api.onDictationDone(({ text }) => setTried(text)), [])

  const next = (): void => setStep(STEPS[STEPS.indexOf(step) + 1] ?? 'try')

  const finish = (): void => {
    void window.api.setSettings({ onboarded: true }).then(onDone)
  }

  const stepIndex = STEPS.indexOf(step)
  // Model download is optional here: a user can pick cloud/Sarvam in Settings
  // later, or come back once a download finishes. Only mic access is a hard
  // requirement, since the app cannot function at all without it.
  const canContinue = step === 'welcome' || (step === 'mic' && micOk) || step === 'model' || step === 'hotkey'

  return (
    <div className="flex h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center gap-2">
          <AudioLines className="h-6 w-6 text-accent" />
          <span className="text-lg font-semibold">NotWhisperFlow setup</span>
          <span className="ml-auto text-xs text-ink-dim">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>

        {step === 'welcome' && (
          <Card title="Welcome 👋">
            <p className="text-sm leading-relaxed text-ink-dim">
              NotWhisperFlow turns your voice into text anywhere on your PC: press a shortcut, talk,
              and the words are pasted into whatever app you're using. Free, private, and local by
              default. Let's set it up in under a minute.
            </p>
          </Card>
        )}

        {step === 'mic' && (
          <Card title="Microphone check" subtitle="We need mic access to hear you.">
            <MicCheck onOk={setMicOk} />
          </Card>
        )}

        {step === 'model' && (
          <Card
            title="Download a speech model"
            subtitle="Runs fully offline on your CPU. Base is the sweet spot; you can switch later in Settings."
          >
            <ModelList
              selected={settings.localModel}
              onSelect={(localModel) => void window.api.setSettings({ localModel })}
            />
            <p className="mt-3 text-xs text-ink-dim">
              Downloading takes a moment in the background — Continue whenever you're ready.
              Prefer cloud transcription instead? Add a free Groq API key later in Settings →
              Transcription engine.
            </p>
          </Card>
        )}

        {step === 'hotkey' && (
          <Card title="Pick your shortcut" subtitle="You'll press this to start and stop dictation.">
            <HotkeyRecorder
              value={settings.hotkey}
              onSave={(hotkey) => void window.api.setSettings({ hotkey })}
            />
          </Card>
        )}

        {step === 'try' && (
          <Card
            title="Try it!"
            subtitle={`Click into any text field (or Notepad), press ${prettyHotkey(settings.hotkey)}, say something, then press it again.`}
          >
            {tried ? (
              <div className="flex items-start gap-2 text-sm text-emerald-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  It works! You said: <span className="text-ink">“{tried}”</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-dim">Waiting for your first dictation…</p>
            )}
          </Card>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)])}
            disabled={stepIndex === 0}
          >
            Back
          </Button>
          {step === 'try' ? (
            <Button onClick={finish}>{tried ? 'Finish' : 'Skip & finish'}</Button>
          ) : (
            <Button onClick={next} disabled={!canContinue}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
