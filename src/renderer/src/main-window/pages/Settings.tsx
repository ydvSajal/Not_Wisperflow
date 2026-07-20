import { useState } from 'react'
import type { AppSettings } from '@shared/types'
import { Button, Card, Field, Input, Select, Toggle } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { HotkeyRecorder } from '../components/HotkeyRecorder'
import { ModelList } from '../components/ModelList'
import { DictionaryCard } from '../components/DictionaryCard'

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' }
]

export function SettingsPage({
  settings,
  onChange
}: {
  settings: AppSettings
  onChange: (s: AppSettings) => void
}): React.JSX.Element {
  const toast = useToast()
  const [testingCloud, setTestingCloud] = useState(false)
  const [testingCleanup, setTestingCleanup] = useState(false)

  const save = (patch: Partial<AppSettings>): void => {
    void window.api.setSettings(patch).then(onChange)
  }

  const testCloud = async (): Promise<void> => {
    setTestingCloud(true)
    const result = await window.api.testCloud()
    setTestingCloud(false)
    toast(
      result.ok ? 'Cloud connection works' : `Cloud test failed: ${result.reason}`,
      result.ok ? 'success' : 'error'
    )
  }

  const testCleanup = async (): Promise<void> => {
    setTestingCleanup(true)
    const result = await window.api.testCleanup()
    setTestingCleanup(false)
    toast(
      result.ok ? 'Cleanup model works' : `Cleanup test failed: ${result.reason}`,
      result.ok ? 'success' : 'error'
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-8 py-8">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Card title="Shortcuts" subtitle="Press anywhere to start/stop dictation. Esc cancels a recording.">
        <Field label="Dictate">
          <HotkeyRecorder value={settings.hotkey} onSave={(hotkey) => save({ hotkey })} />
        </Field>
        <div className="mt-4 space-y-3">
          <Field label="Dictate & translate (needs an AI cleanup API key below)">
            <div className="flex flex-wrap items-center gap-2">
              <HotkeyRecorder
                value={settings.translateHotkey || 'Not set'}
                onSave={(translateHotkey) => save({ translateHotkey })}
              />
              {settings.translateHotkey && (
                <Button variant="ghost" onClick={() => save({ translateHotkey: '' })}>
                  Disable
                </Button>
              )}
              <Select
                value={settings.translateTarget}
                onChange={(e) => save({ translateTarget: e.target.value })}
                title="Translate into"
              >
                {LANGUAGES.filter((l) => l.value !== 'auto').map((l) => (
                  <option key={l.value} value={l.value}>
                    → {l.label}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
          {settings.translateHotkey && !settings.cleanup.apiKey && (
            <p className="text-xs text-amber-300">
              Translation uses the AI cleanup endpoint — add an API key in the AI cleanup card
              or translated dictations will paste untranslated.
            </p>
          )}
        </div>
      </Card>

      <Card title="Transcription engine">
        <div className="mb-4 flex gap-2">
          {(['local', 'cloud'] as const).map((engine) => (
            <button
              key={engine}
              onClick={() => save({ engine })}
              className={`rounded-lg px-4 py-2 text-sm capitalize transition-colors ${
                settings.engine === engine
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-ink-dim hover:text-ink'
              }`}
            >
              {engine === 'local' ? 'Local (offline, free)' : 'Cloud (API key)'}
            </button>
          ))}
        </div>

        {settings.engine === 'local' ? (
          <ModelList
            selected={settings.localModel}
            onSelect={(localModel) => save({ localModel })}
          />
        ) : (
          <div className="space-y-3">
            <Field label="Base URL (any OpenAI-compatible endpoint)">
              <Input
                value={settings.cloud.baseUrl}
                onChange={(e) => save({ cloud: { ...settings.cloud, baseUrl: e.target.value } })}
              />
            </Field>
            <Field label="Model">
              <Input
                value={settings.cloud.model}
                onChange={(e) => save({ cloud: { ...settings.cloud, model: e.target.value } })}
              />
            </Field>
            <Field label="API key (Groq keys are free at console.groq.com)">
              <Input
                type="password"
                value={settings.cloud.apiKey}
                placeholder="gsk_…"
                onChange={(e) => save({ cloud: { ...settings.cloud, apiKey: e.target.value } })}
              />
            </Field>
            <Button variant="ghost" onClick={() => void testCloud()} disabled={testingCloud}>
              {testingCloud ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
        )}

        <div className="mt-4">
          <Field label="Spoken language">
            <Select
              value={settings.language}
              onChange={(e) => save({ language: e.target.value })}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card
        title="AI cleanup"
        subtitle="Optional: an LLM fixes punctuation and removes filler words before pasting."
      >
        <Toggle
          checked={settings.cleanup.enabled}
          onChange={(enabled) => save({ cleanup: { ...settings.cleanup, enabled } })}
          label="Enable cleanup"
          description="Uses any OpenAI-compatible chat endpoint"
        />
        {settings.cleanup.enabled && (
          <div className="mt-3 space-y-3">
            <Field label="Base URL">
              <Input
                value={settings.cleanup.baseUrl}
                onChange={(e) =>
                  save({ cleanup: { ...settings.cleanup, baseUrl: e.target.value } })
                }
              />
            </Field>
            <Field label="Model">
              <Input
                value={settings.cleanup.model}
                onChange={(e) => save({ cleanup: { ...settings.cleanup, model: e.target.value } })}
              />
            </Field>
            <Field label="API key">
              <Input
                type="password"
                value={settings.cleanup.apiKey}
                onChange={(e) => save({ cleanup: { ...settings.cleanup, apiKey: e.target.value } })}
              />
            </Field>
            <Button variant="ghost" onClick={() => void testCleanup()} disabled={testingCleanup}>
              {testingCleanup ? 'Testing…' : 'Test cleanup'}
            </Button>
          </div>
        )}
      </Card>

      <DictionaryCard />

      <Card title="Behavior">
        <Toggle
          checked={settings.autoPaste}
          onChange={(autoPaste) => save({ autoPaste })}
          label="Auto-paste into the active app"
          description="Off = text is only copied to the clipboard"
        />
        <Toggle
          checked={settings.restoreClipboard}
          onChange={(restoreClipboard) => save({ restoreClipboard })}
          label="Restore previous clipboard after pasting"
        />
        <Toggle
          checked={settings.sounds}
          onChange={(sounds) => save({ sounds })}
          label="Sounds"
          description="Chirp on start, stop and errors"
        />
        <Toggle
          checked={settings.launchAtLogin}
          onChange={(launchAtLogin) => save({ launchAtLogin })}
          label="Launch at login"
        />
      </Card>
    </div>
  )
}
