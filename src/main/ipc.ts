import { app, clipboard, ipcMain, BrowserWindow } from 'electron'
import type { AppSettings, HistoryQuery, ModelDownloadProgress } from '@shared/types'
import { EVT, IPC } from '@shared/ipc-channels'
import { settings } from './settings'
import * as db from './db'
import { listLocalModels } from './transcription/model-manager'
import { localWhisper } from './transcription/local-whisper'
import { testCloudConfig } from './transcription/cloud'
import { testSarvamConfig } from './transcription/sarvam'
import { testCleanupConfig } from './cleanup'
import { createMainWindow } from './windows'
import { importAudio, type DictationController } from './dictation'
import type { HotkeyManager } from './hotkeys'
import type { Replacement } from '@shared/types'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerIpc(dictation: DictationController, hotkeys: HotkeyManager): void {
  ipcMain.handle(IPC.settingsGet, () => settings.get())

  ipcMain.handle(IPC.settingsSet, (_e, patch: Partial<AppSettings>) => settings.set(patch))

  ipcMain.handle(IPC.settingsValidateHotkey, (_e, accelerator: string) =>
    hotkeys.validate(accelerator)
  )

  ipcMain.handle(IPC.dictationToggle, () => dictation.toggle())
  ipcMain.handle(IPC.dictationCancel, () => dictation.cancel())
  ipcMain.handle(IPC.dictationAudio, (_e, pcm: Float32Array, durationMs: number) => {
    // Structured clone hands us back a Float32Array view over a fresh buffer
    void dictation.onAudio(pcm, durationMs)
  })
  ipcMain.handle(IPC.dictationAudioChunk, (_e, pcm: Float32Array, durationMs: number) => {
    void dictation.onAudioChunk(pcm, durationMs)
  })
  ipcMain.handle(IPC.dictationCaptureError, (_e, message: string) =>
    dictation.onCaptureError(message)
  )

  ipcMain.handle(IPC.importAudio, (_e, pcm: Float32Array, durationMs: number) =>
    importAudio(pcm, durationMs)
  )

  ipcMain.handle(IPC.replacementsList, () => db.listReplacements())
  ipcMain.handle(IPC.replacementsAdd, (_e, input: Omit<Replacement, 'id'>) =>
    db.addReplacement(input)
  )
  ipcMain.handle(IPC.replacementsDelete, (_e, id: number) => db.deleteReplacement(id))

  ipcMain.handle(IPC.notesList, (_e, search?: string) => db.listNotes(search))
  ipcMain.handle(IPC.notesCreate, (_e, title: string) => db.createNote(title))
  ipcMain.handle(IPC.notesUpdate, (_e, id: number, patch: { title?: string; body?: string }) =>
    db.updateNote(id, patch)
  )
  ipcMain.handle(IPC.notesDelete, (_e, id: number) => db.deleteNote(id))
  ipcMain.handle(IPC.notesAppend, (_e, id: number, text: string) => db.appendToNote(id, text))

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
  ipcMain.handle(IPC.sarvamTest, () => testSarvamConfig(settings.get().sarvam))
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

  // Side effects of any settings change (from the UI, tray, or onboarding):
  // sync the OS login item, re-register hotkeys with rollback, notify all windows.
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
        return // the rollback re-fires 'changed', which broadcasts
      }
    }
    if (next.translateHotkey !== prev.translateHotkey) {
      const result = hotkeys.applyTranslate(next.translateHotkey)
      if (!result.ok) {
        hotkeys.applyTranslate(prev.translateHotkey)
        settings.set({ translateHotkey: prev.translateHotkey })
        return
      }
    }
    broadcast(EVT.settingsChanged, next)
  })
}
