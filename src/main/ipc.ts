import { app, clipboard, ipcMain, BrowserWindow } from 'electron'
import type { AppSettings, HistoryQuery, ModelDownloadProgress } from '@shared/types'
import { EVT, IPC } from '@shared/ipc-channels'
import { settings } from './settings'
import * as db from './db'
import { listLocalModels } from './transcription/model-manager'
import { localWhisper } from './transcription/local-whisper'
import { testCloudConfig } from './transcription/cloud'
import { testCleanupConfig } from './cleanup'
import { createMainWindow, getMainWindow } from './windows'
import type { DictationController } from './dictation'
import type { HotkeyManager } from './hotkeys'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerIpc(dictation: DictationController, hotkeys: HotkeyManager): void {
  ipcMain.handle(IPC.settingsGet, () => settings.get())

  ipcMain.handle(IPC.settingsSet, (_e, patch: Partial<AppSettings>) => {
    const next = settings.set(patch)
    broadcast(EVT.settingsChanged, next)
    return next
  })

  ipcMain.handle(IPC.settingsValidateHotkey, (_e, accelerator: string) =>
    hotkeys.validate(accelerator)
  )

  ipcMain.handle(IPC.dictationToggle, () => dictation.toggle())
  ipcMain.handle(IPC.dictationCancel, () => dictation.cancel())
  ipcMain.handle(IPC.dictationAudio, (_e, pcm: Float32Array, durationMs: number) => {
    // Structured clone hands us back a Float32Array view over a fresh buffer
    void dictation.onAudio(pcm, durationMs)
  })
  ipcMain.handle(IPC.dictationCaptureError, (_e, message: string) =>
    dictation.onCaptureError(message)
  )

  ipcMain.handle(IPC.historyList, (_e, query: HistoryQuery) => db.listHistory(query))
  ipcMain.handle(IPC.historyDelete, (_e, id: number) => db.deleteTranscription(id))
  ipcMain.handle(IPC.historyClear, () => db.clearHistory())
  ipcMain.handle(IPC.statsGet, () => db.getStats())

  ipcMain.handle(IPC.modelsList, () => listLocalModels())
  ipcMain.handle(IPC.modelsDownload, async (_e, modelId: string) => {
    localWhisper.setModel(modelId)
    try {
      await localWhisper.load()
      const done: ModelDownloadProgress = { modelId, percent: 100, status: 'ready' }
      broadcast(EVT.modelProgress, done)
    } catch (err) {
      const failed: ModelDownloadProgress = {
        modelId,
        percent: 0,
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      }
      broadcast(EVT.modelProgress, failed)
      throw err
    }
  })

  ipcMain.handle(IPC.cloudTest, () => testCloudConfig(settings.get().cloud))
  ipcMain.handle(IPC.cleanupTest, () => testCleanupConfig(settings.get().cleanup))

  ipcMain.handle(IPC.appVersion, () => app.getVersion())
  ipcMain.handle(IPC.openMainWindow, () => {
    createMainWindow()
  })
  ipcMain.handle(IPC.copyText, (_e, text: string) => clipboard.writeText(text))

  // Forward model download progress from the whisper worker to all windows
  localWhisper.on('progress', ({ modelId, percent }: { modelId: string; percent: number }) => {
    const progress: ModelDownloadProgress = { modelId, percent, status: 'downloading' }
    broadcast(EVT.modelProgress, progress)
  })

  // Keep OS login item in sync with the setting
  settings.on('changed', (next: AppSettings, prev: AppSettings) => {
    if (next.launchAtLogin !== prev.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
    }
    if (next.hotkey !== prev.hotkey) {
      const result = hotkeys.apply(next.hotkey)
      if (!result.ok) {
        // Roll back so the app never ends up with no working hotkey
        hotkeys.apply(prev.hotkey)
        settings.set({ hotkey: prev.hotkey })
        getMainWindow()?.webContents.send(EVT.settingsChanged, settings.get())
      }
    }
  })
}
