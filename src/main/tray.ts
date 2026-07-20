import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
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

export function createTray(onToggleDictation: () => void): void {
  if (tray) return
  tray = new Tray(trayIcon())
  tray.setToolTip('WhisprFlow')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open WhisprFlow', click: () => createMainWindow() },
      { label: 'Start/Stop Dictation', click: () => onToggleDictation() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          markQuitting()
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => createMainWindow())
}
