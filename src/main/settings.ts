import { app } from 'electron'
import { EventEmitter } from 'node:events'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { AppSettings } from '@shared/types'

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'CommandOrControl+Shift+Space',
  engine: 'local',
  localModel: 'onnx-community/whisper-base',
  language: 'auto',
  cloud: {
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: '',
    model: 'whisper-large-v3-turbo'
  },
  cleanup: {
    enabled: false,
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: '',
    model: 'llama-3.3-70b-versatile'
  },
  autoPaste: true,
  restoreClipboard: true,
  launchAtLogin: false,
  sounds: true,
  onboarded: false
}

class SettingsStore extends EventEmitter {
  private cache: AppSettings | null = null

  private get file(): string {
    return join(app.getPath('userData'), 'settings.json')
  }

  get(): AppSettings {
    if (this.cache) return this.cache
    let stored: Partial<AppSettings> = {}
    try {
      stored = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<AppSettings>
    } catch {
      // first run or corrupted file: fall back to defaults
    }
    this.cache = {
      ...DEFAULT_SETTINGS,
      ...stored,
      cloud: { ...DEFAULT_SETTINGS.cloud, ...stored.cloud },
      cleanup: { ...DEFAULT_SETTINGS.cleanup, ...stored.cleanup }
    }
    return this.cache
  }

  set(patch: Partial<AppSettings>): AppSettings {
    const prev = this.get()
    const next: AppSettings = {
      ...prev,
      ...patch,
      cloud: { ...prev.cloud, ...patch.cloud },
      cleanup: { ...prev.cleanup, ...patch.cleanup }
    }
    this.cache = next
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(next, null, 2), 'utf8')
    this.emit('changed', next, prev)
    return next
  }
}

export const settings = new SettingsStore()
