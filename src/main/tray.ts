import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { AppSettings } from '@shared/types'
import { settings } from './settings'
import { createMainWindow, markQuitting } from './windows'

let tray: Tray | null = null

function trayIcon(): Electron.NativeImage {
  const candidates = [
    join(import.meta.dirname, '../../resources/tray.png'),
    join(process.resourcesPath ?? '', 'resources/tray.png')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return nativeImage.createFromPath(p)
  }
  return nativeImage.createEmpty()
}

function buildMenu(cfg: AppSettings, onToggleDictation: () => void): Menu {
  const modelName = cfg.engine === 'local' ? cfg.localModel.split('/').pop() : cfg.cloud.model
  return Menu.buildFromTemplate([
    { label: 'Open NotWhisperFlow', click: () => createMainWindow() },
    { label: 'Start/Stop Dictation', click: () => onToggleDictation() },
    { type: 'separator' },
    {
      label: 'Local engine',
      type: 'radio',
      checked: cfg.engine === 'local',
      click: () => settings.set({ engine: 'local' })
    },
    {
      label: 'Cloud engine',
      type: 'radio',
      checked: cfg.engine === 'cloud',
      click: () => settings.set({ engine: 'cloud' })
    },
    { label: `Model: ${modelName}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Auto-paste',
      type: 'checkbox',
      checked: cfg.autoPaste,
      click: (item) => settings.set({ autoPaste: item.checked })
    },
    {
      label: 'Sounds',
      type: 'checkbox',
      checked: cfg.sounds,
      click: (item) => settings.set({ sounds: item.checked })
    },
    {
      label: 'AI cleanup',
      type: 'checkbox',
      checked: cfg.cleanup.enabled,
      click: (item) => settings.set({ cleanup: { ...settings.get().cleanup, enabled: item.checked } })
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        markQuitting()
        app.quit()
      }
    }
  ])
}

export function createTray(onToggleDictation: () => void): void {
  if (tray) return
  tray = new Tray(trayIcon())
  tray.setToolTip('NotWhisperFlow')
  tray.setContextMenu(buildMenu(settings.get(), onToggleDictation))
  tray.on('click', () => createMainWindow())
  // Keep the menu in sync no matter where a setting was changed from
  settings.on('changed', (next: AppSettings) => {
    tray?.setContextMenu(buildMenu(next, onToggleDictation))
  })
}
